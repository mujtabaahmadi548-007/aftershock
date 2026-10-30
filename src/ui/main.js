// AFTERSHOCK app controller: state, playback clock, selection and view wiring.
import { runScenario, MODEL, NODE_INDEX, RESPONSE } from '../engine/engine.js';
import { SCENARIOS, defaultParams } from '../engine/scenarios.js';
import { SYSTEMS } from '../engine/model.js';
import { REGIONS } from '../engine/regions.js';
import { Globe, createView, layerExtent } from './globe.js';
import { Network } from './network.js';
import { Timeline } from './timeline.js';
import { renderScenarioList, renderParams, renderKpis, updateKpis, renderInspector, renderEvents, updateEvents, scopeName } from './panels.js';
import { renderCompareConfig, renderCompareRight, describe, A_COLOR, B_COLOR } from './compare.js';
import { renderModelView } from './modelview.js';
import { $, el, fmtWeek, fmtSpan, fmtNode, sevColor, icon } from './format.js';

const SPEEDS = [{ l: '1×', w: 2 }, { l: '4×', w: 8 }, { l: '16×', w: 32 }, { l: '64×', w: 128 }];
const tip = $('#tip');

const app = {
  S: {
    scenarioId: 'shipping', params: defaultParams(SCENARIOS[0]), run: null, runB: null,
    t: 0, playing: false, dir: 1, speedIdx: 1, layer: 'trade', scope: -1, sel: null,
    tab: 'kpi', view: 'simulate', dirty: false, evFilter: 'all',
  },
  C: { mode: 'branch', week: 26, kpi: 'gdp' },
  expanded: new Set(),
  hoverRight: false,
};
const S = app.S;
let uiPending = true, lastUi = 0, lastWeek = -1;
const touch = () => { uiPending = true; };

// ---------- components ----------
const view = createView();
const hoverTip = (info) => {
  if (!info) { tip.hidden = true; return; }
  tip.innerHTML = info.html; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = info.x + 14, y = info.y + 14;
  if (x + r.width > window.innerWidth - 8) x = info.x - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = info.y - r.height - 14;
  tip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
};
const globeA = new Globe($('#globeA'), { view, onHover: hoverTip, onSelect: (r) => app.selectRegion(r) });
const globeB = new Globe($('#globeB'), { view, follower: true, onHover: hoverTip, onSelect: (r) => app.selectRegion(r) });
const net = new Network($('#net'), { onHover: hoverTip, onSelect: (sel) => app.select(sel) });
const timeline = new Timeline($('#timeline'), {
  onHover: hoverTip,
  onScrub: (t, active) => { if (t != null) { S.t = t; S.playing = false; syncTransport(); touch(); } },
  onEvent: (ev) => app.jumpToEvent(ev),
});

