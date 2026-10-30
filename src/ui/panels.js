// DOM panels: scenario picker, parameters, indicators, inspector (expandable causal tree), consequences.
import {
  MODEL, NODE_INDEX, N, RN, KPI_DEFS, drivers, evidenceMix, series, confidence, edgeFlows, RESPONSE,
} from '../engine/engine.js';
import { SCENARIOS, defaultParams } from '../engine/scenarios.js';
import { REGIONS, FIELD_DOCS } from '../engine/regions.js';
import { REFS, BASIS } from '../engine/model.js';
import {
  el, EVIDENCE, OUTCOME, SYS, chip, fmtNode, fmtKpi, fmtWeek, fmtSpan, confLabel, icon, sevColor, HARM, GOOD,
} from './format.js';
import { sparkline, chart } from './charts.js';

const KPI_POL = { gdp: 1, food_price: -1, energy_price: -1, trade: 1, displaced: -1, foodStress: -1, cumOutput: 1 };
const pp = (v) => { const a = Math.abs(v * 100); return a < 0.005 ? '0 pp' : `${v > 0 ? '+' : '−'}${a.toFixed(a < 1 ? 2 : 1)} pp`; };
const scopeName = (s) => (s < 0 ? 'World' : REGIONS[s].name);

// ---------- left: scenarios & parameters ----------
export function renderScenarioList(root, app) {
  root.replaceChildren(...SCENARIOS.map((s) => el('li', {},
    el('button', {
      class: 'scn' + (s.id === app.S.scenarioId ? ' on' : ''), type: 'button', 'aria-pressed': String(s.id === app.S.scenarioId),
      onclick: () => app.selectScenario(s.id),
    }, icon(s.glyph, 18), el('span', { class: 'scn-name' }, s.name)))));
}

export function paramControls(scn, params, onChange, idPrefix = 'p') {
  return scn.params.map((p) => {
    const id = `${idPrefix}-${scn.id}-${p.id}`;
    if (p.type === 'select') {
      const sel = el('select', { id, onchange: (e) => onChange(p.id, e.target.value) },
        ...p.options.map((o) => el('option', { value: o.v, selected: params[p.id] === o.v }, o.l)));
      return el('div', { class: 'field' }, el('label', { for: id, title: p.doc }, p.label), sel, el('p', { class: 'field-doc' }, p.doc));
    }
    const out = el('output', { for: id }, `${params[p.id]} ${p.unit}`);
    const input = el('input', {
      id, type: 'range', min: p.min, max: p.max, step: p.step, value: params[p.id],
      oninput: (e) => { out.textContent = `${e.target.value} ${p.unit}`; onChange(p.id, Number(e.target.value)); },
    });
    return el('div', { class: 'field' }, el('div', { class: 'field-row' }, el('label', { for: id }, p.label), out), input, el('p', { class: 'field-doc' }, p.doc));
  });
}

export function renderParams(root, app) {
  const scn = SCENARIOS.find((s) => s.id === app.S.scenarioId);
  root.replaceChildren(
    el('p', { class: 'premise' }, scn.premise),
    ...paramControls(scn, app.S.params, (k, v) => app.setParam(k, v)),
    el('p', { class: 'caveat' }, el('b', {}, 'Plausibility: '), scn.caveat),
  );
}

// ---------- right: indicators ----------
export function renderKpis(root, app) {
  const run = app.S.run;
  const cards = KPI_DEFS.map((d) => el('div', { class: 'kpi', 'data-kpi': d.id, title: d.formula || '' },
    el('div', { class: 'kpi-top' }, el('span', { class: 'kpi-label' }, d.label), el('span', { class: 'kpi-val' }, '–')),
    el('canvas', { class: 'spark' }),
    el('div', { class: 'kpi-band' }, ''),
  ));
  const mix = el('section', { class: 'mix' },
    el('h3', {}, 'What this moment rests on'),
    el('div', { class: 'mixbar', id: 'mixbar' }),
    el('ul', { class: 'mixlegend', id: 'mixlegend' }),
    el('p', { class: 'note' }, 'Share of all causal pull acting this week that comes from your premise and from each kind of link. More violet means more speculation.'));
  const focus = el('section', { class: 'focus' }, el('h3', {}, 'Scenario focus'),
    el('div', { class: 'focus-list' }, ...run.scenario.focus.map((id) => {
      const n = MODEL.nodes[NODE_INDEX[id]];
      return el('button', { class: 'focus-row', type: 'button', 'data-node': id, onclick: () => app.select({ type: 'node', id }) },
        el('span', { class: 'sysdot', style: { background: SYS[n.sys].color } }), el('span', { class: 'fr-label' }, n.label),
        el('span', { class: 'fr-val' }, '–'), el('span', { class: 'fr-conf' }, ''));
    })));
  root.replaceChildren(el('div', { class: 'kpis' }, ...cards), mix, focus);
  updateKpis(root, app);
}

