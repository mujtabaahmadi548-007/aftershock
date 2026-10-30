// Counterfactual comparison: configure future B, then show A and B side by side.
import { KPI_DEFS, compareAt, divergence, series, RESPONSE } from '../engine/engine.js';
import { SCENARIOS, defaultParams } from '../engine/scenarios.js';
import { el, fmtKpi, fmtNode, fmtWeek, HARM, GOOD } from './format.js';
import { paramControls } from './panels.js';
import { chart } from './charts.js';

const KPI_POL = { gdp: 1, food_price: -1, energy_price: -1, trade: 1, displaced: -1, foodStress: -1, cumOutput: 1 };
export const A_COLOR = '#f2b544', B_COLOR = '#8fb8ff';

export function describe(run) {
  if (!run) return '';
  const scn = run.scenario;
  const p = run.cfg.params;
  const parts = scn.params.filter((q) => q.id !== 'response').map((q) => `${q.label.toLowerCase()} ${q.type === 'range' ? `${p[q.id]} ${q.unit}` : q.options.find((o) => o.v === p[q.id]).l.toLowerCase()}`);
  let s = `${scn.short}: ${parts.join(', ')}; ${RESPONSE[p.response].label.toLowerCase()} response`;
  if (run.cfg.branch) {
    const b = run.cfg.branch.params;
    const diff = scn.params.filter((q) => b[q.id] !== p[q.id]).map((q) => q.id === 'response' ? `${RESPONSE[b.response].label.toLowerCase()} response` : `${q.label.toLowerCase()} ${b[q.id]}${q.unit ? ' ' + q.unit : ''}`);
    s += `. From ${fmtWeek(run.cfg.branch.week)}: ${diff.length ? diff.join(', ') : 'no change'}`;
  }
  return s;
}

export function renderCompareConfig(root, app) {
  const C = app.C;
  const A = app.S.run;
  const scnA = A.scenario;
  const modeSeg = el('div', { class: 'segs', role: 'group', 'aria-label': 'How future B differs' },
    el('button', { class: 'seg' + (C.mode === 'branch' ? ' on' : ''), type: 'button', onclick: () => { C.mode = 'branch'; renderCompareConfig(root, app); } }, 'Branch at a week'),
    el('button', { class: 'seg' + (C.mode === 'scenario' ? ' on' : ''), type: 'button', onclick: () => { C.mode = 'scenario'; renderCompareConfig(root, app); } }, 'Another hypothetical'));
  let body;
  if (C.mode === 'branch') {
    if (!C.branchParams || C.branchFor !== scnA.id) { C.branchParams = { ...A.cfg.params, response: A.cfg.params.response === 'strong' ? 'none' : 'strong' }; C.branchFor = scnA.id; }
    const out = el('output', {}, fmtWeek(C.week));
    body = el('div', {},
      el('p', { class: 'note' }, 'Future B follows A exactly until the branch week, then continues with the settings below. Use it to ask what a stronger response, or a shorter outage, would change from that point on.'),
      el('div', { class: 'field' }, el('div', { class: 'field-row' }, el('label', { for: 'cmp-week' }, 'Branch week'), out),
        el('input', { id: 'cmp-week', type: 'range', min: 1, max: A.T - 1, step: 1, value: C.week, oninput: (e) => { C.week = Number(e.target.value); out.textContent = fmtWeek(C.week); } }),
        el('button', { class: 'ghost small', type: 'button', onclick: () => { C.week = Math.max(1, Math.round(app.S.t)); renderCompareConfig(root, app); } }, 'Use current time')),
      ...paramControls(scnA, C.branchParams, (k, v) => { C.branchParams[k] = v; }, 'b'));
  } else {
    if (!C.scnB) C.scnB = SCENARIOS.find((s) => s.id !== scnA.id).id;
    const scnB = SCENARIOS.find((s) => s.id === C.scnB);
    if (!C.paramsB || C.paramsFor !== scnB.id) { C.paramsB = defaultParams(scnB); C.paramsFor = scnB.id; }
    body = el('div', {},
      el('p', { class: 'note' }, 'Compare two different hypotheticals on the same scale.'),
      el('div', { class: 'field' }, el('label', { for: 'cmp-scn' }, 'Hypothetical B'),
        el('select', { id: 'cmp-scn', onchange: (e) => { C.scnB = e.target.value; renderCompareConfig(root, app); } }, ...SCENARIOS.map((s) => el('option', { value: s.id, selected: s.id === C.scnB }, s.name)))),
      ...paramControls(scnB, C.paramsB, (k, v) => { C.paramsB[k] = v; }, 'c'));
  }
  root.replaceChildren(
    el('h2', {}, 'Alternative futures'),
    el('div', { class: 'futA' }, el('span', { class: 'tag', style: { background: A_COLOR } }, 'A'), el('p', {}, describe(A))),
    modeSeg, body,
    el('button', { class: 'primary', type: 'button', id: 'computeB', onclick: () => app.computeB() }, 'Compute future B'),
    app.S.runB ? el('div', { class: 'futA' }, el('span', { class: 'tag', style: { background: B_COLOR } }, 'B'), el('p', {}, describe(app.S.runB))) : null,
  );
}

