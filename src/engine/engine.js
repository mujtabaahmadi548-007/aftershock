// AFTERSHOCK deterministic simulation engine.
//
// State: x[t][r][n] = deviation of node n in region r at week t from the no-shock baseline (0).
// Update (first-order lag toward the level implied by drivers, a standard system-dynamics form):
//   drive[r][n](t) = shocks + sum over incoming edges e of  f_e(x[r][src](t - lag_e)) * exposure_e[r] * scale_e
//   coupled nodes mix in a weighted world mean of drives:  (1-c)*drive_r + c*mean(drive)
//   x(t+1) = x(t) + (clamp(drive) - x(t)) / tau_n
// Two documented rules shape f_e:
//   GAIN RULE   - when a source is better than baseline and the edge makes its target better, ordinary edges
//                 transmit at half strength and are tagged speculative (elasticities were calibrated on losses).
//   REPAIR RULE - repair edges (rebuilding, substitution) can at most cancel the damage acting on their target;
//                 they never push it above baseline.
// No randomness anywhere. The uncertainty envelope comes from two extra deterministic runs that scale every
// edge by its evidence-class uncertainty (stronger vs weaker transmission, adaptive edges moving the other
// way). It is a sensitivity envelope, not a statistical confidence interval.

import { NODES, EDGES, BASIS, edgeKey } from './model.js';
import { REGIONS } from './regions.js';
import { SCENARIOS, defaultParams } from './scenarios.js';

export const N = NODES.length;
export const R = REGIONS.length;
export const E = EDGES.length;
export const RN = R * N;
export const HORIZON = 520; // weeks (10 years)
export const GAIN_DAMP = 0.5;
export const NODE_INDEX = Object.fromEntries(NODES.map((n, i) => [n.id, i]));
export const EDGE_INDEX = Object.fromEntries(EDGES.map((e, j) => [edgeKey(e), j]));
export const RESPONSE = {
  none: { f: 0.35, coop: -0.06, label: 'Uncoordinated' },
  moderate: { f: 1, coop: 0, label: 'Moderate' },
  strong: { f: 1.6, coop: 0.15, label: 'Strong & coordinated' },
};
const SHOCK_S_CONF = BASIS.S.conf;

function weights(field) {
  const w = REGIONS.map((r) => r[field]);
  const s = w.reduce((a, b) => a + b, 0);
  return Float64Array.from(w, (v) => v / s);
}

// ---------- compile the model once ----------
export const MODEL = (() => {
  const nodes = NODES.map((n, i) => {
    if (!(n.tau > 0)) throw new Error(`node ${n.id}: tau must be > 0`);
    return { ...n, i, k: Math.min(1, 1 / n.tau), cpl: n.cpl || 0, cwArr: n.cpl ? weights(n.cw) : null, aggArr: weights(n.agg) };
  });
  const edges = EDGES.map((e, j) => {
    const si = NODE_INDEX[e.s], ti = NODE_INDEX[e.t];
    if (si === undefined || ti === undefined) throw new Error(`edge ${edgeKey(e)} references an unknown node`);
    if (!BASIS[e.b]) throw new Error(`edge ${edgeKey(e)} has unknown basis ${e.b}`);
    const expo = Float64Array.from(REGIONS, (r) => (e.exp ? r[e.exp] : 1));
    if (e.exp && expo.some((v) => !Number.isFinite(v))) throw new Error(`edge ${edgeKey(e)}: missing exposure field ${e.exp}`);
    // Every compiled edge has the same shape (keeps the hot loop monomorphic).
    return {
      j, si, ti, s: e.s, t: e.t, key: edgeKey(e), w: e.w, lag: e.lag, b: e.b, why: e.why || '', ref: e.ref || null,
      exp: e.exp || null, expo, th: e.th || 0, kink: e.kink || null, kTh: e.kink ? e.kink.th : 0, kW: e.kink ? e.kink.w : 0,
      hasWPos: e.wPos !== undefined, wPos: e.wPos ?? 0, bPos: e.bPos || null, clip: e.clip === 'pos' ? 1 : e.clip === 'neg' ? -1 : 0,
      ad: !!e.ad, sym: !!e.sym, repair: !!e.repair, u: e.u ?? BASIS[e.b].unc, srcPol: nodes[si].pol, tgtPol: nodes[ti].pol,
      gainable: !e.ad && !e.sym && !e.repair && e.wPos === undefined,
      confB: BASIS[e.b].conf, confPos: BASIS[e.bPos || e.b].conf,
    };
  });
  const incoming = nodes.map(() => []);
  const outgoing = nodes.map(() => []);
  for (const e of edges) { incoming[e.ti].push(e); outgoing[e.si].push(e); }
  const maxInc = Math.max(...incoming.map((a) => a.length));
  const adaptCap = Float64Array.from(REGIONS, (r) => 0.5 + r.adaptive);
  return { nodes, edges, incoming, outgoing, adaptCap, maxInc, popW: weights('pop') };
})();