export function updateKpis(root, app) {
  const run = app.S.run; if (!run) return;
  const t = Math.min(run.T, Math.round(app.S.t));
  for (const d of KPI_DEFS) {
    const card = root.querySelector(`[data-kpi="${d.id}"]`); if (!card) continue;
    const k = run.kpis[d.id];
    const v = k.c[t];
    const valEl = card.querySelector('.kpi-val');
    valEl.textContent = fmtKpi(d, v);
    valEl.style.color = Math.abs(v) < 1e-4 ? '' : v * KPI_POL[d.id] < 0 ? HARM : GOOD;
    card.querySelector('.kpi-band').textContent = Math.abs(k.hi[t] - k.lo[t]) < 1e-6 ? 'no spread' : `range ${fmtKpi(d, k.lo[t])} to ${fmtKpi(d, k.hi[t])}`;
    sparkline(card.querySelector('canvas'), k, t, { pol: KPI_POL[d.id], T: run.T });
  }
  const mix = evidenceMix(run, t);
  const bar = root.querySelector('#mixbar'), leg = root.querySelector('#mixlegend');
  if (bar) {
    const parts = [['P', mix.P], ['E', mix.E], ['A', mix.A], ['S', mix.S]];
    bar.replaceChildren(...parts.map(([k, v]) => el('i', { style: { width: `${(v * 100).toFixed(1)}%`, background: EVIDENCE[k].color }, title: `${EVIDENCE[k].label}: ${(v * 100).toFixed(0)}%` })));
    leg.replaceChildren(...parts.map(([k, v]) => el('li', {}, el('span', { class: 'sw', style: { background: EVIDENCE[k].color } }), EVIDENCE[k].short, el('b', {}, mix.total ? `${(v * 100).toFixed(0)}%` : '–'))));
  }
  for (const row of root.querySelectorAll('.focus-row')) {
    const id = row.dataset.node, n = MODEL.nodes[NODE_INDEX[id]];
    const v = run.g[t * N + n.i];
    const vEl = row.querySelector('.fr-val');
    vEl.textContent = fmtNode(n, v);
    vEl.style.color = Math.abs(v) < 1e-4 ? '' : n.pol * v < 0 ? HARM : GOOD;
    const c = Math.abs(v) > 1e-4 ? confidence(run, id, -1, t) : null;
    row.querySelector('.fr-conf').replaceChildren(c == null ? '' : el('span', { class: 'confpip', style: { '--c': c }, title: `Pathway confidence ${(c * 100).toFixed(0)}%: ${confLabel(c)}` }));
  }
}

// ---------- right: inspector ----------
export function renderInspector(root, app) {
  const { run, sel } = app.S;
  if (!run) return;
  if (!sel) { root.replaceChildren(emptyInspector(app)); return; }
  if (sel.type === 'node') root.replaceChildren(nodeInspector(app, sel.id));
  else if (sel.type === 'edge') root.replaceChildren(edgeInspector(app, sel.id));
  else if (sel.type === 'region') root.replaceChildren(regionInspector(app, sel.id));
}

function emptyInspector(app) {
  return el('div', { class: 'insp-empty' },
    el('h3', {}, 'Inspect any part of the model'),
    el('p', {}, 'Click a variable or link in the causal network, a region on the globe, or an event on the timeline. The inspector shows what is pulling that variable right now, through which links, and how well each link is supported.'),
    el('div', { class: 'quick' }, ...app.S.run.scenario.focus.slice(0, 4).map((id) => el('button', { class: 'ghost', type: 'button', onclick: () => app.select({ type: 'node', id }) }, MODEL.nodes[NODE_INDEX[id]].label))));
}

