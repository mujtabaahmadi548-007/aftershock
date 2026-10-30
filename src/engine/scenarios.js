// Scenario definitions. A scenario is a hypothetical premise expressed as exogenous shocks on model nodes,
// plus optional edge-scale overrides. Everything downstream of the shock comes from the shared causal model.
import { REGIONS } from './regions.js';

const popMean = (field) => {
  const tp = REGIONS.reduce((a, r) => a + r.pop, 0);
  return REGIONS.reduce((a, r) => a + r[field] * r.pop, 0) / tp;
};
const WATER_MEAN = popMean('waterStress');

const CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lon: 56.4, lat: 26.5 },
  { name: 'Strait of Malacca', lon: 100.6, lat: 3.4 },
  { name: 'Suez Canal', lon: 32.4, lat: 30.4 },
  { name: 'Bab-el-Mandeb', lon: 43.4, lat: 12.6 },
  { name: 'Panama Canal', lon: -79.7, lat: 9.2 },
  { name: 'Strait of Gibraltar', lon: -5.6, lat: 35.95 },
  { name: 'Cape of Good Hope', lon: 18.5, lat: -35.2 },
  { name: 'Taiwan Strait', lon: 119.6, lat: 24.2 },
];

// Schematic routes through real chokepoints. Waypoints are illustrative, not traffic data.
const LANES = [
  { name: 'Asia-Europe via Suez', pts: [[122.6, 30.6], [119.8, 24.0], [114.5, 21.0], [109.5, 12], [104.2, 1.2], [100.6, 3.4], [95.5, 6.0], [80.5, 5.5], [60, 13], [50, 12.6], [43.4, 12.6], [38, 21], [32.6, 29.6], [32.3, 31.4], [25, 34], [12, 37.4], [0, 37.3], [-5.6, 35.95], [-9.9, 37.2], [-10, 43.6], [-5.5, 48.6], [1.4, 51.0], [4.0, 52.0]] },
  { name: 'Transpacific', pts: [[122.6, 30.6], [130, 31.2], [140.5, 35.2], [-125, 40], [-118.3, 33.7]] },
  { name: 'Transatlantic', pts: [[4.0, 52.0], [1.4, 51.0], [-5.5, 49.6], [-50, 44], [-74, 40.3]] },
  { name: 'Gulf crude to East Asia', pts: [[50.2, 26.7], [56.4, 26.5], [60, 22.5], [72, 10], [80.5, 5.5], [95.5, 6.0], [100.6, 3.4], [104.2, 1.2], [109.5, 12], [117, 19], [125, 27], [132, 30.5], [139.8, 34.6]] },
  { name: 'South Atlantic via the Cape', pts: [[-46.3, -24.1], [-20, -33], [18.5, -35.2], [55, -25], [80, -5], [95.5, 6.0]] },
  { name: 'Panama route', pts: [[-74, 40.3], [-73.6, 20.4], [-78.5, 15], [-79.7, 9.4], [-80, 7.8], [-92, 12], [-110, 20], [-118.3, 33.7]] },
];

const response = { id: 'response', label: 'Global response', type: 'select', def: 'moderate',
  options: [{ v: 'none', l: 'Uncoordinated' }, { v: 'moderate', l: 'Moderate' }, { v: 'strong', l: 'Strong & coordinated' }],
  doc: 'Scales every adaptive (recovery) pathway: x0.35 uncoordinated, x1 moderate, x1.6 strong. Strong response also adds +15 pts to cooperation; uncoordinated subtracts 6. Model assumption.' };