// Gain = the source is better than baseline AND the edge makes the target better.
const isGain = (e, sv) => e.gainable && sv * e.srcPol > 0 && e.w * sv * e.tgtPol > 0;

// Raw (unscaled) contribution of an edge given the source deviation.
export function edgeRaw(e, sv) {
  let v = sv;
  if (e.th) {
    const a = Math.abs(v) - e.th;
    v = a <= 0 ? 0 : v > 0 ? a : -a;
  }
  let w = sv > 0 && e.hasWPos ? e.wPos : e.w;
  if (isGain(e, sv)) w *= GAIN_DAMP;
  let c = w * v;
  if (e.kTh !== 0 && sv < -e.kTh) c += e.kW * (sv + e.kTh);
  if (e.clip === 1 && c < 0) c = 0;
  else if (e.clip === -1 && c > 0) c = 0;
  return c;
}
function basisConf(e, sv) {
  if (sv > 0 && e.bPos) return e.confPos;
  if (isGain(e, sv)) return BASIS.S.conf;
  return e.confB;
}
export function edgeBasis(e, sv) {
  if (sv > 0 && e.bPos) return e.bPos;
  if (isGain(e, sv)) return 'S';
  return e.b;
}

// Envelope of a shock over time (weeks since start). ramp >= 1; hold counted after the ramp.
export function profile(t, p = {}) {
  const t0 = t - (p.start || 0);
  if (t0 < 0) return 0;
  const ramp = Math.max(1, p.ramp || 1);
  let up = Math.min(1, (t0 + 1) / ramp);
  if (p.shape === 'smooth') up = up * up * (3 - 2 * up);
  const endHold = ramp + (p.hold ?? Infinity);
  if (t0 < endHold) return up;
  const rec = p.recover || 0;
  if (rec <= 0) return 0;
  return Math.max(0, 1 - (t0 - endHold + 1) / rec);
}

export function normalizeConfig(cfg) {
  // A custom scenario object may be passed (used by tests and for user-defined premises).
  const scn = cfg.scenario || SCENARIOS.find((s) => s.id === cfg.scenarioId);
  if (!scn) throw new Error(`unknown scenario ${cfg.scenarioId}`);
  const params = { ...defaultParams(scn), ...(cfg.params || {}) };
  for (const p of scn.params) {
    if (p.type === 'range') {
      const v = Number(params[p.id]);
      if (!Number.isFinite(v)) throw new Error(`param ${p.id} must be a number`);
      params[p.id] = Math.min(p.max, Math.max(p.min, v));
    } else if (!p.options.some((o) => o.v === params[p.id])) params[p.id] = p.def;
  }
  const out = { scenarioId: scn.id, params, horizon: Math.min(1040, Math.max(26, cfg.horizon || HORIZON)) };
  if (cfg.branch && cfg.branch.week > 0) {
    out.branch = { week: Math.round(cfg.branch.week), params: normalizeConfig({ scenario: scn, params: { ...params, ...cfg.branch.params } }).cfg.params };
  }
  return { scn, cfg: out };
}

