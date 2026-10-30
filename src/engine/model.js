// AFTERSHOCK causal model.
// Every node is a deviation from a 2023-ish baseline (0 = no change).
// Every edge is a documented causal claim with an evidence class:
//   E = established relationship (direction well documented in literature)
//   A = model assumption (plausible mechanism; magnitude and sometimes existence assumed)
//   S = speculative (contested or weakly evidenced pathway)
// Edge weights (elasticities), lags and thresholds are ALWAYS model assumptions,
// even when the direction of the relationship is established.

export const SYSTEMS = [
  { id: 'eco', label: 'Ecology', color: '#5fbf8f' },
  { id: 'ag', label: 'Agriculture', color: '#b9c95a' },
  { id: 'en', label: 'Energy', color: '#f2b544' },
  { id: 'tr', label: 'Transport', color: '#e8875a' },
  { id: 'ec', label: 'Economy', color: '#e0697d' },
  { id: 'te', label: 'Technology', color: '#b884e6' },
  { id: 'in', label: 'Infrastructure', color: '#7a9cf0' },
  { id: 'so', label: 'Society', color: '#56c3d8' },
  { id: 'gp', label: 'Geopolitics', color: '#c9a98a' },
];

// unit: rel = relative change (shown as %), share = share of population, idx = pressure index (0-100 pts)
// pol: +1 higher is better, -1 higher is worse
// tau: adjustment time in weeks (first-order lag toward the level implied by drivers)
// agg: weighting used for the global aggregate
// cpl: global coupling (0..1) with weights field `cw`; mode 'sum' adds every region's drive (global commons)
export const NODES = [
  // Ecology
  { id: 'pollinators', sys: 'eco', label: 'Pollination service', unit: 'rel', pol: 1, tau: 8, min: -1, max: 0.1, agg: 'agProd', desc: 'Animal pollination delivered to crops and wild plants.' },
  { id: 'forest', sys: 'eco', label: 'Amazon forest integrity', unit: 'rel', pol: 1, tau: 52, min: -1, max: 0.05, agg: 'area', desc: 'Intact rainforest cover and function. Only Latin America has a non-zero baseline exposure.' },
  { id: 'rainfall', sys: 'eco', label: 'Rainfall reliability', unit: 'rel', pol: 1, tau: 13, min: -0.6, max: 0.2, agg: 'agProd', desc: 'Seasonal rainfall relative to the historical norm.' },
  { id: 'freshwater', sys: 'eco', label: 'Freshwater availability', unit: 'rel', pol: 1, tau: 12, min: -0.85, max: 0.3, agg: 'pop', desc: 'Renewable freshwater usable for people, farms and industry.' },
  { id: 'coast', sys: 'eco', label: 'Low-lying coastal land', unit: 'rel', pol: 1, tau: 8, min: -1, max: 0, agg: 'pop', desc: 'Habitable land in the low-elevation coastal zone. -100% means the whole exposed zone is lost.' },
  { id: 'biodiversity', sys: 'eco', label: 'Biodiversity intactness', unit: 'rel', pol: 1, tau: 104, min: -0.8, max: 0.05, agg: 'area', desc: 'Abundance and richness of native species relative to baseline.' },
  { id: 'climate', sys: 'eco', label: 'Climate stress', unit: 'idx', pol: -1, tau: 260, min: -0.3, max: 1, agg: 'pop', cpl: 1, cw: 'pop', cmode: 'sum', desc: 'Additional climate forcing. Global commons: every region\'s contribution adds to everyone\'s stress.' },

  // Agriculture
  { id: 'staple_yield', sys: 'ag', label: 'Staple crop yields', unit: 'rel', pol: 1, tau: 26, min: -0.9, max: 0.3, agg: 'agProd', desc: 'Yields of cereals, roots and pulses. Responds over growing seasons.' },
  { id: 'poll_crops', sys: 'ag', label: 'Pollinator-dependent harvests', unit: 'rel', pol: 1, tau: 26, min: -0.9, max: 0.2, agg: 'agProd', desc: 'Fruit, vegetables, nuts, oilseeds, coffee, cocoa and other animal-pollinated crops.' },
  { id: 'fertilizer', sys: 'ag', label: 'Fertilizer & farm inputs', unit: 'rel', pol: 1, tau: 8, min: -1, max: 0.5, agg: 'agProd', cpl: 0.4, cw: 'agExport', desc: 'Availability of synthetic fertilizer, seed and agrochemicals.' },
  { id: 'food_supply', sys: 'ag', label: 'Food availability', unit: 'rel', pol: 1, tau: 6, min: -0.8, max: 0.15, agg: 'pop', desc: 'Calories available per person, after trade.' },
  { id: 'food_price', sys: 'ag', label: 'Food prices', unit: 'rel', pol: -1, tau: 4, min: -0.6, max: 6, agg: 'agExport', cpl: 0.6, cw: 'agExport', desc: 'Real food prices. Coupled through world markets weighted by export share.' },
  { id: 'nutrition', sys: 'ag', label: 'Diet quality', unit: 'rel', pol: 1, tau: 13, min: -0.6, max: 0.1, agg: 'pop', desc: 'Micronutrient and diet-diversity adequacy.' },

  // Energy
  { id: 'fossil', sys: 'en', label: 'Fossil fuel availability', unit: 'rel', pol: 1, tau: 2, min: -1, max: 0.2, agg: 'enProd', desc: 'Oil, gas and coal physically available to users. Falls only when fuel is truly scarce.' },
  { id: 'fossil_output', sys: 'en', label: 'Fossil production value', unit: 'rel', pol: 1, tau: 13, min: -1, max: 0.5, agg: 'enProd', desc: 'Volume times price for producers. Falls when fuels vanish or when demand and prices drop.' },
  { id: 'clean', sys: 'en', label: 'Clean energy output', unit: 'rel', pol: 1, tau: 13, min: -0.6, max: 15, agg: 'gdp', desc: 'Output of renewables, nuclear and hydro relative to today.' },
  { id: 'energy_supply', sys: 'en', label: 'Total energy supply', unit: 'rel', pol: 1, tau: 3, min: -0.95, max: 2, agg: 'gdp', desc: 'Usable primary energy, fossil plus clean, weighted by each region\'s mix.' },
  { id: 'energy_price', sys: 'en', label: 'Energy prices', unit: 'rel', pol: -1, tau: 2, min: -0.85, max: 6, agg: 'enProd', cpl: 0.65, cw: 'enProd', desc: 'Real energy prices; scarcity-driven. Coupled through world markets.' },
  { id: 'power', sys: 'en', label: 'Grid reliability', unit: 'rel', pol: 1, tau: 1, min: -1, max: 0.1, agg: 'pop', desc: 'Share of electricity demand reliably served.' },

  // Transport
  { id: 'shipping', sys: 'tr', label: 'Maritime shipping', unit: 'rel', pol: 1, tau: 2, min: -1, max: 0.2, agg: 'gdp', cpl: 0.5, cw: 'gdp', desc: 'Operational ocean freight capacity. The global fleet is shared, so regions are coupled.' },
  { id: 'freight', sys: 'tr', label: 'Land & air freight', unit: 'rel', pol: 1, tau: 3, min: -1, max: 0.3, agg: 'gdp', desc: 'Trucking, rail and air cargo.' },
  { id: 'ports', sys: 'tr', label: 'Port operations', unit: 'rel', pol: 1, tau: 4, min: -1, max: 0.05, agg: 'gdp', desc: 'Functioning port and terminal capacity.' },

  // Economy
  { id: 'trade', sys: 'ec', label: 'International trade', unit: 'rel', pol: 1, tau: 4, min: -0.95, max: 0.5, agg: 'gdp', cpl: 0.4, cw: 'gdp', desc: 'Volume of cross-border trade in goods.' },
  { id: 'supply_chain', sys: 'ec', label: 'Supply-chain integrity', unit: 'rel', pol: 1, tau: 4, min: -0.95, max: 0.2, agg: 'gdp', desc: 'Ability of firms to source intermediate inputs on time.' },
  { id: 'industry', sys: 'ec', label: 'Industrial output', unit: 'rel', pol: 1, tau: 4, min: -0.9, max: 0.6, agg: 'gdp', desc: 'Manufacturing, construction and utilities output.' },
  { id: 'finance', sys: 'ec', label: 'Payments & finance', unit: 'rel', pol: 1, tau: 2, min: -0.9, max: 0.1, agg: 'gdp', desc: 'Functioning payments, settlement and credit.' },
  { id: 'gdp', sys: 'ec', label: 'Economic output', unit: 'rel', pol: 1, tau: 6, min: -0.8, max: 0.5, agg: 'gdp', desc: 'Real output relative to the no-shock baseline path.' },
  { id: 'inflation', sys: 'ec', label: 'Inflation pressure', unit: 'idx', pol: -1, tau: 8, min: -0.3, max: 1, agg: 'gdp', cpl: 0.2, cw: 'gdp', desc: 'Pressure on consumer prices (index points).' },
  { id: 'employment', sys: 'ec', label: 'Employment', unit: 'rel', pol: 1, tau: 26, min: -0.5, max: 0.1, agg: 'pop', desc: 'Employment rate relative to baseline.' },

  // Technology
  { id: 'internet', sys: 'te', label: 'Internet connectivity', unit: 'rel', pol: 1, tau: 1, min: -1, max: 0.05, agg: 'pop', desc: 'Working global and national connectivity.' },
  { id: 'digital', sys: 'te', label: 'Digital services', unit: 'rel', pol: 1, tau: 1, min: -1, max: 0.2, agg: 'gdp', desc: 'Cloud, software, logistics systems and online services.' },
  { id: 'innovation', sys: 'te', label: 'Adaptation & substitution', unit: 'rel', pol: 1, tau: 52, min: -0.5, max: 1, agg: 'gdp', cpl: 0.3, cw: 'gdp', desc: 'Capacity to invent, deploy and scale substitutes. Drives the adaptive (recovery) pathways.' },

  // Infrastructure
  { id: 'water_sys', sys: 'in', label: 'Water & sanitation', unit: 'rel', pol: 1, tau: 4, min: -0.9, max: 0.1, agg: 'pop', desc: 'Safe drinking water and sanitation services delivered.' },
  { id: 'built', sys: 'in', label: 'Built environment', unit: 'rel', pol: 1, tau: 13, min: -0.6, max: 0.1, agg: 'gdp', desc: 'Usable housing, buildings and urban infrastructure.' },
  { id: 'rebuild', sys: 'in', label: 'Reconstruction effort', unit: 'rel', pol: 1, tau: 52, min: 0, max: 1, agg: 'gdp', desc: 'Effort devoted to rebuilding and relocating damaged infrastructure. An adaptive response that grows while damage persists.' },
  { id: 'healthcare', sys: 'in', label: 'Healthcare capacity', unit: 'rel', pol: 1, tau: 8, min: -0.8, max: 0.2, agg: 'pop', desc: 'Hospitals, supplies and staff able to deliver care.' },

  // Society
  { id: 'health', sys: 'so', label: 'Population health', unit: 'rel', pol: 1, tau: 26, min: -0.5, max: 0.1, agg: 'pop', desc: 'Health status of the population (inverse of excess disease burden).' },
  { id: 'displacement', sys: 'so', label: 'Displacement', unit: 'share', pol: -1, tau: 26, min: 0, max: 0.6, agg: 'pop', desc: 'Additional share of the population forced to move.' },
  { id: 'unrest', sys: 'so', label: 'Social unrest', unit: 'idx', pol: -1, tau: 13, min: -0.2, max: 1, agg: 'pop', desc: 'Protest, riot and instability pressure (index points).' },
  { id: 'wellbeing', sys: 'so', label: 'Human wellbeing', unit: 'rel', pol: 1, tau: 13, min: -0.8, max: 0.3, agg: 'pop', desc: 'Composite of health, income, employment and security.' },

  // Geopolitics
  { id: 'resource_comp', sys: 'gp', label: 'Resource competition', unit: 'idx', pol: -1, tau: 26, min: -0.3, max: 1, agg: 'pop', desc: 'Competition between states over food, water and energy (index points).' },
  { id: 'tension', sys: 'gp', label: 'Interstate tension', unit: 'idx', pol: -1, tau: 26, min: -0.3, max: 1, agg: 'gdp', cpl: 0.3, cw: 'gdp', desc: 'Risk of interstate confrontation (index points).' },
  { id: 'cooperation', sys: 'gp', label: 'International cooperation', unit: 'rel', pol: 1, tau: 26, min: -0.8, max: 0.5, agg: 'gdp', cpl: 0.5, cw: 'gdp', desc: 'Functioning multilateral coordination, aid and agreements.' },
];

