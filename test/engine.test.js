// Engine tests. Run with: node --test test/
// These exercise the simulation engine with no UI involved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  runScenario, drivers, edgeFlows, evidenceMix, profile, normalizeConfig,
  MODEL, NODE_INDEX, N, R, RN, SCENARIOS, REGIONS, NODES, EDGES, BASIS,
} from '../src/engine/engine.js';
import { SYSTEMS, REFS, edgeKey } from '../src/engine/model.js';
import { COUNTRY_REGION, UNMAPPED, REGION_INDEX } from '../src/engine/regions.js';

const g = (run, t, id) => run.g[t * N + NODE_INDEX[id]];
const x = (run, t, rid, id) => run.x[t * RN + REGION_INDEX[rid] * N + NODE_INDEX[id]];
const EPS = 1e-9;

const RUNS = Object.fromEntries(SCENARIOS.map((s) => [s.id, runScenario({ scenarioId: s.id })]));

test('model integrity: nodes, edges, evidence, references', () => {
  const sys = new Set(SYSTEMS.map((s) => s.id));
  const ids = new Set();
  for (const n of NODES) {
    assert.ok(sys.has(n.sys), `node ${n.id} has unknown system`);
    assert.ok(!ids.has(n.id), `duplicate node ${n.id}`);
    ids.add(n.id);
    assert.ok(n.min <= 0 && n.max >= 0, `node ${n.id} range must contain the baseline`);
    assert.ok([1, -1].includes(n.pol));
    assert.ok(MODEL.incoming[NODE_INDEX[n.id]].length + MODEL.outgoing[NODE_INDEX[n.id]].length > 0, `node ${n.id} is isolated`);
  }
  const keys = new Set();
  for (const e of EDGES) {
    const k = edgeKey(e);
    assert.ok(!keys.has(k), `duplicate edge ${k}`);
    keys.add(k);
    assert.ok(e.why && e.why.length > 20, `edge ${k} needs a rationale`);
    assert.ok(BASIS[e.b], `edge ${k} basis`);
    assert.ok(Number.isFinite(e.w) && e.lag >= 0, `edge ${k} weight/lag`);
    for (const r of e.ref || []) assert.ok(REFS[r], `edge ${k} cites unknown ref ${r}`);
    if (e.exp) for (const reg of REGIONS) assert.ok(Number.isFinite(reg[e.exp]), `region ${reg.id} lacks ${e.exp}`);
  }
  for (const s of SCENARIOS) for (const a of s.anchors) assert.ok(REFS[a.ref], `${s.id} anchor cites unknown ref ${a.ref}`);
});

test('determinism: identical configs give bit-identical trajectories', () => {
  for (const s of SCENARIOS) {
    const b = runScenario({ scenarioId: s.id });
    const a = RUNS[s.id];
    assert.equal(a.x.length, b.x.length);
    for (let i = 0; i < a.x.length; i++) if (a.x[i] !== b.x[i]) assert.fail(`${s.id}: differs at index ${i}`);
    assert.deepEqual(a.events, b.events);
  }
});

test('baseline: no shocks means no change anywhere, ever', () => {
  const none = { id: 'none', name: 'No change', premise: 'Nothing happens.', params: [], shocks: () => [], anchors: [], assumptions: [] };
  const run = runScenario({ scenario: none, params: { response: 'moderate' } });
  for (let i = 0; i < run.x.length; i++) assert.equal(run.x[i], 0);
  assert.equal(run.events.length, 1); // premise only
});

test('values stay finite and inside node bounds, including at parameter extremes', () => {
  const check = (run, label) => {
    for (let t = 0; t <= run.T; t++) for (let r = 0; r < R; r++) for (let n = 0; n < N; n++) {
      const v = run.x[t * RN + r * N + n], node = NODES[n];
      assert.ok(Number.isFinite(v), `${label}: non-finite ${node.id}`);
      assert.ok(v >= node.min - EPS && v <= node.max + EPS, `${label}: ${node.id}=${v} outside [${node.min}, ${node.max}]`);
    }
  };
  for (const s of SCENARIOS) {
    check(RUNS[s.id], s.id);
    for (const pick of ['min', 'max']) {
      const params = {};
      for (const p of s.params) params[p.id] = p.type === 'range' ? p[pick] : p.options[pick === 'min' ? 0 : p.options.length - 1].v;
      check(runScenario({ scenarioId: s.id, params }), `${s.id}@${pick}`);
    }
  }
});