function scopeBar(app) {
  const s = app.S.scope;
  return el('div', { class: 'scopebar' },
    el('span', { class: 'eyebrow' }, 'Scope'),
    el('button', { class: 'seg' + (s < 0 ? ' on' : ''), type: 'button', onclick: () => app.setScope(-1) }, 'World'),
    s >= 0 ? el('button', { class: 'seg on', type: 'button' }, REGIONS[s].name) : el('span', { class: 'hint' }, 'or click a region on the globe'));
}

function nodeInspector(app, id) {
  const { run, scope } = app.S;
  const t = Math.min(run.T - 1, Math.round(app.S.t));
  const n = MODEL.nodes[NODE_INDEX[id]];
  const s = series(run, id, scope);
  const v = s.c[t];
  const c = Math.abs(v) > 1e-4 ? confidence(run, id, scope, t) : null;
  const cv = el('canvas', { class: 'insp-chart' });
  const wrap = el('div', { class: 'insp' },
    scopeBar(app),
    el('div', { class: 'insp-head' },
      el('span', { class: 'eyebrow', style: { color: SYS[n.sys].color } }, `${SYS[n.sys].label} · variable`),
      el('h2', {}, n.label), el('p', {}, n.desc)),
    el('div', { class: 'insp-val' },
      el('span', { class: 'big', style: { color: Math.abs(v) < 1e-4 ? '' : n.pol * v < 0 ? HARM : GOOD } }, fmtNode(n, v)),
      el('span', { class: 'vsub' }, `${scopeName(scope)} at ${fmtWeek(t)} · sensitivity range ${fmtNode(n, s.lo[t])} to ${fmtNode(n, s.hi[t])}`)),
    c == null ? el('p', { class: 'note' }, 'No change from baseline at this moment.') : el('div', { class: 'confrow' },
      el('span', { class: 'eyebrow' }, 'Pathway confidence'),
      el('span', { class: 'confbar' }, el('i', { style: { width: `${(c * 100).toFixed(0)}%` } })),
      el('span', { class: 'confnum' }, `${(c * 100).toFixed(0)}%`),
      el('span', { class: 'conftxt' }, `${OUTCOME[c >= 0.5 ? 'estimated' : 'speculative'].label}: ${confLabel(c)}`)),
    cv,
    el('h3', {}, 'What is pulling it now'),
    el('p', { class: 'note' }, 'Contributions to the level this variable is moving toward, in percentage points. Expand a row to see what drives that cause in turn.'),
    driverTree(app, id, scope, t, 0, ''),
    el('h3', {}, 'What it pushes on'),
    outgoingList(app, n, scope, t),
    el('details', { class: 'meta' }, el('summary', {}, 'Variable definition'),
      el('dl', {},
        el('dt', {}, 'Unit'), el('dd', {}, { rel: 'Relative change from baseline', share: 'Share of population', idx: 'Pressure index (points)' }[n.unit]),
        el('dt', {}, 'Better when'), el('dd', {}, n.pol > 0 ? 'Higher' : 'Lower'),
        el('dt', {}, 'Adjustment time'), el('dd', {}, `${n.tau} weeks (model assumption)`),
        el('dt', {}, 'Allowed range'), el('dd', {}, `${fmtNode(n, n.min)} to ${fmtNode(n, n.max)}`),
        el('dt', {}, 'Global coupling'), el('dd', {}, n.cpl ? `${(n.cpl * 100).toFixed(0)}% ${n.cmode === 'sum' ? '(global commons: contributions add up)' : `toward the world mean weighted by ${n.cw}`}` : 'None (regional)'),
      )),
  );
  requestAnimationFrame(() => chart(cv, [{ s, color: n.pol > 0 ? '#e9b55a' : '#e9b55a' }], t, { T: run.T, fmt: (x) => fmtNode(n, x) }));
  return wrap;
}