function buildShocks(scn, params, T) {
  const P = new Float64Array((T + 1) * RN);
  const S = new Float64Array((T + 1) * RN);
  const list = scn.shocks(params);
  for (const sh of list) {
    const n = NODE_INDEX[sh.node];
    if (n === undefined) throw new Error(`shock on unknown node ${sh.node}`);
    const arr = sh.basis === 'S' ? S : P;
    const rf = REGIONS.map((r) => (sh.regions ? sh.regions[r.id] || 0 : 1));
    for (let t = 0; t <= T; t++) {
      const env = profile(t, sh.prof);
      if (env === 0) continue;
      for (let r = 0; r < R; r++) arr[t * RN + r * N + n] += sh.mag * env * rf[r];
    }
  }
  const resp = RESPONSE[params.response] || RESPONSE.moderate;
  if (resp.coop !== 0) {
    const n = NODE_INDEX.cooperation;
    for (let t = 0; t <= T; t++) for (let r = 0; r < R; r++) P[t * RN + r * N + n] += resp.coop;
  }
  return { P, S, list, resp };
}

function edgeScales(scn, params) {
  const s = new Float64Array(E).fill(1);
  const over = scn.edgeScale ? scn.edgeScale(params) : {};
  for (const [k, v] of Object.entries(over)) {
    const j = EDGE_INDEX[k];
    if (j === undefined) throw new Error(`edgeScale references unknown edge ${k}`);
    s[j] = v;
  }
  return s;
}

const VARIANTS = ['central', 'strong', 'weak'];
function variantScale(variant) {
  const s = new Float64Array(E);
  for (const e of MODEL.edges) {
    const up = 1 + e.u, dn = Math.max(0, 1 - e.u);
    s[e.j] = variant === 'central' ? 1 : variant === 'strong' ? (e.ad ? dn : up) : (e.ad ? up : dn);
  }
  return s;
}

// Per-edge, per-region multiplier: exposure x scenario scale x variant scale x adaptive response.
function buildMult(scale, resp, vs) {
  const m = new Float64Array(E * R);
  for (const e of MODEL.edges) {
    for (let r = 0; r < R; r++) {
      let v = e.expo[r] * scale[e.j] * vs[e.j];
      if (e.ad) v *= resp.f * MODEL.adaptCap[r];
      m[e.j * R + r] = v;
    }
  }
  return m;
}

function buildContext(scn, cfg) {
  const T = cfg.horizon;
  const A = buildShocks(scn, cfg.params, T);
  const scaleA = edgeScales(scn, cfg.params);
  let P = A.P, S = A.S, scaleB = scaleA, respB = A.resp, bw = T + 1;
  if (cfg.branch) {
    bw = Math.min(cfg.branch.week, T + 1);
    const B = buildShocks(scn, cfg.branch.params, T);
    P = A.P.slice(); S = A.S.slice();
    P.set(B.P.subarray(bw * RN), bw * RN);
    S.set(B.S.subarray(bw * RN), bw * RN);
    scaleB = edgeScales(scn, cfg.branch.params);
    respB = B.resp;
  }
  const one = new Float64Array(E).fill(1);
  return { T, P, S, scaleA, scaleB, respA: A.resp, respB, branchWeek: bw, shockList: A.list,
    multA: buildMult(scaleA, A.resp, one), multB: buildMult(scaleB, respB, one) };
}

// Contributions of every incoming edge of node n in region r at week t, written to cs (by incoming position).
// Applies the repair rule. Returns the summed edge drive. `shock` is the exogenous drive on the node.
function contribs(n, r, t, x, mult, shock, cs) {
  const inc = MODEL.incoming[n];
  const rb = r * N;
  let d = 0, rep = 0;
  for (let k = 0; k < inc.length; k++) {
    const e = inc[k];
    const tl = t - e.lag;
    if (tl < 0) { cs[k] = 0; continue; }
    const sv = x[tl * RN + rb + e.si];
    const c = sv === 0 ? 0 : edgeRaw(e, sv) * mult[e.j * R + r];
    cs[k] = c;
    if (e.repair) rep += c; else d += c;
  }
  if (rep > 0) {
    const allowed = Math.max(0, -(d + shock));
    if (rep > allowed) {
      const f = allowed / rep;
      for (let k = 0; k < inc.length; k++) if (inc[k].repair) cs[k] *= f;
      rep = allowed;
    }
  }
  return d + rep;
}