test('uncertainty envelope always contains the central trajectory', () => {
  for (const [id, run] of Object.entries(RUNS)) {
    for (let i = 0; i < run.x.length; i++) {
      assert.ok(run.lo[i] <= run.x[i] + 1e-6 && run.hi[i] >= run.x[i] - 1e-6, `${id}: envelope excludes central at ${i}`);
    }
    for (let i = 0; i < run.g.length; i++) assert.ok(run.gLo[i] <= run.g[i] + EPS && run.gHi[i] >= run.g[i] - EPS);
  }
});

test('confidence scores are within [0, 1]', () => {
  for (const run of Object.values(RUNS)) {
    for (const v of run.conf) assert.ok(v >= 0 && v <= 1 + 1e-6);
    for (const v of run.gConf) assert.ok(v >= 0 && v <= 1 + 1e-6);
  }
});

test('causality: effects arrive only through edges and respect lags', () => {
  const run = RUNS.internet;
  for (let n = 0; n < N; n++) assert.equal(run.x[n], 0, 'T+0 is the untouched baseline');
  assert.ok(g(run, 1, 'internet') < -0.9, 'connectivity drops in the first week');
  assert.equal(g(run, 1, 'digital'), 0, 'digital services respond one step after connectivity');
  assert.equal(g(run, 2, 'finance'), 0, 'payments respond after digital services');
  assert.ok(g(run, 4, 'finance') < -0.1);
  for (let t = 0; t <= run.T; t++) assert.equal(g(run, t, 'forest'), 0, 'the Amazon is unreachable from an internet outage');
});

test('temporary shocks recover to baseline', () => {
  for (const id of ['internet', 'shipping']) {
    const run = RUNS[id];
    for (let n = 0; n < N; n++) assert.ok(Math.abs(run.g[run.T * N + n]) < 2e-3, `${id}: ${NODES[n].id} has not recovered`);
  }
});

test('monotonicity: a bigger shock never produces a smaller primary impact', () => {
  const pairs = [
    ['bees', 'loss', 50, 100, 'poll_crops'],
    ['shipping', 'cap', 40, 80, 'trade'],
    ['sealevel', 'rise', 2, 5, 'ports'],
    ['water', 'sev', 20, 50, 'freshwater'],
    ['fossil', 'share', 50, 100, 'energy_supply'],
  ];
  for (const [sid, pid, a, b, node] of pairs) {
    const ra = runScenario({ scenarioId: sid, params: { [pid]: a } });
    const rb = runScenario({ scenarioId: sid, params: { [pid]: b } });
    for (let t = 0; t <= ra.T; t++) assert.ok(g(rb, t, node) <= g(ra, t, node) + 1e-12, `${sid}: ${node} at t=${t}`);
    let gap = 0;
    for (let t = 0; t <= ra.T; t++) gap = Math.max(gap, g(ra, t, node) - g(rb, t, node));
    assert.ok(gap > 0.01, `${sid}: impact should grow with ${pid}`);
  }
});

test('counterfactual branch is identical to the original up to the branch week', () => {
  const week = 40;
  const a = runScenario({ scenarioId: 'fossil', params: { response: 'none' } });
  const b = runScenario({ scenarioId: 'fossil', params: { response: 'none' }, branch: { week, params: { response: 'strong' } } });
  for (let i = 0; i < (week + 1) * RN; i++) assert.equal(a.x[i], b.x[i], `diverged before the branch at index ${i}`);
  assert.ok(g(b, 520, 'gdp') > g(a, 520, 'gdp') + 0.01, 'a stronger response after the branch should improve output');
  assert.ok(b.events.some((e) => e.id === 'branch' && e.t === week));
});

test('inspector explanation is faithful: driver items reproduce the simulated update', () => {
  for (const [id, run] of Object.entries(RUNS)) {
    for (const t of [3, 30, 150, 400]) {
      for (let r = 0; r < R; r += 3) {
        for (const node of MODEL.nodes) {
          const d = drivers(run, node.id, r, t);
          const clamped = Math.min(node.max, Math.max(node.min, d.total));
          const cur = run.x[t * RN + r * N + node.i];
          const expected = cur + (clamped - cur) * node.k;
          const actual = run.x[(t + 1) * RN + r * N + node.i];
          assert.ok(Math.abs(expected - actual) < 1e-9, `${id} ${node.id} r${r} t${t}: drivers ${expected} vs sim ${actual}`);
        }
      }
    }
  }
});

