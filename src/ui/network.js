// Animated causal network: nodes on a ring grouped by system, edges as bundled curves.
// Edge stroke = evidence class. Moving particles = current causal flow (warm = harm, teal = benefit).
import { MODEL, NODE_INDEX, N, RN, edgeFlows, E } from '../engine/engine.js';
import { SYSTEMS } from '../engine/model.js';
import { setupCanvas, sevColor, EVIDENCE, HARM, GOOD, SYS, reducedMotion, fmtNode } from './format.js';

const SHORT = {
  pollinators: 'Pollination', forest: 'Amazon forest', rainfall: 'Rainfall', freshwater: 'Freshwater', coast: 'Coastal land',
  biodiversity: 'Biodiversity', climate: 'Climate stress', staple_yield: 'Staple yields', poll_crops: 'Pollinator crops',
  fertilizer: 'Fertilizer', food_supply: 'Food availability', food_price: 'Food prices', nutrition: 'Diet quality',
  fossil: 'Fossil fuel supply', fossil_output: 'Fossil revenue', clean: 'Clean energy', energy_supply: 'Energy supply',
  energy_price: 'Energy prices', power: 'Grid reliability', shipping: 'Shipping', freight: 'Land & air freight', ports: 'Ports',
  trade: 'Trade', supply_chain: 'Supply chains', industry: 'Industry', finance: 'Payments', gdp: 'Output (GDP)',
  inflation: 'Inflation', employment: 'Employment', internet: 'Internet', digital: 'Digital services', innovation: 'Adaptation',
  water_sys: 'Water & sanitation', built: 'Built environment', rebuild: 'Reconstruction', healthcare: 'Healthcare',
  health: 'Health', displacement: 'Displacement', unrest: 'Unrest', wellbeing: 'Wellbeing', resource_comp: 'Resource competition',
  tension: 'Interstate tension', cooperation: 'Cooperation',
};
const ORDER = SYSTEMS.flatMap((s) => MODEL.nodes.filter((n) => n.sys === s.id));
const GAP = 1.1;

function nodeValue(run, n, scope, t) {
  const t0 = Math.floor(t), t1 = Math.min(run.T, t0 + 1), f = t - t0;
  if (scope < 0) return run.g[t0 * N + n] * (1 - f) + run.g[t1 * N + n] * f;
  return run.x[t0 * RN + scope * N + n] * (1 - f) + run.x[t1 * RN + scope * N + n] * f;
}