function simulateVariant(ctx, variant, wantConf) {
  const { T, P, S } = ctx;
  const vs = variantScale(variant);
  const { nodes, incoming } = MODEL;
  const x = new Float64Array((T + 1) * RN);
  const conf = wantConf ? new Float32Array((T + 1) * RN).fill(1) : null;
  const drive = new Float64Array(RN), nu = new Float64Array(RN), de = new Float64Array(RN);
  const cs = new Float64Array(MODEL.maxInc);
  const multA = buildMult(ctx.scaleA, ctx.respA, vs);
  const multB = ctx.branchWeek <= T ? buildMult(ctx.scaleB, ctx.respB, vs) : multA;
  for (let t = 0; t < T; t++) {
    const mult = t >= ctx.branchWeek ? multB : multA;
    const base = t * RN;
    for (let r = 0; r < R; r++) {
      const rb = r * N;
      for (let n = 0; n < N; n++) {
        const idx = rb + n;
        const sp = P[base + idx], ss = S[base + idx];
        const d = sp + ss + contribs(n, r, t, x, mult, sp + ss, cs);
        drive[idx] = d;
        if (wantConf) {
          let a = Math.abs(sp) + Math.abs(ss) * SHOCK_S_CONF, b = Math.abs(sp) + Math.abs(ss);
          const inc = incoming[n];
          for (let k = 0; k < inc.length; k++) {
            const c = cs[k];
            if (c === 0) continue;
            const e = inc[k], tl = t - e.lag, si = tl * RN + rb + e.si;
            const ac = Math.abs(c);
            a += ac * conf[si] * basisConf(e, x[si]);
            b += ac;
          }
          nu[idx] = a; de[idx] = b;
        }
      }
    }
    // global coupling
    for (const node of nodes) {
      if (!node.cpl) continue;
      const n = node.i, c = node.cpl, sum = node.cmode === 'sum';
      let m = 0, ma = 0, mb = 0;
      for (let r = 0; r < R; r++) {
        const w = sum ? 1 : node.cwArr[r];
        m += w * drive[r * N + n]; ma += w * nu[r * N + n]; mb += w * de[r * N + n];
      }
      for (let r = 0; r < R; r++) {
        const idx = r * N + n;
        drive[idx] = (1 - c) * drive[idx] + c * m;
        if (wantConf) { nu[idx] = (1 - c) * nu[idx] + c * ma; de[idx] = (1 - c) * de[idx] + c * mb; }
      }
    }
    const nb = (t + 1) * RN;
    for (let idx = 0; idx < RN; idx++) {
      const node = nodes[idx % N];
      let d = drive[idx];
      if (d < node.min) d = node.min; else if (d > node.max) d = node.max;
      const cur = x[base + idx];
      x[nb + idx] = cur + (d - cur) * node.k;
      if (wantConf) conf[nb + idx] = de[idx] > 1e-9 ? nu[idx] / de[idx] : conf[base + idx];
    }
  }
  return { x, conf };
}

function aggregate(x, T) {
  const g = new Float64Array((T + 1) * N);
  for (let t = 0; t <= T; t++) {
    for (let n = 0; n < N; n++) {
      const w = MODEL.nodes[n].aggArr;
      let s = 0;
      for (let r = 0; r < R; r++) s += w[r] * x[t * RN + r * N + n];
      g[t * N + n] = s;
    }
  }
  return g;
}