// Reference anchors. Entered from the authors' background knowledge; not re-verified inside this build.
export const REFS = {
  ipbes2016: 'IPBES (2016) Assessment Report on Pollinators, Pollination and Food Production',
  klein2007: 'Klein et al. (2007) Proc. R. Soc. B 274:303-313',
  eilers2011: 'Eilers et al. (2011) PLoS ONE 6(6):e21363',
  ollerton2011: 'Ollerton, Winfree & Tarrant (2011) Oikos 120:321-326',
  smith2015: 'Smith et al. (2015) The Lancet 386:1964-1972',
  aizen2009: 'Aizen et al. (2009) Annals of Botany 103:1579-1588',
  erisman2008: 'Erisman et al. (2008) Nature Geoscience 1:636-639',
  unctad: 'UNCTAD, Review of Maritime Transport (annual)',
  ei2024: 'Energy Institute, Statistical Review of World Energy (2024)',
  iea_stocks: 'IEA emergency oil stockholding obligation (90 days of net imports)',
  aquastat: 'FAO AQUASTAT global water withdrawal statistics',
  jmp2023: 'WHO/UNICEF Joint Monitoring Programme (2023)',
  mekonnen2016: 'Mekonnen & Hoekstra (2016) Science Advances 2:e1500323',
  ipcc_ar6: 'IPCC AR6 Working Group I, Chapter 9 (2021)',
  lovejoy2018: 'Lovejoy & Nobre (2018) Science Advances 4:eaat2340',
  flores2024: 'Flores et al. (2024) Nature 626:555-564',
  bellemare2015: 'Bellemare (2015) American Journal of Agricultural Economics 97(1):1-21',
  hamilton2009: 'Hamilton (2009) Brookings Papers on Economic Activity, Spring',
  okun: 'Okun\'s law (empirical regularity; coefficient varies by country)',
  gscpi: 'Federal Reserve Bank of New York, Global Supply Chain Pressure Index',
  shutdowns: 'Access Now #KeepItOn and NetBlocks shutdown records',
  tfdd: 'Oregon State University Transboundary Freshwater Dispute Database',
  macmanus2021: 'MacManus et al. (2021) Earth System Science Data 13:5747-5801',
  kulp2019: 'Kulp & Strauss (2019) Nature Communications 10:4844',
  notpetya: 'Maersk NotPetya incident (2017), company disclosures',
  suez2021: 'Ever Given blockage of the Suez Canal, March 2021',
  wpp2024: 'UN World Population Prospects 2024',
  wdi: 'World Bank World Development Indicators',
  desal: 'Seawater reverse-osmosis energy use, typically ~3-4 kWh/m3 (industry and IEA reporting)',
};

