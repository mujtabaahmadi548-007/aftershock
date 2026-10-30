// "Model & assumptions" view: everything the engine believes, in readable tables.
import { MODEL, GAIN_DAMP, RESPONSE, HORIZON } from '../engine/engine.js';
import { SYSTEMS, REFS, BASIS } from '../engine/model.js';
import { REGIONS, FIELD_DOCS } from '../engine/regions.js';
import { SCENARIOS } from '../engine/scenarios.js';
import { el, chip, EVIDENCE, OUTCOME, SYS, fmtNode } from './format.js';

const TESTS = [
  'Determinism: identical configurations produce bit-identical trajectories and events.',
  'Baseline: with no shock, every variable stays exactly at baseline for the whole horizon.',
  'Bounds: every value stays finite and inside its allowed range, for every scenario at default, minimum and maximum parameters.',
  'Causality: effects arrive only through links and respect delays (e.g. payments do not move before digital services).',
  'Recovery: temporary shocks (internet, shipping) return to baseline.',
  'Monotonicity: a larger shock never yields a smaller primary impact.',
  'Branching: an alternative future is identical to the original until its branch week.',
  'Faithful explanations: the inspector\'s driver breakdown reproduces the simulated update to 1e-9.',
  'Direction checks against established relationships (e.g. abundant clean energy lowers energy prices; hydrocarbon exporters lose production value).',
  'Repair links never lift a variable above baseline; uncertainty envelopes always contain the central path.',
  'Every country in the map belongs to a modelled region; every citation key resolves.',
];