// ---------- public: run ----------
export function runScenario(input) {
  const { scn, cfg } = normalizeConfig(input);
  const ctx = buildContext(scn, cfg);
  const T = cfg.horizon;
  const runs = {};
  for (const v of VARIANTS) runs[v] = simulateVariant(ctx, v, v === 'central');
  const x = runs.central.x;
  const lo = new Float32Array(x.length), hi = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const a = x[i], b = runs.strong.x[i], c = runs.weak.x[i];
    lo[i] = Math.min(a, b, c); hi[i] = Math.max(a, b, c);
  }
  const g = aggregate(x, T), gs = aggregate(runs.strong.x, T), gw = aggregate(runs.weak.x, T);
  const gLo = new Float64Array(g.length), gHi = new Float64Array(g.length);
  for (let i = 0; i < g.length; i++) { gLo[i] = Math.min(g[i], gs[i], gw[i]); gHi[i] = Math.max(g[i], gs[i], gw[i]); }
  const conf = runs.central.conf;
  // Confidence of a global aggregate: |change|-weighted mean of regional confidence.
  const gConf = new Float32Array((T + 1) * N).fill(1);
  for (let t = 0; t <= T; t++) for (let n = 0; n < N; n++) {
    const w = MODEL.nodes[n].aggArr; let a = 0, b = 0;
    for (let r = 0; r < R; r++) { const i = t * RN + r * N + n; const m = w[r] * Math.abs(x[i]); a += m * conf[i]; b += m; }
    if (b > 1e-12) gConf[t * N + n] = a / b;
  }
  const run = { cfg, scenario: scn, T, x, lo, hi, conf, g, gLo, gHi, gConf, xs: runs.strong.x, xw: runs.weak.x, ctx };
  run.kpis = computeKpis(run);
  run.events = detectEvents(run);
  return run;
}

// ---------- accessors ----------
export const val = (run, t, r, n) => run.x[t * RN + r * N + n];
export const gval = (run, t, n) => run.g[t * N + n];
const multAt = (run, t) => (t >= run.ctx.branchWeek ? run.ctx.multB : run.ctx.multA);

export function series(run, nodeId, scope = -1) {
  const n = NODE_INDEX[nodeId], T = run.T;
  const c = new Float64Array(T + 1), lo = new Float64Array(T + 1), hi = new Float64Array(T + 1);
  for (let t = 0; t <= T; t++) {
    if (scope < 0) { c[t] = run.g[t * N + n]; lo[t] = run.gLo[t * N + n]; hi[t] = run.gHi[t * N + n]; }
    else { const i = t * RN + scope * N + n; c[t] = run.x[i]; lo[t] = run.lo[i]; hi[t] = run.hi[i]; }
  }
  return { c, lo, hi };
}

export function confidence(run, nodeId, scope, t) {
  const n = NODE_INDEX[nodeId];
  return scope < 0 ? run.gConf[t * N + n] : run.conf[t * RN + scope * N + n];
}

// Breakdown of what is pulling a node at week t. Items sum exactly to the pre-clamp drive that sets x(t+1).
export function drivers(run, nodeId, scope, t) {
  const n = NODE_INDEX[nodeId];
  const node = MODEL.nodes[n];
  const ctx = run.ctx;
  t = Math.max(0, Math.min(run.T - 1, t));
  const mult = multAt(run, t);
  const cs = new Float64Array(MODEL.maxInc);
  const inc = MODEL.incoming[n];
  const per = REGIONS.map((_, r) => {
    const i = t * RN + r * N + n;
    const sp = ctx.P[i], ss = ctx.S[i];
    const items = [];
    if (sp) items.push({ kind: 'shock', value: sp, basis: 'P' });
    if (ss) items.push({ kind: 'shock', value: ss, basis: 'S' });
    contribs(n, r, t, run.x, mult, sp + ss, cs);
    inc.forEach((e, k) => {
      const tl = t - e.lag;
      if (tl < 0) return;
      const sv = run.x[tl * RN + r * N + e.si];
      items.push({ kind: 'edge', e, value: cs[k], src: sv, basis: edgeBasis(e, sv), tl });
    });
    return { items, local: items.reduce((a, b) => a + b.value, 0) };
  });
  let items, couplingVal = 0;
  if (node.cpl) {
    const c = node.cpl, sum = node.cmode === 'sum';
    let m = 0;
    for (let r = 0; r < R; r++) m += (sum ? 1 : node.cwArr[r]) * per[r].local;
    const cpl = per.map((p) => c * m - c * p.local);
    if (scope >= 0) couplingVal = cpl[scope];
    else couplingVal = cpl.reduce((a, v, r) => a + v * node.aggArr[r], 0);
  }
  items = scope >= 0 ? per[scope].items : mergeRegions(per.map((p) => p.items), node.aggArr);
  if (Math.abs(couplingVal) > 1e-9) items.push({ kind: 'coupling', value: couplingVal, basis: 'A' });
  const total = items.reduce((a, b) => a + b.value, 0);
  items = items.filter((it) => Math.abs(it.value) > 1e-7).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const cur = scope >= 0 ? run.x[t * RN + scope * N + n] : run.g[t * N + n];
  return { node, items, total, value: cur, t };
}