function driverTree(app, id, scope, t, depth, path) {
  const run = app.S.run;
  const d = drivers(run, id, scope, t);
  const n = d.node;
  const box = el('div', { class: 'tree' });
  const max = Math.max(1e-6, ...d.items.map((it) => Math.abs(it.value)));
  const items = d.items.slice(0, depth === 0 ? 12 : 6);
  if (!items.length) box.append(el('p', { class: 'note' }, 'Nothing is pulling this variable at this moment.'));
  for (const it of items) {
    const key = it.kind === 'edge' ? `${path}/${it.e.key}` : `${path}/${it.kind}${it.basis}`;
    const harmful = it.value * n.pol < 0;
    const w = (Math.abs(it.value) / max) * 50;
    const bar = el('span', { class: 'drv-bar' }, el('i', { class: harmful ? 'harm' : 'good', style: it.value < 0 ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` } }));
    let label, basis, expandable = false;
    if (it.kind === 'shock') { label = it.basis === 'S' ? 'Premise side-effect (speculative)' : 'Your premise (direct shock)'; basis = it.basis; }
    else if (it.kind === 'coupling') { label = 'Imported through world markets'; basis = 'A'; }
    else {
      const src = MODEL.nodes[it.e.si];
      label = src.label; basis = it.basis;
      expandable = depth < 4 && MODEL.incoming[src.i].length > 0;
    }
    const open = expandable && app.expanded.has(key);
    const row = el('div', { class: 'drv', style: { '--d': depth } },
      expandable ? el('button', { class: 'tw', type: 'button', 'aria-expanded': String(open), 'aria-label': `Expand causes of ${label}`, onclick: () => app.toggleExpand(key) }, open ? '▾' : '▸') : el('span', { class: 'tw-sp' }),
      it.kind === 'edge'
        ? el('button', { class: 'drv-name linky', type: 'button', title: 'Inspect this link', onclick: () => app.select({ type: 'edge', id: it.e.key }) }, label)
        : el('span', { class: 'drv-name' }, label),
      chip(basis),
      bar,
      el('span', { class: 'drv-val' }, pp(it.value)));
    box.append(row);
    if (open) box.append(driverTree(app, MODEL.nodes[it.e.si].id, scope, Math.max(0, it.tl), depth + 1, key));
  }
  if (depth === 0 && Math.abs(d.total) > 1e-6) {
    box.append(el('div', { class: 'drv drv-total' }, el('span', { class: 'tw-sp' }), el('span', { class: 'drv-name' }, 'Net pull'), el('span'), el('span'), el('span', { class: 'drv-val' }, pp(d.total))));
  }
  return box;
}

function outgoingList(app, n, scope, t) {
  const run = app.S.run;
  const flows = edgeFlows(run, scope, t);
  const out = MODEL.outgoing[n.i].map((e) => ({ e, f: flows[e.j] })).sort((a, b) => Math.abs(b.f) - Math.abs(a.f));
  return el('div', { class: 'tree' }, ...out.map(({ e, f }) => {
    const tgt = MODEL.nodes[e.ti];
    return el('div', { class: 'drv' }, el('span', { class: 'tw-sp' }),
      el('button', { class: 'drv-name linky', type: 'button', onclick: () => app.select({ type: 'edge', id: e.key }) }, `→ ${tgt.label}`),
      chip(e.b), el('span'), el('span', { class: 'drv-val', style: { color: Math.abs(f) < 1e-6 ? '' : f * tgt.pol < 0 ? HARM : GOOD } }, pp(f)));
  }));
}

function edgeInspector(app, key) {
  const { run, scope } = app.S;
  const e = MODEL.edges.find((x) => x.key === key);
  const a = MODEL.nodes[e.si], b = MODEL.nodes[e.ti];
  const t = Math.min(run.T - 1, Math.round(app.S.t));
  const T = run.T;
  const flow = new Float64Array(T + 1), buf = new Float64Array(MODEL.edges.length);
  for (let k = 0; k < T; k++) flow[k] = edgeFlows(run, scope, k, buf)[e.j];
  flow[T] = flow[T - 1];
  const cv = el('canvas', { class: 'insp-chart' });
  const rows = [
    ['Evidence class', el('span', {}, chip(e.b, BASIS[e.b].label), e.bPos ? el('span', { class: 'note' }, ` · gains: ${BASIS[e.bPos].label.toLowerCase()}`) : '')],
    ['Elasticity', `${e.w > 0 ? '+' : ''}${e.w} (model assumption)`],
    ['Uncertainty used for the range', `±${(e.u * 100).toFixed(0)}% on the elasticity`],
    ['Delay', `${e.lag} week${e.lag === 1 ? '' : 's'}`],
  ];
  if (e.th) rows.push(['Threshold', `Acts only beyond ${(e.th * 100).toFixed(0)}% change in the source`]);
  if (e.kink) rows.push(['Scarcity amplification', `Extra elasticity ${e.kink.w} once the source falls more than ${(e.kink.th * 100).toFixed(0)}%`]);
  if (e.hasWPos) rows.push(['When the source is above baseline', `Elasticity ${e.wPos}`]);
  if (e.clip) rows.push(['Direction', e.clip === 1 ? 'Only transmits increases in the target' : 'Only transmits decreases in the target']);
  if (e.ad) rows.push(['Adaptive pathway', 'Scaled by global response and regional adaptive capacity']);
  if (e.repair) rows.push(['Repair cap', 'Can cancel damage on the target but never lift it above baseline']);
  if (e.sym) rows.push(['Accounting identity', 'Exempt from the gain rule']);
  else if (e.gainable) rows.push(['Gain rule', 'When the source improves and this link would improve the target, it transmits at half strength and counts as speculative']);
  const expo = e.exp ? el('div', { class: 'expo' },
    el('h3', {}, `Regional exposure: ${FIELD_DOCS[e.exp] ? FIELD_DOCS[e.exp].label : e.exp}`),
    el('p', { class: 'note' }, 'The elasticity is multiplied by this regional factor. ', FIELD_DOCS[e.exp] ? FIELD_DOCS[e.exp].note : ''),
    ...REGIONS.map((r, i) => el('div', { class: 'expo-row' + (i === scope ? ' on' : '') }, el('span', {}, r.name), el('span', { class: 'expo-bar' }, el('i', { style: { width: `${Math.min(100, (e.expo[i] / Math.max(...e.expo)) * 100)}%` } })), el('span', { class: 'mono' }, e.expo[i].toFixed(3))))) : null;
  const wrap = el('div', { class: 'insp' },
    scopeBar(app),
    el('div', { class: 'insp-head' },
      el('span', { class: 'eyebrow' }, 'Causal link'),
      el('h2', {}, el('button', { class: 'linky', type: 'button', onclick: () => app.select({ type: 'node', id: a.id }) }, a.label), el('span', { class: 'arrow' }, ' → '), el('button', { class: 'linky', type: 'button', onclick: () => app.select({ type: 'node', id: b.id }) }, b.label)),
      el('p', {}, e.why)),
    el('div', { class: 'insp-val' }, el('span', { class: 'big', style: { color: Math.abs(flow[t]) < 1e-7 ? '' : flow[t] * b.pol < 0 ? HARM : GOOD } }, pp(flow[t])), el('span', { class: 'vsub' }, `current pull on ${b.label.toLowerCase()} · ${scopeName(scope)} at ${fmtWeek(t)}`)),
    cv,
    el('dl', { class: 'kv' }, ...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
    expo,
    e.ref ? el('div', { class: 'refs' }, el('h3', {}, 'Reference anchors'), ...e.ref.map((r) => el('p', { class: 'ref' }, REFS[r])), el('p', { class: 'note' }, 'Anchors support the direction of the link. The magnitude is a model assumption. Citations were entered from background knowledge and not re-verified in this build.')) : el('p', { class: 'note' }, 'No specific reference anchor is attached to this link; its direction rests on general domain knowledge.'),
  );
  requestAnimationFrame(() => chart(cv, [{ s: { c: flow }, color: EVIDENCE[e.b].color }], t, { T, fmt: (x) => pp(x) }));
  return wrap;
}

function regionInspector(app, r) {
  const { run } = app.S;
  const t = Math.min(run.T, Math.round(app.S.t));
  const reg = REGIONS[r];
  const ranked = MODEL.nodes.map((n) => ({ n, v: run.x[t * RN + r * N + n.i] }))
    .filter((o) => Math.abs(o.v) > 1e-4)
    .sort((a, b) => Math.abs(b.n.pol * b.v) - Math.abs(a.n.pol * a.v)).slice(0, 10);
  const mx = Math.max(1e-6, ...ranked.map((o) => Math.abs(o.v)));
  const fields = Object.entries(FIELD_DOCS).filter(([k]) => reg[k] !== undefined);
  return el('div', { class: 'insp' },
    el('div', { class: 'insp-head' }, el('span', { class: 'eyebrow' }, 'Region'), el('h2', {}, reg.name),
      el('p', {}, `${reg.pop.toLocaleString()} million people · about $${reg.gdp} trillion GDP (rounded, ~2023).`)),
    el('button', { class: 'ghost', type: 'button', onclick: () => app.setScope(-1) }, '← Back to world view'),
    el('h3', {}, `Most changed at ${fmtWeek(t)}`),
    ranked.length ? el('div', { class: 'tree' }, ...ranked.map(({ n, v }) => el('div', { class: 'drv' }, el('span', { class: 'tw-sp' }),
      el('button', { class: 'drv-name linky', type: 'button', onclick: () => app.select({ type: 'node', id: n.id }) }, n.label), el('span'),
      el('span', { class: 'drv-bar' }, el('i', { class: n.pol * v < 0 ? 'harm' : 'good', style: { left: '0', width: `${(Math.abs(v) / mx) * 100}%` } })),
      el('span', { class: 'drv-val' }, fmtNode(n, v))))) : el('p', { class: 'note' }, 'No change yet in this region.'),
    el('h3', {}, 'Baseline data and exposure'),
    el('table', { class: 'tbl' }, el('tbody', {}, ...fields.map(([k, f]) => el('tr', {},
      el('td', {}, f.label), el('td', { class: 'mono' }, String(reg[k])), el('td', {}, el('span', { class: `chip chip-${f.status === 'data' ? 'E' : 'A'}` }, f.status === 'data' ? 'Rounded data' : 'Assumption')))))),
  );
}

// ---------- right: consequences ----------
export function renderEvents(root, app) {
  const run = app.S.run;
  const f = app.S.evFilter || 'all';
  const filters = [['all', 'All'], ['estimated', 'Estimated'], ['speculative', 'Speculative'], ['world', 'World only']];
  const list = run.events.filter((e) => f === 'all' || (f === 'world' ? e.region < 0 : f === 'speculative' ? e.cls === 'speculative' || e.cls === 'possible' : e.cls === f));
  root.replaceChildren(
    el('div', { class: 'evfilters', role: 'group', 'aria-label': 'Filter consequences' }, ...filters.map(([k, l]) => el('button', { class: 'seg' + (f === k ? ' on' : ''), type: 'button', onclick: () => { app.S.evFilter = k; renderEvents(root, app); } }, l))),
    el('p', { class: 'note' }, `${run.events.length - 1} threshold crossings detected. Estimated means the central run crosses mostly through supported links; speculative means it relies on assumed or contested links, or only the high-transmission bound crosses.`),
    el('ol', { class: 'evlist' }, ...list.map((ev) => {
      const cls = OUTCOME[ev.cls];
      return el('li', { 'data-t': ev.t },
        el('button', { class: 'ev', type: 'button', onclick: () => app.jumpToEvent(ev) },
          el('span', { class: 'ev-t mono' }, fmtWeek(ev.t)),
          el('span', { class: `chip chip-${ev.cls}` }, ev.cls === 'possible' ? 'Possible' : cls.label.split(' ')[0]),
          el('span', { class: 'ev-title' }, ev.title),
          el('span', { class: 'ev-where' }, ev.cls === 'premise' ? '' : `${ev.region >= 0 ? REGIONS[ev.region].name : 'World'}${ev.conf != null ? ` · ${(ev.conf * 100).toFixed(0)}% pathway confidence` : ' · upper bound only'}`)));
    })),
  );
  updateEvents(root, app);
}
export function updateEvents(root, app) {
  const t = app.S.t;
  for (const li of root.querySelectorAll('.evlist li')) li.classList.toggle('future', Number(li.dataset.t) > t + 0.01);
}

export { scopeName, pp };