// ---------- actions ----------
app.selectScenario = (id) => {
  tip.hidden = true;
  S.scenarioId = id;
  S.params = defaultParams(SCENARIOS.find((s) => s.id === id));
  renderScenarioList($('#scnList'), app);
  renderParams($('#paramForm'), app);
  app.launch();
};
app.setParam = (k, v) => {
  S.params[k] = v;
  S.dirty = true;
  $('#launch').classList.add('pulse');
  $('#launch').textContent = 'Relaunch with these settings';
};
app.launch = () => {
  const t0 = performance.now();
  const run = runScenario({ scenarioId: S.scenarioId, params: S.params });
  S.run = run; S.runB = null; S.t = 0; S.dir = 1; S.playing = true; S.dirty = false;
  if (!run.scenario.focus.includes(S.layer)) S.layer = run.scenario.focus[0];
  if (run.scenario.origin) { const o = REGIONS.find((r) => r.id === run.scenario.origin[0]); view.rot = [-o.lon, -o.lat * 0.6]; view.last = performance.now(); }
  if (S.sel && S.sel.type === 'region') S.sel = null;
  app.expanded.clear();
  globeA.setRun(run); globeB.setRun(null); net.setRun(run); timeline.setRun(run); timeline.setRunB(null);
  applyLayer();
  $('#launch').classList.remove('pulse');
  $('#launch').textContent = 'Launch simulation';
  $('#scnName').textContent = run.scenario.name;
  $('#scnMeta').textContent = describe(run);
  $('#runStat').textContent = `${(performance.now() - t0).toFixed(0)} ms · 3 deterministic runs`;
  buildLayerSelect();
  renderRight(true);
  if (S.view === 'compare') renderLeft();
  syncTransport(); touch();
};
app.computeB = () => {
  const A = S.run, C = app.C;
  const btn = $('#computeB'); if (btn) btn.textContent = 'Computing…';
  setTimeout(() => {
    const B = C.mode === 'branch'
      ? runScenario({ scenarioId: A.cfg.scenarioId, params: A.cfg.params, branch: { week: C.week, params: C.branchParams } })
      : runScenario({ scenarioId: C.scnB, params: C.paramsB });
    S.runB = B;
    globeB.setRun(B); timeline.setRunB(B);
    applyLayer();
    S.t = C.mode === 'branch' ? Math.max(0, C.week - 6) : 0;
    S.playing = true; S.dir = 1;
    renderLeft(); renderRight(true); syncTransport(); touch();
  }, 16);
};
app.select = (sel) => {
  S.sel = sel;
  if (S.view !== 'simulate') app.setView('simulate');
  S.tab = 'inspect';
  net.setSelected(sel);
  if (sel && sel.type === 'node' && !S.layerLocked) { /* keep layer: the map shows what the user chose */ }
  renderRight(true);
};
app.selectRegion = (r) => {
  if (r < 0) {
    if (S.sel && S.sel.type === 'region') { S.sel = null; net.setSelected(null); }
    app.setScope(-1); return;
  }
  if (S.sel && (S.sel.type === 'node' || S.sel.type === 'edge')) { app.setScope(r); return; }
  S.sel = { type: 'region', id: r };
  S.tab = 'inspect';
  app.setScope(r);
};
app.setScope = (s) => {
  S.scope = s;
  if (s < 0 && S.sel && S.sel.type === 'region') S.sel = null;
  globeA.setSelected(s); globeB.setSelected(s); net.setScope(s);
  $('#netScope').textContent = scopeName(s);
  renderRight(true);
};
app.toggleExpand = (key) => {
  if (app.expanded.has(key)) app.expanded.delete(key); else app.expanded.add(key);
  renderRight(true);
};
app.jumpToEvent = (ev) => {
  S.t = ev.t; S.playing = false;
  if (ev.node) {
    S.layer = ev.node; buildLayerSelect(); applyLayer();
    S.scope = ev.region; globeA.setSelected(ev.region); globeB.setSelected(ev.region); net.setScope(ev.region);
    $('#netScope').textContent = scopeName(ev.region);
    app.select({ type: 'node', id: ev.node });
    if (ev.region >= 0) { const r = REGIONS[ev.region]; view.rot = [-r.lon, -Math.max(-60, Math.min(60, r.lat))]; view.last = performance.now(); }
  }
  syncTransport(); touch();
};
app.setView = (v) => {
  tip.hidden = true;
  if (v === 'model' && S.view !== 'model') app.prevView = S.view;
  S.view = v;
  $('#app').dataset.view = v;
  for (const b of document.querySelectorAll('.views button')) b.setAttribute('aria-selected', String(b.dataset.view === v));
  $('#modelView').hidden = v !== 'model';
  $('#globeB').hidden = v !== 'compare';
  if (v === 'model') renderModelView($('#modelView'), app);
  renderLeft(); renderRight(true); updateTags();
};