function mergeRegions(perItems, w) {
  const map = new Map();
  perItems.forEach((items, r) => {
    for (const it of items) {
      const key = it.kind === 'edge' ? 'e' + it.e.j : 's' + it.basis;
      const cur = map.get(key) || { ...it, value: 0, src: 0 };
      cur.value += it.value * w[r];
      if (it.kind === 'edge') cur.src += it.src * w[r];
      map.set(key, cur);
    }
  });
  return [...map.values()];
}

// Visit every (region, edge) contribution at week t.
function forEachContribution(run, t, regions, fn) {
  const mult = multAt(run, t);
  const cs = new Float64Array(MODEL.maxInc);
  for (const r of regions) {
    for (let n = 0; n < N; n++) {
      const i = t * RN + r * N + n;
      contribs(n, r, t, run.x, mult, run.ctx.P[i] + run.ctx.S[i], cs);
      const inc = MODEL.incoming[n];
      for (let k = 0; k < inc.length; k++) if (cs[k] !== 0) fn(r, inc[k], cs[k]);
    }
  }
}
const ALL_REGIONS = REGIONS.map((_, r) => r);

// Current flow on every edge (for the network animation). Global scope is weighted by target aggregation.
export function edgeFlows(run, scope, t, out = new Float64Array(E)) {
  out.fill(0);
  t = Math.max(0, Math.min(run.T - 1, t));
  forEachContribution(run, t, scope >= 0 ? [scope] : ALL_REGIONS, (r, e, c) => {
    out[e.j] += scope >= 0 ? c : c * MODEL.nodes[e.ti].aggArr[r];
  });
  return out;
}

// Share of all causal pull at week t carried by premise shocks and by each evidence class.
export function evidenceMix(run, t) {
  t = Math.max(0, Math.min(run.T - 1, t));
  const acc = { P: 0, E: 0, A: 0, S: 0 };
  for (let i = t * RN; i < (t + 1) * RN; i++) { acc.P += Math.abs(run.ctx.P[i]); acc.S += Math.abs(run.ctx.S[i]); }
  forEachContribution(run, t, ALL_REGIONS, (r, e, c) => {
    const sv = run.x[(t - e.lag) * RN + r * N + e.si];
    acc[edgeBasis(e, sv)] += Math.abs(c);
  });
  const tot = acc.P + acc.E + acc.A + acc.S;
  if (tot < 1e-12) return { P: 0, E: 0, A: 0, S: 0, total: 0 };
  return { P: acc.P / tot, E: acc.E / tot, A: acc.A / tot, S: acc.S / tot, total: tot };
}

// ---------- KPIs ----------
export const KPI_DEFS = [
  { id: 'gdp', label: 'World output', node: 'gdp', fmt: 'pct' },
  { id: 'food_price', label: 'World food prices', node: 'food_price', fmt: 'pct' },
  { id: 'energy_price', label: 'World energy prices', node: 'energy_price', fmt: 'pct' },
  { id: 'trade', label: 'World trade volume', node: 'trade', fmt: 'pct' },
  { id: 'displaced', label: 'People displaced', fmt: 'people', formula: 'Sum over regions of population x displacement share.' },
  { id: 'foodStress', label: 'Living where food fell >5%', fmt: 'people', formula: 'Population of regions whose food availability is more than 5% below baseline. A regional count, not a count of hungry people.' },
  { id: 'cumOutput', label: 'Cumulative output change', fmt: 'usd', formula: 'Sum over weeks and regions of baseline GDP / 52 x output deviation, in 2023 US$.' },
];