export function renderModelView(root, app) {
  const st = app.M || (app.M = { sys: 'all', basis: 'all', q: '' });
  const edgeRows = () => MODEL.edges.filter((e) => {
    const a = MODEL.nodes[e.si], b = MODEL.nodes[e.ti];
    if (st.sys !== 'all' && a.sys !== st.sys && b.sys !== st.sys) return false;
    if (st.basis !== 'all' && e.b !== st.basis) return false;
    if (st.q && !`${a.label} ${b.label} ${e.why}`.toLowerCase().includes(st.q.toLowerCase())) return false;
    return true;
  });
  const tbody = el('tbody');
  const fillEdges = () => {
    const rows = edgeRows();
    tbody.replaceChildren(...rows.map((e) => el('tr', {},
      el('td', {}, MODEL.nodes[e.si].label, el('span', { class: 'dim' }, ' → '), MODEL.nodes[e.ti].label),
      el('td', {}, chip(e.b)),
      el('td', { class: 'mono' }, `${e.w > 0 ? '+' : ''}${e.w}${e.kink ? ` / ${e.kink.w}` : ''}`),
      el('td', { class: 'mono' }, `${e.lag} wk`),
      el('td', {}, [e.exp ? `× ${FIELD_DOCS[e.exp] ? FIELD_DOCS[e.exp].label.toLowerCase() : e.exp}` : '', e.th ? ` · threshold ${(e.th * 100).toFixed(0)}%` : '', e.ad ? ' · adaptive' : '', e.repair ? ' · repair-capped' : '', e.clip ? ' · one-directional' : ''].join('').replace(/^ · /, '') || '–'),
      el('td', {}, e.why))));
    count.textContent = `${rows.length} of ${MODEL.edges.length} links`;
  };
  const count = el('span', { class: 'note' });
  const close = el('button', { class: 'ghost close', type: 'button', onclick: () => app.setView(app.prevView || 'simulate') }, 'Close ✕');

  root.replaceChildren(el('div', { class: 'mv' },
    el('div', { class: 'mv-head' }, el('div', {}, el('span', { class: 'eyebrow' }, 'Model & assumptions'), el('h1', {}, 'Everything this engine assumes')), close),
    el('section', {},
      el('h2', {}, 'How to read the results'),
      el('p', { class: 'lede' }, 'AFTERSHOCK is an exploratory causal model. It does not predict the future and has not been validated against outcomes. Every number is conditional on the premise you choose and on the assumptions listed on this page. Use it to see which consequences follow from which assumptions, and how strongly each one is supported.'),
      el('div', { class: 'cards4' },
        card(EVIDENCE.E.color, 'Established relationship', 'A link whose direction is well documented in research or history. Its strength in this model is still an assumption.'),
        card(EVIDENCE.A.color, 'Model assumption', 'A plausible mechanism, or any number we chose: elasticities, delays, thresholds, exposure indices.'),
        card(OUTCOME.estimated.color, 'Estimated consequence', 'A model output reached mostly through established links (pathway confidence of 50% or more). Computed, not observed.'),
        card(OUTCOME.speculative.color, 'Speculative possibility', 'An output that relies mostly on assumed or contested links, or that only the high-transmission sensitivity bound reaches.')),
      el('p', {}, 'Pathway confidence weights each contribution by its evidence class (established 0.9, assumption 0.6, speculative 0.3), multiplied along the chain of causes, so it falls as consequences travel through weaker links. It describes the quality of the reasoning chain, not a probability.')),
    el('section', {},
      el('h2', {}, 'Method'),
      el('ul', { class: 'plain' },
        el('li', {}, `${MODEL.nodes.length} variables in ${SYSTEMS.length} systems, ${MODEL.edges.length} causal links, ${REGIONS.length} macro-regions, weekly time steps over ${HORIZON / 52} years.`),
        el('li', {}, 'Each variable is a deviation from a no-shock baseline. Each week it moves toward the level implied by its drivers with a first-order delay (its adjustment time), a standard system-dynamics formulation. Links act on the source\'s value after their delay.'),
        el('li', {}, 'Prices, trade, shipping, fertilizer, tension, cooperation and innovation are partly coupled across regions through world markets; climate stress is a global commons where every region\'s contribution adds up.'),
        el('li', {}, `Gain rule: when a source is better than baseline and the link would make its target better, the link transmits at ${GAIN_DAMP * 100}% strength and is tagged speculative, because elasticities were set with losses in mind.`),
        el('li', {}, 'Repair rule: rebuilding and substitution links can cancel damage on their target but never push it above baseline.'),
        el('li', {}, `Global response scales every adaptive link: ×${RESPONSE.none.f} uncoordinated, ×${RESPONSE.moderate.f} moderate, ×${RESPONSE.strong.f} strong, further scaled by each region's adaptive capacity.`),
        el('li', {}, 'Sensitivity range: two further deterministic runs scale every link by its evidence-class uncertainty (±25% established, ±50% assumption, ±85% speculative), stronger and weaker transmission, with adaptive links moving the opposite way. The band is the envelope of the three runs. It is not a statistical confidence interval.'),
        el('li', {}, 'No random numbers are used anywhere. Identical settings always give identical results.'))),
    el('section', {},
      el('h2', {}, 'What it leaves out'),
      el('ul', { class: 'plain' },
        el('li', {}, 'No elevation, hydrology or climate model: geography is aggregated into ten regions, and country borders on the globe are for orientation only.'),
        el('li', {}, 'No behavioural agents, policy choices beyond one response lever, or market equilibrium solver. Elasticities are linear apart from thresholds and scarcity amplification.'),
        el('li', {}, 'No population dynamics, mortality counts or migration routes. Displacement is a share of population, not a flow between places.'),
        el('li', {}, 'Ten-year horizon. Shocks that unfold over centuries (multi-metre sea-level rise) are compressed as thought experiments.'))),
    el('section', {},
      el('h2', {}, 'Causal links'),
      el('div', { class: 'filters' },
        el('select', { id: 'mv-sys', 'aria-label': 'Filter by system', onchange: (e) => { st.sys = e.target.value; fillEdges(); } }, el('option', { value: 'all' }, 'All systems'), ...SYSTEMS.map((s) => el('option', { value: s.id, selected: st.sys === s.id }, s.label))),
        el('select', { id: 'mv-basis', 'aria-label': 'Filter by evidence class', onchange: (e) => { st.basis = e.target.value; fillEdges(); } }, el('option', { value: 'all' }, 'All evidence classes'), ...Object.entries(BASIS).map(([k, b]) => el('option', { value: k, selected: st.basis === k }, b.label))),
        el('input', { id: 'mv-q', type: 'search', placeholder: 'Search links', value: st.q, 'aria-label': 'Search links', oninput: (e) => { st.q = e.target.value; fillEdges(); } }),
        count),
      el('div', { class: 'scroll-x' }, el('table', { class: 'tbl wide' },
        el('thead', {}, el('tr', {}, ...['Link', 'Evidence', 'Elasticity', 'Delay', 'Modifiers', 'Rationale'].map((h) => el('th', {}, h)))), tbody))),
    el('section', {},
      el('h2', {}, 'Variables'),
      el('div', { class: 'scroll-x' }, el('table', { class: 'tbl wide' },
        el('thead', {}, el('tr', {}, ...['Variable', 'System', 'Unit', 'Adjusts in', 'Range', 'Coupling', 'Meaning'].map((h) => el('th', {}, h)))),
        el('tbody', {}, ...MODEL.nodes.map((n) => el('tr', {},
          el('td', {}, n.label), el('td', { style: { color: SYS[n.sys].color } }, SYS[n.sys].label),
          el('td', {}, { rel: 'relative', share: 'pop. share', idx: 'index pts' }[n.unit]), el('td', { class: 'mono' }, `${n.tau} wk`),
          el('td', { class: 'mono' }, `${fmtNode(n, n.min)} … ${fmtNode(n, n.max)}`), el('td', {}, n.cpl ? `${n.cpl * 100}%${n.cmode === 'sum' ? ' (sum)' : ''}` : '–'), el('td', {}, n.desc))))))),
    el('section', {},
      el('h2', {}, 'Regional dataset'),
      el('p', {}, 'Population and GDP are rounded approximations (~2023) of UN and World Bank figures, entered from general knowledge and not re-verified in this build. Every other column is an exposure index chosen by the authors. Treat them as assumptions, not data.'),
      el('div', { class: 'scroll-x' }, el('table', { class: 'tbl wide' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Field'), ...REGIONS.map((r) => el('th', { class: 'mono' }, r.id.toUpperCase())), el('th', {}, 'Status'))),
        el('tbody', {}, ...Object.entries(FIELD_DOCS).map(([k, f]) => el('tr', {},
          el('td', { title: f.note }, f.label), ...REGIONS.map((r) => el('td', { class: 'mono' }, String(r[k]))),
          el('td', {}, el('span', { class: `chip chip-${f.status === 'data' ? 'E' : 'A'}` }, f.status === 'data' ? 'Rounded data' : 'Assumption'))))))),
      el('p', { class: 'note' }, REGIONS.map((r) => `${r.id.toUpperCase()} = ${r.name}`).join(' · '))),
    el('section', {},
      el('h2', {}, 'Scenarios'),
      ...SCENARIOS.map((s) => el('article', { class: 'mv-scn' },
        el('h3', {}, s.name), el('p', {}, s.premise),
        el('p', { class: 'caveat' }, el('b', {}, 'Plausibility: '), s.caveat),
        el('h4', {}, 'Assumptions'), el('ul', { class: 'plain' }, ...s.assumptions.map((a) => el('li', {}, a))),
        el('h4', {}, 'Reference anchors'), el('ul', { class: 'plain' }, ...s.anchors.map((a) => el('li', {}, a.text, el('span', { class: 'dim' }, ` (${REFS[a.ref]})`))))))),
    el('section', {},
      el('h2', {}, 'References'),
      el('p', { class: 'note' }, 'Entered from the authors\' background knowledge and not re-verified inside this build. Check a source before citing any claim that depends on it.'),
      el('ul', { class: 'plain refs' }, ...Object.values(REFS).map((r) => el('li', {}, r)))),
    el('section', {},
      el('h2', {}, 'How the engine is tested'),
      el('p', {}, 'The simulation engine has its own automated test suite that runs without the interface:'),
      el('ul', { class: 'plain' }, ...TESTS.map((t) => el('li', {}, t)))),
  ));
  fillEdges();
}

function card(color, title, text) {
  return el('div', { class: 'ev-card', style: { '--c': color } }, el('h3', {}, title), el('p', {}, text));
}