test('scenario directions match established relationships', () => {
  const f = RUNS.fossil;
  assert.ok(g(f, 26, 'energy_price') > 0.5 && g(f, 52, 'food_supply') < -0.05 && g(f, 52, 'freight') < -0.3);
  const c = RUNS.clean;
  assert.ok(g(c, 520, 'energy_price') < -0.2, 'clean abundance lowers energy prices');
  assert.ok(x(c, 520, 'mena', 'fossil_output') < -0.1, 'hydrocarbon producers lose production value');
  assert.ok(x(c, 520, 'mena', 'gdp') < x(c, 520, 'eur', 'gdp'), 'exporters gain less than importers');
  assert.equal(g(c, 520, 'shipping') >= -1e-6, true, 'demand-driven fossil decline must not starve shipping of fuel');
  const b = RUNS.bees;
  assert.ok(Math.abs(g(b, 520, 'poll_crops')) > 5 * Math.abs(g(b, 520, 'staple_yield')), 'wind-pollinated staples are barely affected');
  assert.ok(g(b, 520, 'nutrition') < -0.05);
  const a = RUNS.amazon;
  assert.ok(x(a, 520, 'lat', 'rainfall') < -0.05);
  assert.equal(x(a, 520, 'eas', 'rainfall'), 0, 'no modelled moisture link to East Asia');
  const sl = RUNS.sealevel;
  assert.ok(x(sl, 520, 'sea', 'displacement') > x(sl, 520, 'rca', 'displacement'));
  const w = RUNS.water;
  assert.ok(x(w, 520, 'mena', 'freshwater') < x(w, 520, 'lat', 'freshwater'), 'stress-weighted shortage hits MENA harder');
  const none = runScenario({ scenarioId: 'fossil', params: { response: 'none' } });
  const strong = runScenario({ scenarioId: 'fossil', params: { response: 'strong' } });
  assert.ok(g(strong, 520, 'gdp') > g(none, 520, 'gdp'));
});

test('repair pathways never lift a node above baseline', () => {
  for (const run of Object.values(RUNS)) {
    for (const id of ['poll_crops', 'ports']) {
      for (let t = 0; t <= run.T; t++) for (let r = 0; r < R; r++) assert.ok(run.x[t * RN + r * N + NODE_INDEX[id]] <= 1e-9);
    }
  }
});

test('events are well-formed and ordered', () => {
  for (const run of Object.values(RUNS)) {
    assert.equal(run.events[0].cls, 'premise');
    let last = 0;
    for (const e of run.events) {
      assert.ok(['premise', 'estimated', 'speculative', 'possible'].includes(e.cls));
      assert.ok(e.t >= last && e.t <= run.T);
      last = e.t;
    }
  }
});

test('evidence mix and edge flows are consistent', () => {
  for (const run of Object.values(RUNS)) {
    const m = evidenceMix(run, 100);
    if (m.total > 0) assert.ok(Math.abs(m.P + m.E + m.A + m.S - 1) < 1e-9);
    const flows = edgeFlows(run, -1, 100);
    assert.equal(flows.length, EDGES.length);
    for (const v of flows) assert.ok(Number.isFinite(v));
  }
});

test('profile envelope: ramp, hold and recovery', () => {
  const p = { ramp: 4, hold: 10, recover: 5 };
  assert.equal(profile(-1, p), 0);
  assert.equal(profile(3, p), 1);
  assert.equal(profile(13, p), 1);
  assert.ok(profile(15, p) < 1 && profile(15, p) > 0);
  assert.equal(profile(30, p), 0);
  assert.equal(profile(0, { ramp: 1 }), 1, 'instant shocks act from T+0');
});

test('config normalization clamps parameters', () => {
  const { cfg } = normalizeConfig({ scenarioId: 'bees', params: { loss: 500, response: 'bogus' } });
  assert.equal(cfg.params.loss, 100);
  assert.equal(cfg.params.response, 'moderate');
  assert.throws(() => normalizeConfig({ scenarioId: 'nope' }));
});

test('every country in the map dataset belongs to a region', () => {
  const atlas = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url)));
  for (const geo of atlas.objects.countries.geometries) {
    const name = geo.properties.name;
    if (UNMAPPED.includes(name)) continue;
    assert.ok(COUNTRY_REGION[name], `unmapped country: ${name}`);
  }
});

test('performance: a full run (three variants) completes quickly', () => {
  const t0 = performance.now();
  runScenario({ scenarioId: 'fossil' });
  assert.ok(performance.now() - t0 < 1500);
});