function computeKpis(run) {
  const T = run.T, out = {};
  const nD = NODE_INDEX.displacement, nF = NODE_INDEX.food_supply, nG = NODE_INDEX.gdp;
  const variants = { c: run.x, s: run.xs, w: run.xw };
  for (const def of KPI_DEFS) {
    if (def.node) { out[def.id] = series(run, def.node, -1); continue; }
    const res = {};
    for (const [k, x] of Object.entries(variants)) {
      const a = new Float64Array(T + 1);
      let cum = 0;
      for (let t = 0; t <= T; t++) {
        let v = 0;
        for (let r = 0; r < R; r++) {
          const reg = REGIONS[r], b = t * RN + r * N;
          if (def.id === 'displaced') v += reg.pop * Math.max(0, x[b + nD]);
          else if (def.id === 'foodStress') v += x[b + nF] < -0.05 ? reg.pop : 0;
          else v += (reg.gdp * x[b + nG]) / 52;
        }
        if (def.id === 'cumOutput') { cum += v; a[t] = cum; } else a[t] = v;
      }
      res[k] = a;
    }
    const lo = new Float64Array(T + 1), hi = new Float64Array(T + 1);
    for (let t = 0; t <= T; t++) { lo[t] = Math.min(res.c[t], res.s[t], res.w[t]); hi[t] = Math.max(res.c[t], res.s[t], res.w[t]); }
    out[def.id] = { c: res.c, lo, hi };
  }
  return out;
}

// ---------- events ----------
// Threshold crossings. Class: 'estimated' (central run crosses, pathway confidence >= 0.5),
// 'speculative' (central run crosses, but mostly through assumption or speculative pathways),
// 'possible' (only the strong-transmission bound crosses).
export const EVENT_DEFS = [
  { id: 'g_shipping', node: 'shipping', op: '<', thr: -0.5, scope: 'g', title: 'Global shipping capacity halved' },
  { id: 'g_trade', node: 'trade', op: '<', thr: -0.2, scope: 'g', title: 'World trade volume down 20%' },
  { id: 'g_supply', node: 'supply_chain', op: '<', thr: -0.25, scope: 'g', title: 'Global supply chains severely disrupted' },
  { id: 'g_digital', node: 'digital', op: '<', thr: -0.5, scope: 'g', title: 'Most digital services offline' },
  { id: 'g_payments', node: 'finance', op: '<', thr: -0.3, scope: 'g', title: 'Payment systems widely failing' },
  { id: 'g_food1', node: 'food_price', op: '>', thr: 0.3, scope: 'g', title: 'World food prices up 30%' },
  { id: 'g_food2', node: 'food_price', op: '>', thr: 1.0, scope: 'g', title: 'World food prices double' },
  { id: 'g_en1', node: 'energy_price', op: '>', thr: 0.5, scope: 'g', title: 'World energy prices up 50%' },
  { id: 'g_en2', node: 'energy_price', op: '>', thr: 2.0, scope: 'g', title: 'Energy prices triple: rationing conditions' },
  { id: 'g_encheap', node: 'energy_price', op: '<', thr: -0.3, scope: 'g', title: 'World energy prices fall 30%', good: true },
  { id: 'g_fossildown', node: 'fossil_output', op: '<', thr: -0.15, scope: 'g', title: 'Fossil fuel production value in structural decline' },
  { id: 'g_clean2', node: 'clean', op: '>', thr: 1.0, scope: 'g', title: 'Clean energy output doubles', good: true },
  { id: 'g_rec', node: 'gdp', op: '<', thr: -0.03, scope: 'g', title: 'World output 3% below baseline (recession scale)' },
  { id: 'g_dep', node: 'gdp', op: '<', thr: -0.1, scope: 'g', title: 'World output 10% below baseline (depression scale)' },
  { id: 'g_boom', node: 'gdp', op: '>', thr: 0.03, scope: 'g', title: 'World output 3% above baseline', good: true },
  { id: 'g_poll', node: 'poll_crops', op: '<', thr: -0.2, scope: 'g', title: 'Pollinator-dependent harvests down 20%' },
  { id: 'g_nutr', node: 'nutrition', op: '<', thr: -0.06, scope: 'g', title: 'Global diet quality measurably declines' },
  { id: 'g_bio', node: 'biodiversity', op: '<', thr: -0.08, scope: 'g', title: 'Biodiversity intactness down 8%' },
  { id: 'g_ports', node: 'ports', op: '<', thr: -0.3, scope: 'g', title: 'Major share of port capacity lost' },
  { id: 'g_coop', node: 'cooperation', op: '<', thr: -0.15, scope: 'g', title: 'International cooperation breaking down' },
  { id: 'g_tension', node: 'tension', op: '>', thr: 0.15, scope: 'g', title: 'Interstate tension sharply elevated' },
  { id: 'g_clim', node: 'climate', op: '>', thr: 0.03, scope: 'g', title: 'Measurable added climate stress' },
  { id: 'r_food', node: 'food_supply', op: '<', thr: -0.1, scope: 'r', title: 'Food availability down 10%' },
  { id: 'r_water', node: 'water_sys', op: '<', thr: -0.2, scope: 'r', title: 'Water & sanitation failing' },
  { id: 'r_power', node: 'power', op: '<', thr: -0.25, scope: 'r', title: 'Grid reliability collapses' },
  { id: 'r_disp', node: 'displacement', op: '>', thr: 0.02, scope: 'r', title: '2% of population displaced' },
  { id: 'r_unrest', node: 'unrest', op: '>', thr: 0.15, scope: 'r', title: 'Widespread unrest' },
  { id: 'r_health', node: 'health', op: '<', thr: -0.05, scope: 'r', title: 'Population health deteriorating' },
  { id: 'r_gdp', node: 'gdp', op: '<', thr: -0.08, scope: 'r', title: 'Severe economic contraction' },
  { id: 'r_rain', node: 'rainfall', op: '<', thr: -0.08, scope: 'r', title: 'Persistent rainfall deficit' },
  { id: 'r_built', node: 'built', op: '<', thr: -0.04, scope: 'r', title: 'Coastal infrastructure being lost' },
];