export const SCENARIOS = [
  {
    id: 'shipping', name: 'Collapse of global shipping', short: 'Shipping', glyph: 'ship',
    premise: 'Most of the world\'s ocean freight capacity stops operating at once and stays down for a period before recovering.',
    params: [
      { id: 'cap', label: 'Capacity lost', type: 'range', min: 20, max: 100, step: 5, def: 70, unit: '%', doc: 'Share of seaborne freight capacity that stops.' },
      { id: 'dur', label: 'Duration of outage', type: 'range', min: 4, max: 260, step: 4, def: 52, unit: 'wk', doc: 'Weeks at full severity before recovery begins.' },
      { id: 'rec', label: 'Recovery period', type: 'range', min: 4, max: 104, step: 4, def: 26, unit: 'wk', doc: 'Weeks for capacity to return linearly to baseline.' },
      response,
    ],
    shocks: (p) => [{ node: 'shipping', mag: -p.cap / 100, prof: { ramp: 2, hold: p.dur, recover: p.rec } }],
    focus: ['trade', 'supply_chain', 'food_supply', 'energy_supply', 'inflation', 'gdp'],
    geo: { points: CHOKEPOINTS, kind: 'Chokepoint', lanes: LANES },
    anchors: [
      { text: 'More than 80% of world trade by volume is carried by sea.', ref: 'unctad' },
      { text: 'The six-day Ever Given blockage of the Suez Canal (2021) delayed hundreds of ships.', ref: 'suez2021' },
      { text: 'Supply-chain pressure reached record highs in late 2021 after container shipping congestion.', ref: 'gscpi' },
    ],
    assumptions: [
      'The cause of the collapse is left unspecified; ports and ships are intact, only operations stop.',
      'Air and rail substitute only through the slow adaptive pathway (innovation to freight).',
      'Energy importers lose supply in proportion to their positive net import dependence.',
    ],
    caveat: 'No historical precedent at this scale. Shipping disruptions in 2021-22 were a fraction of this premise.',
  },
  {
    id: 'bees', name: 'Disappearance of bees', short: 'Bees', glyph: 'bee',
    premise: 'Bees, wild and managed, disappear over a period of time. Other pollinators remain and partly compensate.',
    params: [
      { id: 'loss', label: 'Bee populations lost', type: 'range', min: 25, max: 100, step: 5, def: 100, unit: '%', doc: 'Share of bee pollination lost.' },
      { id: 'comp', label: 'Compensation by other pollinators', type: 'range', min: 0, max: 50, step: 5, def: 15, unit: '%', doc: 'Flies, beetles, moths, birds and bats taking over part of the service.' },
      { id: 'onset', label: 'Decline period', type: 'range', min: 1, max: 260, step: 1, def: 52, unit: 'wk', doc: 'Weeks over which bees disappear.' },
      response,
    ],
    shocks: (p) => [{ node: 'pollinators', mag: -(p.loss / 100) * 0.8 * (1 - p.comp / 100), prof: { ramp: p.onset, shape: 'smooth' } }],
    focus: ['poll_crops', 'nutrition', 'food_price', 'biodiversity', 'health'],
    geo: { kind: 'Site', points: [
      { name: 'California almond orchards (rely on rented honeybee colonies)', lon: -120.5, lat: 37.0 },
      { name: 'Sichuan pear orchards (hand pollination already used)', lon: 104.0, lat: 30.7 },
    ] },
    anchors: [
      { text: 'About 75% of leading global food crop types benefit from animal pollination.', ref: 'ipbes2016' },
      { text: 'Pollination directly accounts for roughly 5-8% of global crop production volume.', ref: 'ipbes2016' },
      { text: 'Pollinator-dependent crops supply much of the world\'s vitamin A, vitamin C and folate.', ref: 'eilers2011' },
      { text: 'One modelling study estimated complete pollinator loss could cause about 1.4 million additional deaths a year through diet.', ref: 'smith2015' },
    ],
    assumptions: [
      'Bees are assumed to provide 80% of crop pollination service. This is an assumption; their share varies widely by crop and place.',
      'Wind-pollinated staples (wheat, rice, maize) are unaffected directly.',
      'Hand and mechanical pollination are treated as a speculative adaptive pathway.',
    ],
    caveat: 'Total loss of all bees is not a forecast; regional declines are documented but global disappearance is hypothetical.',
  },
  {
    id: 'internet', name: 'Global internet shutdown', short: 'Internet', glyph: 'net',
    premise: 'Global connectivity fails for a period, then is gradually restored. Power grids stay up initially.',
    params: [
      { id: 'sev', label: 'Connectivity lost', type: 'range', min: 50, max: 100, step: 5, def: 100, unit: '%', doc: 'Share of connectivity that fails.' },
      { id: 'dur', label: 'Outage duration', type: 'range', min: 1, max: 104, step: 1, def: 12, unit: 'wk', doc: 'Weeks before restoration starts.' },
      { id: 'rest', label: 'Restoration period', type: 'range', min: 1, max: 52, step: 1, def: 8, unit: 'wk', doc: 'Weeks for connectivity to return.' },
      { id: 'fallback', label: 'Offline fallbacks', type: 'select', def: 'medium',
        options: [{ v: 'low', l: 'Few' }, { v: 'medium', l: 'Some' }, { v: 'high', l: 'Extensive' }],
        doc: 'Cash, paper processes and manual logistics. Scales the digital-to-finance edge (x1, x0.75, x0.55) and digital-to-supply-chain edge (x1, x0.8, x0.65). Assumption.' },
      response,
    ],
    shocks: (p) => [{ node: 'internet', mag: -p.sev / 100, prof: { ramp: 1, hold: p.dur, recover: p.rest } }],
    edgeScale: (p) => ({
      'digital>finance': { low: 1, medium: 0.75, high: 0.55 }[p.fallback],
      'digital>supply_chain': { low: 1, medium: 0.8, high: 0.65 }[p.fallback],
    }),
    focus: ['digital', 'finance', 'supply_chain', 'gdp', 'food_supply'],
    geo: { kind: 'Hub', points: [
      { name: 'Northern Virginia data-centre cluster', lon: -77.5, lat: 39.0 },
      { name: 'Frankfurt interconnection hub', lon: 8.7, lat: 50.1 },
      { name: 'Marseille subsea cable landing hub', lon: 5.4, lat: 43.3 },
      { name: 'Singapore interconnection hub', lon: 103.8, lat: 1.35 },
      { name: 'Mumbai cable landing hub', lon: 72.85, lat: 19.0 },
      { name: 'Tokyo interconnection hub', lon: 139.7, lat: 35.7 },
    ] },
    anchors: [
      { text: 'National shutdowns have happened (e.g. Egypt 2011, Iran 2019, Myanmar 2021); none has been global.', ref: 'shutdowns' },
      { text: 'A single malware incident halted terminals of the world\'s largest container carrier in 2017.', ref: 'notpetya' },
    ],
    assumptions: [
      'Power grids and physical infrastructure stay intact; grid control degrades only slightly.',
      'Regional impact scales with digital dependence (internet penetration and digital share of activity).',
      'Weekly time steps cannot resolve the first hours; first-week effects are averaged.',
    ],
    caveat: 'Extrapolates far beyond national shutdowns; short-run behavioural responses are highly uncertain.',
  },
  {
    id: 'fossil', name: 'Sudden disappearance of fossil fuels', short: 'Fossil fuels', glyph: 'flame',
    premise: 'Oil, gas and coal stop being available. Existing stockpiles cushion the first weeks.',
    params: [
      { id: 'share', label: 'Fossil supply lost', type: 'range', min: 25, max: 100, step: 5, def: 100, unit: '%', doc: 'Share of fossil fuel supply that vanishes.' },
      { id: 'ramp', label: 'Disappearance period', type: 'range', min: 1, max: 260, step: 1, def: 1, unit: 'wk', doc: 'Weeks over which supply disappears.' },
      { id: 'buffer', label: 'Stockpile buffer', type: 'range', min: 0, max: 26, step: 1, def: 13, unit: 'wk', doc: 'Weeks of stocks drawn down. IEA members hold 90 days of net imports.' },
      response,
    ],
    shocks: (p) => [{ node: 'fossil', mag: -p.share / 100, prof: { ramp: Math.max(p.ramp, p.buffer, 1) } }],
    focus: ['energy_supply', 'power', 'food_supply', 'freight', 'gdp', 'health'],
    geo: { points: CHOKEPOINTS.filter((c) => ['Strait of Hormuz', 'Strait of Malacca', 'Suez Canal', 'Bab-el-Mandeb'].includes(c.name)), kind: 'Oil chokepoint', lanes: LANES.filter((l) => l.name === 'Gulf crude to East Asia') },
    anchors: [
      { text: 'Fossil fuels supply roughly 80% of global primary energy.', ref: 'ei2024' },
      { text: 'Synthetic nitrogen fertilizer, made mainly from natural gas, supports a large share of world food production.', ref: 'erisman2008' },
      { text: 'IEA members must hold emergency oil stocks equal to 90 days of net imports.', ref: 'iea_stocks' },
    ],
    assumptions: [
      'Fuel availability (physical) and production value (revenue) are separate nodes, so exporters lose income while users lose fuel.',
      'Clean energy expands only through adaptive pathways (high prices and innovation); its starting share comes from each region\'s energy mix.',
      'Energy prices are a scarcity indicator; above ~8% shortfall they represent rationing, not a market price.',
    ],
    caveat: 'Physically impossible premise, used as a stress test of fossil dependency. Outcomes beyond the first months are deeply uncertain.',
  },
  {
    id: 'sealevel', name: 'Five-metre sea-level rise', short: 'Sea level +5 m', glyph: 'wave',
    premise: 'Global mean sea level rises by up to five metres within a few years, flooding low-lying coasts not protected by defences.',
    params: [
      { id: 'rise', label: 'Sea-level rise', type: 'range', min: 0.5, max: 5, step: 0.5, def: 5, unit: 'm', doc: 'Rise in global mean sea level.' },
      { id: 'onset', label: 'Rise period', type: 'range', min: 1, max: 10, step: 1, def: 3, unit: 'yr', doc: 'Years over which the rise happens.' },
      { id: 'def', label: 'Coastal defences hold', type: 'range', min: 0, max: 60, step: 5, def: 20, unit: '%', doc: 'Share of exposed land protected by dikes and walls.' },
      response,
    ],
    shocks: (p) => [{ node: 'coast', mag: -Math.pow(p.rise / 5, 0.8) * (1 - p.def / 100), prof: { ramp: p.onset * 52, shape: 'smooth' } }],
    focus: ['displacement', 'ports', 'built', 'staple_yield', 'gdp'],
    geo: { kind: 'Low-lying coast', points: [
      { name: 'Ganges-Brahmaputra delta', lon: 90.4, lat: 22.6 }, { name: 'Nile delta', lon: 31.0, lat: 31.0 },
      { name: 'Mekong delta', lon: 105.8, lat: 9.8 }, { name: 'Shanghai', lon: 121.5, lat: 31.2 },
      { name: 'Jakarta', lon: 106.8, lat: -6.1 }, { name: 'Lagos', lon: 3.4, lat: 6.45 },
      { name: 'Miami', lon: -80.2, lat: 25.8 }, { name: 'Rotterdam', lon: 4.0, lat: 51.9 },
      { name: 'Mumbai', lon: 72.85, lat: 19.0 }, { name: 'Bangkok', lon: 100.5, lat: 13.75 },
      { name: 'New Orleans', lon: -90.1, lat: 29.95 }, { name: 'Tokyo', lon: 139.8, lat: 35.65 },
    ] },
    anchors: [
      { text: 'IPCC AR6 projects a likely 0.6-1.0 m of rise by 2100 under very high emissions; multi-metre rise unfolds over centuries.', ref: 'ipcc_ar6' },
      { text: 'Hundreds of millions of people live in the low-elevation coastal zone.', ref: 'macmanus2021' },
      { text: 'Estimates of exposed population depend strongly on the elevation model used.', ref: 'kulp2019' },
    ],
    assumptions: [
      'Affected land scales as (rise/5 m)^0.8 times each region\'s share of population below ~5 m. Both are assumptions.',
      'No elevation model is used: impacts are aggregated by macro-region, not mapped to coastlines.',
      'People in the lost zone relocate within their region unless other pathways push them further.',
    ],
    caveat: 'A five-metre rise within years is physically implausible; treat this as a thought experiment about coastal exposure.',
  },
  {
    id: 'clean', name: 'Unlimited clean energy', short: 'Clean energy', glyph: 'sun',
    premise: 'A large, cheap, zero-carbon electricity supply becomes deployable everywhere and scales up over several years.',
    params: [
      { id: 'growth', label: 'Clean output growth', type: 'range', min: 100, max: 1000, step: 50, def: 500, unit: '%', doc: 'Increase in clean energy output relative to today.' },
      { id: 'years', label: 'Build-out period', type: 'range', min: 1, max: 20, step: 1, def: 6, unit: 'yr', doc: 'Years to reach full scale.' },
      { id: 'bottleneck', label: 'Grid & storage bottleneck', type: 'range', min: 0, max: 60, step: 5, def: 25, unit: '%', doc: 'Share of new output that cannot be integrated or stored.' },
      response,
    ],
    shocks: (p) => [{ node: 'clean', mag: p.growth / 100, prof: { ramp: p.years * 52, shape: 'smooth' } }],
    edgeScale: (p) => ({ 'clean>energy_supply': 1 - p.bottleneck / 100 }),
    focus: ['energy_price', 'fossil_output', 'gdp', 'freshwater', 'resource_comp'],
    geo: { kind: 'Hydrocarbon exporter', points: [
      { name: 'Persian Gulf producers', lon: 50.5, lat: 26 }, { name: 'West Siberian basin', lon: 72, lat: 61 },
      { name: 'Niger delta', lon: 6.5, lat: 5 }, { name: 'Permian basin', lon: -102.5, lat: 31.8 },
    ] },
    anchors: [
      { text: 'Seawater reverse-osmosis desalination uses roughly 3-4 kWh per cubic metre.', ref: 'desal' },
      { text: 'Hydrocarbon rents are a large share of GDP in several exporting economies.', ref: 'wdi' },
    ],
    assumptions: [
      '"Unlimited" is not a defined physical quantity; it is represented as a multiple of today\'s clean output.',
      'Benefits of energy abundance for industry are tagged speculative; harms from shortage are established.',
      'Fossil fuel stays physically available; producers lose revenue and cut output as prices fall.',
    ],
    caveat: 'Positive premise with winners and losers. Gains are less evidenced than losses: energy abundance has no historical analogue at this scale.',
  },
  {
    id: 'amazon', name: 'Collapse of the Amazon rainforest', short: 'Amazon', glyph: 'leaf',
    premise: 'Large parts of the Amazon die back over several years, shifting toward degraded forest and savanna.',
    params: [
      { id: 'dieback', label: 'Forest lost', type: 'range', min: 20, max: 100, step: 5, def: 60, unit: '%', doc: 'Share of the Amazon forest that dies back.' },
      { id: 'years', label: 'Transition period', type: 'range', min: 1, max: 10, step: 1, def: 5, unit: 'yr', doc: 'Years over which dieback unfolds.' },
      { id: 'tele', label: 'Remote climate effects', type: 'range', min: 0, max: 100, step: 10, def: 30, unit: '%', doc: 'Strength of speculative rainfall teleconnections outside Latin America.' },
      response,
    ],
    shocks: (p) => {
      const ramp = p.years * 52;
      const tele = (p.tele / 100) * (p.dieback / 100);
      return [
        { node: 'forest', mag: -p.dieback / 100, regions: { lat: 1 }, prof: { ramp, shape: 'smooth' } },
        { node: 'rainfall', mag: -tele, regions: { nam: 0.06, ssa: 0.04, eur: 0.02 }, prof: { ramp, shape: 'smooth' }, basis: 'S',
          note: 'Remote rainfall changes from Amazon loss (teleconnections) are speculative.' },
      ];
    },
    focus: ['forest', 'rainfall', 'staple_yield', 'biodiversity', 'food_price', 'climate'],
    origin: ['lat'],
    geo: { kind: 'Basin', points: [
      { name: 'Amazon basin', lon: -62, lat: -4 },
      { name: 'La Plata basin (receives Amazon moisture)', lon: -58, lat: -27 },
    ] },
    anchors: [
      { text: 'Researchers have proposed a tipping point at roughly 20-25% deforestation combined with climate change.', ref: 'lovejoy2018' },
      { text: 'A 2024 synthesis estimated that 10-47% of the Amazon could face compounding disturbances by 2050.', ref: 'flores2024' },
    ],
    assumptions: [
      'Only Latin America is exposed to direct moisture-recycling loss (exposure 0.6).',
      'Carbon release raises global climate stress slowly (260-week adjustment time).',
      'World food prices couple to Latin America through its large share of agri-food exports.',
    ],
    caveat: 'Timing and extent of any tipping point are actively debated. Teleconnections are tagged speculative.',
  },
  {
    id: 'water', name: 'Global freshwater shortage', short: 'Freshwater', glyph: 'drop',
    premise: 'Renewable freshwater availability falls sharply over a few years, hitting already-stressed regions hardest.',
    params: [
      { id: 'sev', label: 'Freshwater lost (average)', type: 'range', min: 10, max: 60, step: 5, def: 30, unit: '%', doc: 'Average reduction in usable freshwater.' },
      { id: 'onset', label: 'Onset period', type: 'range', min: 1, max: 10, step: 1, def: 3, unit: 'yr', doc: 'Years over which the shortage develops.' },
      { id: 'pattern', label: 'Distribution', type: 'select', def: 'stress',
        options: [{ v: 'stress', l: 'Worst where already stressed' }, { v: 'uniform', l: 'Uniform' }],
        doc: 'Stress-weighted scales each region by its baseline water stress relative to the population-weighted mean (clamped 0.35-1.7).' },
      response,
    ],
    shocks: (p) => [{ node: 'freshwater', mag: -p.sev / 100,
      regions: p.pattern === 'uniform' ? null : Object.fromEntries(REGIONS.map((r) => [r.id, Math.min(1.7, Math.max(0.35, r.waterStress / WATER_MEAN))])),
      prof: { ramp: p.onset * 52, shape: 'smooth' } }],
    focus: ['freshwater', 'water_sys', 'staple_yield', 'health', 'resource_comp'],
    geo: { kind: 'Stressed basin', points: [
      { name: 'Indus basin', lon: 71, lat: 28 }, { name: 'North China Plain', lon: 116, lat: 37 },
      { name: 'Tigris-Euphrates', lon: 44, lat: 33 }, { name: 'Nile basin', lon: 32, lat: 22 },
      { name: 'Colorado River basin', lon: -112, lat: 36 }, { name: 'Murray-Darling basin', lon: 145, lat: -34 },
    ] },
    anchors: [
      { text: 'Agriculture accounts for about 70% of global freshwater withdrawals.', ref: 'aquastat' },
      { text: 'About 2.2 billion people lacked safely managed drinking water in 2022.', ref: 'jmp2023' },
      { text: 'About four billion people face severe water scarcity at least one month a year.', ref: 'mekonnen2016' },
    ],
    assumptions: [
      'Shortage is expressed as a drop in renewable availability; groundwater overdraft is not modelled separately.',
      'Interstate water conflict is tagged speculative; cooperation is historically more common.',
    ],
    caveat: 'Global shortage of this speed has no precedent; regional droughts are the closest analogues.',
  },
];

export const SCENARIO_INDEX = Object.fromEntries(SCENARIOS.map((s, i) => [s.id, i]));

export function defaultParams(scn) {
  return Object.fromEntries(scn.params.map((p) => [p.id, p.def]));
}