// ---------- rendering helpers ----------
function renderLeft() {
  const sim = S.view !== 'compare';
  $('#leftSim').hidden = !sim;
  $('#compareCfg').hidden = sim;
  if (!sim && S.run) renderCompareConfig($('#compareCfg'), app);
}
function renderRight(force) {
  if (!S.run) return;
  const cmp = S.view === 'compare';
  $('#rightTabs').hidden = cmp;
  for (const b of document.querySelectorAll('#rightTabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === S.tab));
  $('#tabKpi').hidden = cmp || S.tab !== 'kpi';
  $('#tabInspect').hidden = cmp || S.tab !== 'inspect';
  $('#tabEvents').hidden = cmp || S.tab !== 'events';
  $('#tabCompare').hidden = !cmp;
  if (cmp) { renderCompareRight($('#tabCompare'), app); return; }
  if (S.tab === 'kpi') { if (force || !$('#tabKpi').firstChild || $('#tabKpi').dataset.run !== String(S.run.cfg.scenarioId + JSON.stringify(S.run.cfg.params))) { renderKpis($('#tabKpi'), app); $('#tabKpi').dataset.run = S.run.cfg.scenarioId + JSON.stringify(S.run.cfg.params); } else updateKpis($('#tabKpi'), app); }
  if (S.tab === 'inspect') renderInspector($('#tabInspect'), app);
  if (S.tab === 'events') { if (force || $('#tabEvents').dataset.run !== String(S.run.events.length + S.run.cfg.scenarioId)) { renderEvents($('#tabEvents'), app); $('#tabEvents').dataset.run = String(S.run.events.length + S.run.cfg.scenarioId); } else updateEvents($('#tabEvents'), app); }
}
function buildLayerSelect() {
  const sel = $('#layerSel');
  const focus = S.run.scenario.focus;
  sel.replaceChildren(
    el('optgroup', { label: 'Scenario focus' }, ...focus.map((id) => el('option', { value: id, selected: id === S.layer }, MODEL.nodes[NODE_INDEX[id]].label))),
    ...SYSTEMS.map((s) => el('optgroup', { label: s.label }, ...MODEL.nodes.filter((n) => n.sys === s.id && !focus.includes(n.id)).map((n) => el('option', { value: n.id, selected: n.id === S.layer }, n.label)))),
  );
}
function applyLayer() {
  const ext = Math.max(layerExtent(S.run, S.layer), S.runB ? layerExtent(S.runB, S.layer) : 0);
  for (const g of [globeA, globeB]) { g.setLayer(S.layer); g.setExtent(ext); }
  const node = MODEL.nodes[NODE_INDEX[S.layer]];
  const lg = $('#globeLegend');
  lg.replaceChildren(
    el('span', { class: 'mono' }, fmtNode(node, -node.pol * ext)),
    el('span', { class: 'lg-bar', style: { background: `linear-gradient(90deg, ${sevColor(-ext, ext)}, ${sevColor(-ext * 0.45, ext)}, ${sevColor(0, ext)}, ${sevColor(ext * 0.5, ext)}, ${sevColor(ext, ext)})` } }),
    el('span', { class: 'mono' }, fmtNode(node, node.pol * ext)),
  );
  lg.title = `Colour scale spans the largest change of "${node.label}" in any region during this run. Warm = worse, teal = better.`;
  updateTags();
}
function updateTags() {
  const tags = $('#globeTags');
  if (S.view === 'compare' && S.run) {
    tags.replaceChildren(
      el('span', { class: 'gtag', style: { '--c': A_COLOR } }, el('b', {}, 'A'), S.run.scenario.short),
      el('span', { class: 'gtag', style: { '--c': B_COLOR } }, el('b', {}, 'B'), S.runB ? (S.runB.cfg.branch ? `Branch at ${fmtWeek(S.runB.cfg.branch.week)}` : S.runB.scenario.short) : 'not computed'));
  } else tags.replaceChildren();
}
function syncTransport() {
  const p = $('#tPlay');
  p.replaceChildren(icon(S.playing && S.dir > 0 ? 'pause' : 'play', 18));
  p.setAttribute('aria-label', S.playing && S.dir > 0 ? 'Pause' : 'Play');
  $('#tRew').classList.toggle('on', S.playing && S.dir < 0);
  for (const b of document.querySelectorAll('.speeds button')) b.setAttribute('aria-pressed', String(Number(b.dataset.i) === S.speedIdx));
  $('#runState').textContent = S.playing ? (S.dir > 0 ? `Running ${SPEEDS[S.speedIdx].l}` : `Rewinding ${SPEEDS[S.speedIdx].l}`) : 'Paused';
  $('#runState').classList.toggle('live', S.playing);
}
function updateClock() {
  const t = Math.round(S.t);
  $('#clockWeek').textContent = `T+${String(t).padStart(3, '0')}`;
  $('#clockSpan').textContent = t === 0 ? 'onset' : `${fmtSpan(t)} in`;
}

// ---------- transport ----------
const play = () => { if (!S.run) return; if (S.t >= S.run.T - 0.01) S.t = 0; S.dir = 1; S.playing = !(S.playing && S.dir > 0) || !S.playing; syncTransport(); };
$('#tPlay').addEventListener('click', () => { if (S.playing && S.dir > 0) S.playing = false; else { if (S.t >= S.run.T - 0.01) S.t = 0; S.dir = 1; S.playing = true; } syncTransport(); });
$('#tRew').addEventListener('click', () => { if (S.playing && S.dir < 0) S.playing = false; else { S.dir = -1; S.playing = true; } syncTransport(); });
$('#tReset').addEventListener('click', () => { S.t = 0; S.playing = false; syncTransport(); touch(); });
$('#tBack').addEventListener('click', () => { S.t = Math.max(0, Math.round(S.t) - 1); S.playing = false; syncTransport(); touch(); });
$('#tFwd').addEventListener('click', () => { S.t = Math.min(S.run.T, Math.round(S.t) + 1); S.playing = false; syncTransport(); touch(); });
for (const b of document.querySelectorAll('.speeds button')) b.addEventListener('click', () => { S.speedIdx = Number(b.dataset.i); syncTransport(); });
$('#launch').addEventListener('click', () => app.launch());
$('#layerSel').addEventListener('change', (e) => { S.layer = e.target.value; applyLayer(); });
for (const b of document.querySelectorAll('.views button')) b.addEventListener('click', () => app.setView(b.dataset.view));
for (const b of document.querySelectorAll('#rightTabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; renderRight(true); });
for (const b of document.querySelectorAll('[data-open-model]')) b.addEventListener('click', () => app.setView('model'));
$('#right').addEventListener('pointerenter', () => { app.hoverRight = true; });
$('#right').addEventListener('pointerleave', () => { app.hoverRight = false; touch(); });

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) return;
  if (e.key === ' ') { e.preventDefault(); $('#tPlay').click(); }
  else if (e.key === 'ArrowRight') { S.t = Math.min(S.run.T, Math.round(S.t) + (e.shiftKey ? 13 : 1)); S.playing = false; syncTransport(); touch(); }
  else if (e.key === 'ArrowLeft') { S.t = Math.max(0, Math.round(S.t) - (e.shiftKey ? 13 : 1)); S.playing = false; syncTransport(); touch(); }
  else if (e.key === 'Home') { S.t = 0; touch(); }
  else if (e.key === 'Escape') { if (S.view === 'model') app.setView(app.prevView || 'simulate'); else { S.sel = null; net.setSelected(null); app.setScope(-1); } }
});

// ---------- clock ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  if (S.run && S.playing) {
    S.t += S.dir * SPEEDS[S.speedIdx].w * dt / 1000;
    const T = S.run.T;
    if (S.t >= T) { S.t = T; S.playing = false; syncTransport(); }
    if (S.t <= 0) { S.t = 0; S.playing = false; syncTransport(); }
  }
  if (S.view !== 'model') {
    globeA.setTime(S.t); globeA.frame(now, dt);
    if (S.view === 'compare') { globeB.setTime(S.t); globeB.frame(now, dt); }
    else { net.setTime(S.t); net.frame(now); }
    timeline.setTime(S.t); timeline.frame();
  }
  const wk = Math.round(S.t);
  if (wk !== lastWeek) { lastWeek = wk; updateClock(); touch(); }
  if (uiPending && S.run && now - lastUi > (S.playing ? 140 : 0)) {
    uiPending = false; lastUi = now;
    const quietRight = app.hoverRight && S.playing && S.tab === 'inspect';
    if (!quietRight) renderRight(false);
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
renderScenarioList($('#scnList'), app);
renderParams($('#paramForm'), app);
$('#netScope').textContent = 'World';
app.launch();
requestAnimationFrame(frame);
window.__aftershock = app; // exposed for automated smoke tests