export function renderCompareRight(root, app) {
  const { run: A, runB: B } = app.S;
  if (!B) {
    root.replaceChildren(el('div', { class: 'insp-empty' }, el('h3', {}, 'No alternative yet'), el('p', {}, 'Configure future B on the left and compute it. Both futures then play on the same clock, side by side.')));
    return;
  }
  const t = Math.round(app.S.t);
  const rows = compareAt(A, B, t);
  const pick = app.C.kpi || 'gdp';
  const cv = el('canvas', { class: 'insp-chart tall' });
  const div = divergence(A, B, t).filter((o) => Math.abs(o.d) > 1e-4).slice(0, 8);
  root.replaceChildren(
    el('h3', {}, `Futures compared at ${fmtWeek(t)}`),
    el('table', { class: 'tbl cmp-tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Indicator'), el('th', { style: { color: A_COLOR } }, 'A'), el('th', { style: { color: B_COLOR } }, 'B'), el('th', {}, 'B − A'))),
      el('tbody', {}, ...rows.map((r) => {
        const better = r.d * KPI_POL[r.def.id];
        return el('tr', { class: r.def.id === pick ? 'on' : '', tabindex: 0, onclick: () => { app.C.kpi = r.def.id; renderCompareRight(root, app); } },
          el('td', {}, r.def.label), el('td', { class: 'mono' }, fmtKpi(r.def, r.a)), el('td', { class: 'mono' }, fmtKpi(r.def, r.b)),
          el('td', { class: 'mono', style: { color: Math.abs(r.d) < 1e-6 ? '' : better > 0 ? GOOD : HARM } }, fmtKpi(r.def, r.d)));
      }))),
    el('p', { class: 'note' }, 'Click a row to chart it. Bands show each future\'s sensitivity range.'),
    cv,
    el('h3', {}, 'Where the futures diverge most'),
    div.length ? el('div', { class: 'tree' }, ...div.map((o) => el('div', { class: 'drv' }, el('span', { class: 'tw-sp' }), el('span', { class: 'drv-name' }, o.node.label), el('span', { class: 'mono dim' }, fmtNode(o.node, o.a)), el('span', { class: 'mono dim' }, fmtNode(o.node, o.b)),
      el('span', { class: 'drv-val', style: { color: o.d * o.node.pol > 0 ? GOOD : HARM } }, fmtNode(o.node, o.d))))) : el('p', { class: 'note' }, 'The futures are identical at this moment (before the branch point, or no difference yet).'),
  );
  const def = KPI_DEFS.find((d) => d.id === pick);
  requestAnimationFrame(() => chart(cv, [
    { s: A.kpis[pick], color: A_COLOR, band: 'rgba(242,181,68,0.12)' },
    { s: B.kpis[pick], color: B_COLOR, band: 'rgba(143,184,255,0.12)' },
  ], t, { T: Math.min(A.T, B.T), fmt: (v) => fmtKpi(def, v), branch: B.cfg.branch ? B.cfg.branch.week : null }));
}