// Edge fields:
//  s,t source/target · w weight (elasticity on deviations) · lag weeks · b evidence class
//  th dead-zone threshold on |source| · kink {th,w}: extra weight once source falls below -th (scarcity amplification)
//  wPos/bPos weight & evidence when the source is above baseline · clip 'pos'|'neg' keep only that sign of contribution
//  exp region exposure field multiplying w · ad adaptive (recovery) edge scaled by response policy · u uncertainty override
export const EDGES = [
  // Ecology
  { s: 'pollinators', t: 'poll_crops', w: 0.55, lag: 0, b: 'E', why: 'Most leading crop types depend partly on animal pollination, so output of that crop group falls with pollination service. The aggregate dependency of 0.55 is an assumption informed by crop dependency classes.', ref: ['ipbes2016', 'klein2007'] },
  { s: 'pollinators', t: 'biodiversity', w: 0.3, lag: 26, b: 'E', why: 'Most flowering plants are animal-pollinated; losing pollinators reduces wild plant reproduction and the fauna that depend on those plants.', ref: ['ollerton2011'] },
  { s: 'forest', t: 'rainfall', w: 0.5, lag: 26, b: 'E', exp: 'amazonDep', why: 'Amazon evapotranspiration recycles moisture that falls as rain across the basin and downwind into the La Plata basin.', ref: ['lovejoy2018'] },
  { s: 'forest', t: 'climate', w: -0.12, lag: 52, b: 'E', why: 'Dieback releases stored carbon and removes a carbon sink, adding to global forcing. Magnitude over a decade is an assumption.', ref: ['flores2024'] },
  { s: 'forest', t: 'biodiversity', w: 0.45, lag: 26, b: 'E', why: 'The Amazon holds a large share of known terrestrial species; habitat loss lowers biodiversity intactness.' },
  { s: 'climate', t: 'staple_yield', w: -0.25, lag: 26, b: 'E', why: 'More heat and drought extremes reduce staple yields in most regions.', ref: ['ipcc_ar6'] },
  { s: 'climate', t: 'freshwater', w: -0.2, lag: 26, b: 'E', why: 'Warming shifts precipitation, shrinks snowpack and raises evaporation.' },
  { s: 'climate', t: 'health', w: -0.08, lag: 52, b: 'A', why: 'Heat stress and shifting disease ranges add to the disease burden.' },
  { s: 'rainfall', t: 'staple_yield', w: 0.45, lag: 13, b: 'E', why: 'Rain-fed farming yields track seasonal rainfall.' },
  { s: 'rainfall', t: 'freshwater', w: 0.6, lag: 8, b: 'E', why: 'Rainfall recharges rivers, reservoirs and aquifers.' },
  { s: 'rainfall', t: 'clean', w: 0.15, lag: 8, b: 'E', why: 'Hydropower output falls in drought; hydro-heavy grids such as Brazil\'s are most exposed.' },
  { s: 'freshwater', t: 'staple_yield', w: 0.45, lag: 13, b: 'E', why: 'Irrigated land produces a large share of food, and agriculture takes about 70% of global freshwater withdrawals.', ref: ['aquastat'] },
  { s: 'freshwater', t: 'water_sys', w: 0.7, lag: 4, b: 'E', why: 'Utilities cannot deliver water that is not there.' },
  { s: 'freshwater', t: 'power', w: 0.15, lag: 8, b: 'A', why: 'Thermal plants need cooling water and hydro needs river flow.' },
  { s: 'freshwater', t: 'industry', w: 0.12, lag: 8, b: 'A', why: 'Water-intensive industries (chips, chemicals, textiles) curtail output.' },
  { s: 'freshwater', t: 'resource_comp', w: -0.5, lag: 26, b: 'S', th: 0.1, why: 'Scarcity may intensify competition over shared basins. Contested: historically, transboundary water disputes more often end in agreements than in war.', ref: ['tfdd'] },
  { s: 'coast', t: 'displacement', w: -0.85, lag: 4, b: 'A', exp: 'lowCoast', why: 'People living on inundated land must move. Assumes 85% of the exposed population in the lost zone relocates.', ref: ['macmanus2021', 'kulp2019'] },
  { s: 'coast', t: 'built', w: 1.2, lag: 4, b: 'A', exp: 'lowCoast', why: 'Buildings and infrastructure concentrate in coastal cities; the asset loss share is assumed to be 1.2x the population share.' },
  { s: 'coast', t: 'ports', w: 0.85, lag: 4, b: 'E', why: 'Nearly all port infrastructure sits within a few metres of current sea level.' },
  { s: 'coast', t: 'staple_yield', w: 0.9, lag: 26, b: 'E', exp: 'lowCoast', why: 'Low-lying deltas (Nile, Ganges-Brahmaputra, Mekong) are major grain and rice producers; flooding and salinization remove cropland.' },
  { s: 'coast', t: 'freshwater', w: 0.25, lag: 26, b: 'E', exp: 'lowCoast', why: 'Saltwater intrusion contaminates coastal aquifers and river intakes.' },
  { s: 'coast', t: 'power', w: 0.3, lag: 4, b: 'A', exp: 'lowCoast', why: 'Many power plants and substations are sited on coasts for cooling water.' },
  { s: 'coast', t: 'biodiversity', w: 0.1, lag: 52, b: 'A', why: 'Wetlands and mangroves drown where they cannot migrate inland.' },

  // Agriculture
  { s: 'staple_yield', t: 'food_supply', w: 0.8, lag: 4, b: 'E', why: 'Staples provide most dietary calories.' },
  { s: 'poll_crops', t: 'food_supply', w: 1.0, lag: 4, b: 'E', exp: 'pollShare', why: 'Pollinator-dependent crops are a small share of calories; pollination directly accounts for roughly 5-8% of global crop production volume.', ref: ['ipbes2016', 'aizen2009'] },
  { s: 'poll_crops', t: 'nutrition', w: 0.35, lag: 8, b: 'E', why: 'Pollinator-dependent crops supply a disproportionate share of vitamin A, vitamin C, folate and healthy fats.', ref: ['eilers2011', 'smith2015'] },
  { s: 'poll_crops', t: 'food_price', w: -0.25, lag: 4, b: 'A', why: 'Fruit, vegetable, nut and oilseed prices rise as output falls.' },
  { s: 'poll_crops', t: 'gdp', w: 1.0, lag: 13, b: 'E', exp: 'pollGdp', why: 'The market value of pollinator-dependent production is lost; IPBES puts the annual value of pollination at US$235-577bn.', ref: ['ipbes2016'] },
  { s: 'fertilizer', t: 'staple_yield', w: 0.35, lag: 26, b: 'E', why: 'Synthetic nitrogen supports a large share of global food production; yields fall within one or two seasons without it.', ref: ['erisman2008'] },
  { s: 'fossil', t: 'fertilizer', w: 0.7, lag: 8, b: 'E', why: 'Ammonia is made mostly from natural gas, which is both the fuel and the hydrogen feedstock.' },
  { s: 'energy_price', t: 'fertilizer', w: -0.12, lag: 8, b: 'E', why: 'Fertilizer plants curtail output when gas prices spike (as in Europe in 2022).' },
  { s: 'shipping', t: 'fertilizer', w: 0.25, lag: 6, b: 'A', why: 'Fertilizers and their feedstocks are heavily traded by sea.' },
  { s: 'clean', t: 'fertilizer', w: 0.03, lag: 104, b: 'S', clip: 'pos', ad: true, why: 'Cheap clean electricity could make electrolytic ammonia viable at scale. Not yet demonstrated at that scale.' },
  { s: 'energy_supply', t: 'staple_yield', w: 0.12, wPos: 0.02, lag: 13, b: 'A', why: 'Mechanization, irrigation pumping, drying and cold chains need energy.' },
  { s: 'food_supply', t: 'food_price', w: -1.5, kink: { th: 0.05, w: -4 }, lag: 2, b: 'E', why: 'Food demand is price-inelastic in the short run, so small shortfalls move prices a lot. Beyond a 5% shortfall, hoarding and export bans amplify prices further (2007-08, 2010-11). Both slopes are assumptions.' },
  { s: 'trade', t: 'food_supply', w: 0.5, lag: 4, b: 'E', exp: 'foodImport', why: 'Import-dependent regions lose calories when trade stalls.' },
  { s: 'freight', t: 'food_supply', w: 0.15, lag: 2, b: 'E', why: 'Domestic distribution from farms to cities depends on trucks and rail.' },
  { s: 'energy_price', t: 'food_price', w: 0.2, lag: 8, b: 'E', why: 'Energy costs pass through to food via fuel, fertilizer, processing and transport.' },
  { s: 'food_price', t: 'nutrition', w: -0.15, lag: 8, b: 'E', why: 'Poorer households cut diet diversity first when prices rise.' },
  { s: 'food_supply', t: 'nutrition', w: 0.5, lag: 4, b: 'E', why: 'Less food means less diverse diets.' },
  { s: 'food_supply', t: 'health', w: 0.4, lag: 13, b: 'E', th: 0.03, why: 'Sustained calorie shortfalls raise malnutrition, disease susceptibility and mortality.' },
  { s: 'nutrition', t: 'health', w: 0.25, lag: 26, b: 'E', why: 'Micronutrient deficiencies raise the disease burden.', ref: ['smith2015'] },
  { s: 'food_price', t: 'unrest', w: 0.25, lag: 8, b: 'E', th: 0.15, why: 'Food price spikes are statistically associated with riots and unrest.', ref: ['bellemare2015'] },
  { s: 'food_supply', t: 'displacement', w: -0.12, lag: 26, b: 'A', th: 0.08, why: 'Severe food insecurity drives distress migration.' },

  // Energy
  { s: 'fossil', t: 'energy_supply', sym: true, w: 1, lag: 0, b: 'E', u: 0, exp: 'fossilShare', why: 'Accounting identity: fossil fuels\' share of each region\'s primary energy (about 80% globally).', ref: ['ei2024'] },
  { s: 'clean', t: 'energy_supply', sym: true, w: 1, lag: 0, b: 'E', u: 0, exp: 'cleanShare', why: 'Accounting identity: clean sources\' share of each region\'s primary energy.' },
  { s: 'energy_supply', t: 'energy_price', w: -1.2, kink: { th: 0.08, w: -4 }, lag: 2, b: 'E', why: 'Short-run energy demand is highly inelastic; shortfalls beyond about 8% push prices to rationing levels. Both slopes are assumptions.' },
  { s: 'energy_supply', t: 'power', w: 0.8, wPos: 0.05, lag: 1, b: 'E', why: 'Generation needs primary energy. Surplus energy barely improves an already reliable grid.' },
  { s: 'energy_supply', t: 'industry', w: 0.35, wPos: 0.08, bPos: 'S', lag: 4, b: 'E', why: 'Energy shortages cut industrial output (established). Whether abundant energy raises output, and by how much, is speculative.' },
  { s: 'fossil', t: 'freight', w: 0.75, lag: 2, b: 'E', why: 'Road, rail and air freight run overwhelmingly on oil products.' },
  { s: 'fossil', t: 'shipping', w: 0.9, lag: 2, b: 'E', why: 'Ships burn heavy fuel oil and marine diesel; alternatives exist only at pilot scale.' },
  { s: 'fossil', t: 'healthcare', w: 0.15, lag: 8, b: 'A', why: 'Medical plastics, pharmaceuticals and sterile supplies use petrochemical feedstocks.' },
  { s: 'fossil', t: 'fossil_output', sym: true, w: 1, lag: 0, b: 'E', u: 0, why: 'Producers cannot sell fuel that does not exist.' },
  { s: 'energy_price', t: 'fossil_output', w: 0.6, lag: 13, b: 'E', clip: 'neg', why: 'When prices fall, producers lose revenue per unit and cut output. Price spikes are not credited because spare capacity is small.' },
  { s: 'fossil_output', t: 'gdp', w: 1, lag: 4, b: 'E', exp: 'energyRent', why: 'Hydrocarbon exporters lose export and fiscal revenue in proportion to their resource rents.', ref: ['wdi'] },
  { s: 'fossil_output', t: 'climate', w: 0.05, lag: 52, b: 'S', exp: 'emitShare', why: 'Ending combustion stops emissions growth, but warming does not reverse within a decade; losing aerosol cooling may even add short-term warming.', ref: ['ipcc_ar6'] },
  { s: 'energy_price', t: 'inflation', w: 0.25, lag: 4, b: 'E', why: 'Energy is a direct and indirect component of consumer prices.' },
  { s: 'energy_price', t: 'gdp', w: -0.05, lag: 13, b: 'E', why: 'Oil price shocks have historically preceded recessions.', ref: ['hamilton2009'] },
  { s: 'energy_price', t: 'clean', w: 0.25, lag: 52, b: 'A', clip: 'pos', ad: true, why: 'High energy prices pull investment into alternatives (as after 1973 and 2022).' },
  { s: 'energy_price', t: 'innovation', w: 0.15, lag: 26, b: 'A', clip: 'pos', ad: true, why: 'Scarcity prices create strong incentives to substitute and economize.' },
  { s: 'power', t: 'digital', w: 0.8, lag: 1, b: 'E', why: 'Data centres, networks and devices need continuous electricity.' },
  { s: 'power', t: 'water_sys', w: 0.5, lag: 1, b: 'E', why: 'Pumping and treatment stop without power.' },
  { s: 'power', t: 'healthcare', w: 0.4, lag: 1, b: 'E', why: 'Hospitals depend on grid power beyond short backup windows.' },
  { s: 'power', t: 'industry', w: 0.35, lag: 1, b: 'E', why: 'Factories stop when the grid fails.' },
  { s: 'clean', t: 'freshwater', w: 0.03, lag: 52, b: 'A', clip: 'pos', ad: true, exp: 'waterStress', why: 'Abundant electricity makes desalination and reuse affordable; seawater reverse osmosis uses roughly 3-4 kWh per cubic metre.', ref: ['desal'] },
  { s: 'energy_supply', t: 'resource_comp', w: -0.3, lag: 26, b: 'S', th: 0.1, why: 'Energy scarcity has fed geopolitical competition (1973, 2022); abundance might ease it. Both directions are debated.' },

  // Transport
  { s: 'shipping', t: 'trade', w: 0.9, lag: 2, b: 'E', exp: 'seaShare', why: 'More than 80% of world trade by volume moves by sea.', ref: ['unctad'] },
  { s: 'ports', t: 'shipping', w: 0.8, lag: 2, b: 'E', why: 'Ships are useless without working ports.' },
  { s: 'freight', t: 'supply_chain', w: 0.4, lag: 2, b: 'E', why: 'Inputs move between suppliers by truck, rail and air.' },
  { s: 'shipping', t: 'supply_chain', w: 0.45, lag: 3, b: 'E', why: 'Container disruptions in 2021-22 propagated through global supply chains.', ref: ['gscpi', 'suez2021'] },
  { s: 'shipping', t: 'energy_supply', w: 0.35, lag: 4, b: 'E', exp: 'energyImportPos', why: 'Oil, LNG and coal importers lose supply when tankers and bulk carriers stop.' },
  { s: 'digital', t: 'freight', w: 0.25, lag: 1, b: 'E', why: 'Dispatch, routing, customs and inventory systems are digital.' },
  { s: 'digital', t: 'shipping', w: 0.3, lag: 1, b: 'E', why: 'Terminals and carriers depend on IT systems; NotPetya halted Maersk terminals in 2017.', ref: ['notpetya'] },
  { s: 'innovation', t: 'freight', repair: true, w: 0.2, lag: 52, b: 'A', ad: true, why: 'Substitution through electrified rail, rerouting and new logistics.' },
  { s: 'tension', t: 'shipping', w: -0.12, lag: 4, b: 'S', why: 'Confrontation can close chokepoints (Red Sea attacks, 2023-24).' },

  // Economy
  { s: 'trade', t: 'supply_chain', w: 0.5, lag: 4, b: 'E', exp: 'tradeOpen', why: 'Open economies source more intermediate inputs abroad.' },
  { s: 'trade', t: 'gdp', w: 0.25, lag: 8, b: 'E', exp: 'tradeOpen', why: 'Exports and imported inputs are part of output.' },
  { s: 'supply_chain', t: 'industry', w: 0.6, lag: 4, b: 'E', why: 'Missing components halt assembly lines (2021 chip shortage).' },
  { s: 'industry', t: 'gdp', w: 0.35, lag: 4, b: 'E', why: 'Industry is roughly a quarter to a third of output.' },
  { s: 'digital', t: 'finance', w: 0.7, lag: 1, b: 'E', why: 'Card payments, interbank settlement and trading are network-dependent.' },
  { s: 'finance', t: 'gdp', w: 0.3, lag: 2, b: 'E', why: 'Payment and credit failures halt transactions (cf. 2008).' },
  { s: 'finance', t: 'trade', w: 0.3, lag: 2, b: 'E', why: 'Trade finance such as letters of credit runs on bank networks.' },
  { s: 'digital', t: 'supply_chain', w: 0.4, lag: 1, b: 'E', why: 'Ordering, tracking and just-in-time scheduling are software-driven.' },
  { s: 'digital', t: 'gdp', w: 0.2, lag: 2, b: 'E', exp: 'internetDep', why: 'Digital services are a large and growing share of output.' },
  { s: 'gdp', t: 'employment', w: 0.5, lag: 13, b: 'E', why: 'Output losses translate into job losses.', ref: ['okun'] },
  { s: 'employment', t: 'unrest', w: -0.5, lag: 13, b: 'A', th: 0.03, why: 'Mass unemployment raises protest and instability.' },
  { s: 'gdp', t: 'healthcare', w: 0.3, lag: 26, b: 'E', why: 'Health budgets follow output and tax revenue.' },
  { s: 'gdp', t: 'innovation', w: 0.2, lag: 52, b: 'A', ad: true, why: 'R&D and investment capacity scale with output.' },
  { s: 'inflation', t: 'unrest', w: 0.35, lag: 8, b: 'A', th: 0.1, why: 'Cost-of-living crises fuel protest.' },
  { s: 'food_price', t: 'inflation', w: 0.25, lag: 4, b: 'E', why: 'Food is a large share of consumer price baskets, larger in poorer countries.' },
  { s: 'supply_chain', t: 'inflation', w: -0.4, lag: 8, b: 'E', why: 'Supply bottlenecks raise goods prices (2021-22).', ref: ['gscpi'] },
  { s: 'gdp', t: 'wellbeing', w: 0.3, lag: 13, b: 'A', why: 'Income supports material wellbeing.' },
  { s: 'employment', t: 'wellbeing', w: 0.3, lag: 13, b: 'A', why: 'Job loss lowers income, status and mental health.' },
  { s: 'built', t: 'gdp', w: 0.15, lag: 13, b: 'E', why: 'Destroyed capital stock lowers output.' },

  // Technology
  { s: 'internet', t: 'digital', w: 0.9, lag: 0, b: 'E', exp: 'internetDep', why: 'Online services stop when connectivity stops; regions differ in how much they depend on it.' },
  { s: 'digital', t: 'healthcare', w: 0.15, lag: 2, b: 'A', why: 'Records, scheduling, imaging and supply ordering are networked.' },
  { s: 'digital', t: 'power', w: 0.08, lag: 2, b: 'A', why: 'Grid control and electricity markets rely partly on networks.' },
  { s: 'digital', t: 'innovation', w: 0.2, lag: 26, b: 'A', why: 'Collaboration and knowledge diffusion run online.' },
  { s: 'internet', t: 'wellbeing', w: 0.08, lag: 2, b: 'A', why: 'Loss of communication with family, services and information.' },
  { s: 'innovation', t: 'poll_crops', repair: true, w: 0.25, lag: 104, b: 'S', ad: true, why: 'Hand and mechanical pollination exist at small scale (e.g. pear orchards in Sichuan); scaling them globally is speculative.' },
  { s: 'innovation', t: 'staple_yield', repair: true, w: 0.1, lag: 104, b: 'A', ad: true, why: 'Breeding, agronomy and input efficiency recover some yield.' },
  { s: 'innovation', t: 'freshwater', repair: true, w: 0.12, lag: 104, b: 'A', ad: true, why: 'Efficiency, reuse and desalination expand usable water.' },
  { s: 'innovation', t: 'clean', w: 0.5, lag: 52, b: 'A', ad: true, why: 'Faster deployment of renewables, storage and grids.' },
  { s: 'food_price', t: 'innovation', w: 0.15, lag: 26, b: 'A', clip: 'pos', ad: true, why: 'High food prices pull investment into agricultural substitutes and productivity.' },
  { s: 'freshwater', t: 'innovation', w: -0.2, lag: 26, b: 'A', clip: 'pos', ad: true, why: 'Water scarcity pulls investment into efficiency, reuse and desalination.' },
  { s: 'shipping', t: 'innovation', w: -0.12, lag: 13, b: 'A', clip: 'pos', ad: true, why: 'Freight shortages pull investment into rail, air and rerouting.' },
  { s: 'cooperation', t: 'innovation', w: 0.3, lag: 52, b: 'A', ad: true, why: 'Shared R&D, finance and technology transfer speed adaptation.' },

  // Infrastructure
  { s: 'water_sys', t: 'health', w: 0.4, lag: 8, b: 'E', th: 0.03, why: 'Loss of safe water and sanitation raises waterborne disease.', ref: ['jmp2023'] },
  { s: 'healthcare', t: 'health', w: 0.3, lag: 13, b: 'E', why: 'Less care means more untreated illness.' },
  { s: 'built', t: 'displacement', w: -0.15, lag: 13, b: 'A', why: 'People leave places where housing and services are destroyed, beyond those directly flooded.' },
  { s: 'ports', t: 'rebuild', w: -0.8, lag: 13, b: 'A', clip: 'pos', ad: true, why: 'Port losses trigger reconstruction and relocation of terminals.' },
  { s: 'built', t: 'rebuild', w: -1.5, lag: 13, b: 'A', clip: 'pos', ad: true, why: 'Destroyed housing and infrastructure trigger rebuilding further inland.' },
  { s: 'rebuild', t: 'ports', repair: true, w: 0.6, lag: 26, b: 'A', why: 'New and relocated terminals restore part of the lost port capacity over years.' },
  { s: 'rebuild', t: 'built', repair: true, w: 0.5, lag: 26, b: 'A', why: 'Reconstruction restores part of the built environment.' },

  // Society
  { s: 'health', t: 'wellbeing', w: 0.4, lag: 4, b: 'A', why: 'Health is a core component of wellbeing.' },
  { s: 'health', t: 'employment', w: 0.15, lag: 26, b: 'A', why: 'Illness reduces labour supply.' },
  { s: 'displacement', t: 'tension', w: 0.3, lag: 26, b: 'S', why: 'Large cross-border movements can strain relations between states. Contested.' },
  { s: 'displacement', t: 'unrest', w: 0.3, lag: 26, b: 'A', why: 'Displacement strains host communities and services.' },
  { s: 'displacement', t: 'wellbeing', w: -0.4, lag: 4, b: 'A', why: 'Loss of home, livelihood and community.' },
  { s: 'unrest', t: 'gdp', w: -0.08, lag: 13, b: 'A', why: 'Instability disrupts commerce and investment.' },
  { s: 'unrest', t: 'tension', w: 0.2, lag: 26, b: 'S', why: 'Domestic crises can spill into external confrontation. Weak evidence.' },
  { s: 'unrest', t: 'wellbeing', w: -0.2, lag: 4, b: 'A', why: 'Insecurity lowers wellbeing.' },
  { s: 'food_price', t: 'wellbeing', w: -0.08, lag: 4, b: 'A', why: 'Higher food bills squeeze household budgets.' },

  // Geopolitics
  { s: 'resource_comp', t: 'tension', w: 0.5, lag: 26, b: 'S', why: 'Competition over scarce resources can raise interstate tension.' },
  { s: 'food_supply', t: 'resource_comp', w: -0.4, lag: 26, b: 'S', th: 0.05, why: 'Food shortages trigger export bans and competition for supply.' },
  { s: 'tension', t: 'cooperation', w: -0.4, lag: 13, b: 'A', why: 'Confrontation crowds out coordination.' },
  { s: 'cooperation', t: 'trade', w: 0.2, lag: 13, b: 'A', why: 'Agreements and open markets support trade.' },
  { s: 'tension', t: 'trade', w: -0.15, lag: 13, b: 'A', why: 'Sanctions and fragmentation reduce trade.' },
  { s: 'trade', t: 'tension', w: -0.08, lag: 26, b: 'S', why: 'Commercial-peace hypothesis: interdependence may restrain conflict. Contested.' },
];

export const BASIS = {
  E: { label: 'Established relationship', short: 'Established', conf: 0.9, unc: 0.25 },
  A: { label: 'Model assumption', short: 'Assumption', conf: 0.6, unc: 0.5 },
  S: { label: 'Speculative pathway', short: 'Speculative', conf: 0.3, unc: 0.85 },
};

export const edgeKey = (e) => `${e.s}>${e.t}`;