function firstCross(get, op, thr, T) {
  for (let t = 0; t <= T; t++) { const v = get(t); if (op === '<' ? v < thr : v > thr) return t; }
  return -1;
}

function detectEvents(run) {
  const T = run.T, ev = [];
  ev.push({ id: 'premise', t: 0, region: -1, cls: 'premise', title: run.scenario.premise, node: null });
  if (run.cfg.branch) ev.push({ id: 'branch', t: run.cfg.branch.week, region: -1, cls: 'premise', title: 'Alternative future diverges here (branch point)', node: null });
  for (const d of EVENT_DEFS) {
    const n = NODE_INDEX[d.node];
    const scopes = d.scope === 'g' ? [-1] : ALL_REGIONS;
    for (const r of scopes) {
      const getC = r < 0 ? (t) => run.g[t * N + n] : (t) => run.x[t * RN + r * N + n];
      const tc = firstCross(getC, d.op, d.thr, T);
      if (tc >= 0) {
        const cf = r < 0 ? run.gConf[tc * N + n] : run.conf[tc * RN + r * N + n];
        ev.push({ id: d.id, t: tc, region: r, node: d.node, title: d.title, good: !!d.good, conf: cf, cls: cf >= 0.5 ? 'estimated' : 'speculative' });
        continue;
      }
      const getB = r < 0
        ? (t) => (d.op === '<' ? run.gLo : run.gHi)[t * N + n]
        : (t) => (d.op === '<' ? run.lo : run.hi)[t * RN + r * N + n];
      const tb = firstCross(getB, d.op, d.thr, T);
      if (tb >= 0) ev.push({ id: d.id, t: tb, region: r, node: d.node, title: d.title, good: !!d.good, conf: null, cls: 'possible' });
    }
  }
  ev.sort((a, b) => a.t - b.t || (a.region - b.region));
  return ev;
}

// ---------- counterfactual helpers ----------
export function compareAt(a, b, t) {
  const ta = Math.min(t, a.T), tb = Math.min(t, b.T);
  return KPI_DEFS.map((d) => ({ def: d, a: a.kpis[d.id].c[ta], b: b.kpis[d.id].c[tb], d: b.kpis[d.id].c[tb] - a.kpis[d.id].c[ta] }));
}

export function divergence(a, b, t) {
  const ta = Math.min(t, a.T), tb = Math.min(t, b.T);
  const out = MODEL.nodes.map((n) => ({ node: n, a: a.g[ta * N + n.i], b: b.g[tb * N + n.i] }));
  for (const o of out) o.d = o.b - o.a;
  return out.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
}

export { SCENARIOS, REGIONS, NODES, EDGES, BASIS };