export class Network {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.opts = opts;
    this.run = null; this.t = 0; this.scope = -1; this.sel = null; this.hover = null;
    this.flows = new Float64Array(E); this.flowT = -1;
    this.maxFlow = 0.01; this.layoutKey = '';
    this.bind();
  }
  setRun(run) {
    this.run = run; this.flowT = -1;
    // run-level flow scale so small effects look small
    let m = 0.002;
    if (run) for (let t = 1; t < run.T; t += Math.max(1, Math.floor(run.T / 40))) {
      const f = edgeFlows(run, -1, t);
      for (let j = 0; j < f.length; j++) m = Math.max(m, Math.abs(f[j]));
    }
    this.maxFlow = m;
    this.nodeScale = MODEL.nodes.map((node) => {
      if (!run) return 1;
      let mm = 0; for (let t = 0; t <= run.T; t += 4) mm = Math.max(mm, Math.abs(run.g[t * N + node.i]));
      return Math.max(mm, 0.01);
    });
  }
  setTime(t) { this.t = t; }
  setScope(s) { this.scope = s; this.flowT = -1; }
  setSelected(sel) { this.sel = sel; }

  layout(w, h, ctx) {
    const key = `${w}x${h}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.fontPx = w < 520 ? 9.5 : 10.5;
    ctx.font = `600 ${this.fontPx}px "Archivo", system-ui, sans-serif`;
    const label = Math.max(...MODEL.nodes.map((n) => ctx.measureText(SHORT[n.id] || n.label).width)) + 22;
    // Nodes sit on an ellipse fitted to the pane, so tall or wide panes both keep room for labels.
    const cx = w / 2, cy = h / 2 + 4;
    let rx = Math.max(56, w / 2 - label), ry = Math.max(56, h / 2 - label + 12);
    rx = Math.min(rx, ry * 2.2); ry = Math.min(ry, rx * 2.2);
    const slots = ORDER.length + SYSTEMS.length * GAP;
    // equal arc-length spacing: tabulate the ellipse perimeter, then invert it
    const M = 720, cum = new Float64Array(M + 1);
    const pt = (u) => [rx * Math.cos(u), ry * Math.sin(u)];
    const u0 = -Math.PI / 2;
    for (let k = 1; k <= M; k++) {
      const [x0, y0] = pt(u0 + ((k - 1) / M) * Math.PI * 2), [x1, y1] = pt(u0 + (k / M) * Math.PI * 2);
      cum[k] = cum[k - 1] + Math.hypot(x1 - x0, y1 - y0);
    }
    const perim = cum[M];
    const paramAt = (s) => {
      s = ((s % perim) + perim) % perim;
      let lo = 0, hi = M;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] < s) lo = mid; else hi = mid; }
      const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
      return u0 + ((lo + f) / M) * Math.PI * 2;
    };
    const step = perim / slots;
    let s = step * GAP / 2;
    this.pos = new Array(N);
    this.sysArcs = [];
    for (const sys of SYSTEMS) {
      const nodes = ORDER.filter((n) => n.sys === sys.id);
      const s0 = s;
      for (const n of nodes) {
        const u = paramAt(s);
        const x = cx + rx * Math.cos(u), y = cy + ry * Math.sin(u);
        this.pos[n.i] = { a: Math.atan2(y - cy, x - cx), x, y };
        s += step;
      }
      this.sysArcs.push({ s: sys, a0: paramAt(s0 - step * 0.4), a1: paramAt(s - step * 0.6) });
      s += step * GAP;
    }
    for (const arc of this.sysArcs) if (arc.a1 < arc.a0) arc.a1 += Math.PI * 2;
    this.geom = { cx, cy, rx, ry };
    this.slotPx = step;
  }

  ctrl(e) {
    const p = this.pos[e.si], q = this.pos[e.ti], { cx, cy } = this.geom;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const k = 0.18;
    return [cx + (mx - cx) * k, cy + (my - cy) * k];
  }
  bez(e, u) {
    const p = this.pos[e.si], q = this.pos[e.ti], [qx, qy] = this.ctrl(e);
    const v = 1 - u;
    return [v * v * p.x + 2 * v * u * qx + u * u * q.x, v * v * p.y + 2 * v * u * qy + u * u * q.y];
  }

  bind() {
    const c = this.c;
    c.addEventListener('pointermove', (ev) => this.pick(ev, false));
    c.addEventListener('click', (ev) => this.pick(ev, true));
    c.addEventListener('pointerleave', () => { this.hover = null; this.opts.onHover && this.opts.onHover(null); });
  }

  pick(ev, click) {
    if (!this.pos || !this.run) return;
    const r = this.c.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 11;
    for (const n of MODEL.nodes) {
      const p = this.pos[n.i], d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = { type: 'node', id: n.id, n }; }
    }
    if (!best) {
      bd = 6;
      const selN = this.sel && this.sel.type === 'node' ? NODE_INDEX[this.sel.id] : -1;
      for (const e of MODEL.edges) {
        const active = Math.abs(this.flows[e.j]) > this.maxFlow * 0.02 || e.si === selN || e.ti === selN;
        if (!active) continue;
        for (let k = 1; k < 20; k++) {
          const [px, py] = this.bez(e, k / 20);
          const d = Math.hypot(px - x, py - y);
          if (d < bd) { bd = d; best = { type: 'edge', id: e.key, e }; }
        }
      }
    }
    this.hover = best;
    this.c.style.cursor = best ? 'pointer' : 'default';
    if (click) { if (best) this.opts.onSelect && this.opts.onSelect({ type: best.type, id: best.id }); return; }
    if (!this.opts.onHover) return;
    if (!best) { this.opts.onHover(null); return; }
    if (best.type === 'node') {
      const v = nodeValue(this.run, best.n.i, this.scope, this.t);
      this.opts.onHover({ x: ev.clientX, y: ev.clientY, html: `<b>${best.n.label}</b><span>${SYS[best.n.sys].label}</span><span>Now: <em>${fmtNode(best.n, v)}</em></span><span class="tip-hint">Click to inspect causes</span>` });
    } else {
      const e = best.e, a = MODEL.nodes[e.si], b = MODEL.nodes[e.ti];
      this.opts.onHover({ x: ev.clientX, y: ev.clientY, html: `<b>${a.label} → ${b.label}</b><span>${EVIDENCE[e.b].label}</span><span>Current pull: <em>${(this.flows[e.j] * 100).toFixed(2)} pts</em></span><span class="tip-hint">Click to inspect this link</span>` });
    }
  }

  frame(now) {
    const { ctx, w, h } = setupCanvas(this.c);
    if (w < 40 || h < 40) return;
    this.layout(w, h, ctx);
    ctx.clearRect(0, 0, w, h);
    const run = this.run;
    const { cx, cy, rx, ry } = this.geom;
    const anim = reducedMotion() ? 0 : now;

    if (run) {
      const tw = Math.floor(this.t);
      if (tw !== this.flowT) { edgeFlows(run, this.scope, Math.max(0, tw), this.flows); this.flowT = tw; }
    }
    const selN = this.sel && this.sel.type === 'node' ? NODE_INDEX[this.sel.id] : -1;
    const selE = this.sel && this.sel.type === 'edge' ? this.sel.id : null;
    const focus = selN >= 0 || selE;

    // system arcs
    for (const { s, a0, a1 } of this.sysArcs) {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx - 13, ry - 13, 0, a0, a1);
      ctx.strokeStyle = s.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      const am = (a0 + a1) / 2;
      ctx.save();
      const sx = cx + (rx - 26) * Math.cos(am), sy = cy + (ry - 26) * Math.sin(am);
      ctx.translate(sx, sy);
      const th = Math.atan2(sy - cy, sx - cx);
      let rot = th + Math.PI / 2;
      if (Math.sin(th) > 0) rot += Math.PI;
      ctx.rotate(rot);
      ctx.font = '600 9px "Archivo", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = s.color; ctx.globalAlpha = 0.85;
      ctx.fillText(s.label.toUpperCase(), 0, 0);
      ctx.restore(); ctx.globalAlpha = 1;
    }

    // edges
    const mf = this.maxFlow;
    for (const e of MODEL.edges) {
      const f = this.flows[e.j];
      const nf = Math.min(1, Math.sqrt(Math.abs(f) / mf));
      const related = e.si === selN || e.ti === selN || e.key === selE;
      let alpha = 0.06 + 0.6 * nf;
      if (focus) alpha = related ? Math.max(0.55, alpha) : alpha * 0.18;
      if (alpha < 0.03) continue;
      const p = this.pos[e.si], q = this.pos[e.ti], [qx, qy] = this.ctrl(e);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(qx, qy, q.x, q.y);
      ctx.strokeStyle = EVIDENCE[e.b].color; ctx.globalAlpha = alpha;
      ctx.lineWidth = (related && focus ? 1.2 : 0.6) + 2.4 * nf;
      ctx.setLineDash(e.b === 'S' ? [3, 4] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // particles
    if (run) {
      for (const e of MODEL.edges) {
        const f = this.flows[e.j];
        const nf = Math.min(1, Math.sqrt(Math.abs(f) / mf));
        if (nf < 0.06) continue;
        const related = e.si === selN || e.ti === selN || e.key === selE;
        if (focus && !related) continue;
        const harmful = f * MODEL.nodes[e.ti].pol < 0;
        ctx.fillStyle = harmful ? HARM : GOOD;
        const k = 1 + Math.round(3 * nf);
        const speed = 0.00018 + 0.00035 * nf;
        for (let i = 0; i < k; i++) {
          const u = anim ? ((anim * speed + i / k + e.j * 0.137) % 1) : (i + 0.5) / k;
          const [x, y] = this.bez(e, u);
          ctx.globalAlpha = 0.35 + 0.65 * Math.sin(Math.PI * u);
          ctx.beginPath(); ctx.arc(x, y, 1.1 + 1.4 * nf, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // nodes + labels
    ctx.textBaseline = 'middle';
    for (const n of MODEL.nodes) {
      const p = this.pos[n.i];
      const v = run ? nodeValue(run, n.i, this.scope, this.t) : 0;
      const sev = n.pol * v;
      const norm = run ? Math.min(1, Math.abs(v) / (this.nodeScale[n.i] || 1)) : 0;
      const active = Math.abs(v) > 0.002;
      const rad = 3.6 + (active ? 5.5 * Math.sqrt(norm) : 0);
      const isSel = n.i === selN;
      const dim = focus && !isSel && !(selN >= 0 && MODEL.edges.some((e) => (e.si === selN && e.ti === n.i) || (e.ti === selN && e.si === n.i)));
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = active ? sevColor(sev, this.nodeScale[n.i] * 1.05) : '#1a2433';
      ctx.fill();
      ctx.lineWidth = isSel ? 2 : 1.2;
      ctx.strokeStyle = isSel ? '#f4f1e8' : SYS[n.sys].color;
      ctx.stroke();
      if (this.hover && this.hover.type === 'node' && this.hover.n === n) {
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(244,241,232,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // label (on small rings only the active, selected or hovered variables are labelled)
      const hovered = this.hover && this.hover.type === 'node' && this.hover.n === n;
      if (!(this.slotPx >= 14 || isSel || hovered || (active && norm > 0.2))) { ctx.globalAlpha = 1; continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      const left = Math.cos(p.a) < 0;
      ctx.rotate(left ? p.a + Math.PI : p.a);
      ctx.textAlign = left ? 'right' : 'left';
      ctx.font = `${isSel || active ? 600 : 400} ${this.fontPx}px "Archivo", system-ui, sans-serif`;
      ctx.fillStyle = isSel ? '#f4f1e8' : active ? '#c9d4e2' : '#6f7f95';
      ctx.fillText(SHORT[n.id] || n.label, left ? -rad - 6 : rad + 6, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
