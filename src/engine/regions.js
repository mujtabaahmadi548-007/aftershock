// Macro-regions and their baseline / exposure data.
//
// STATUS OF THESE NUMBERS
// - pop, gdp: rounded approximations (~2023) of UN WPP 2024 and World Bank WDI figures, entered from
//   general knowledge and NOT re-verified in this build. Good to roughly +/-10%.
// - Every other field is a MODEL ASSUMPTION: an exposure index chosen by the authors to represent how
//   strongly a region is coupled to a pathway. They are informed by public statistics where noted but are
//   not measured quantities and should not be cited as data.

export const REGIONS = [
  { id: 'nam', name: 'North America', lon: -100, lat: 46, pop: 375, gdp: 29.5,
    fossilShare: 0.79, energyImport: -0.1, energyRent: 0.015, emitShare: 0.15, internetDep: 0.92, tradeOpen: 0.3, seaShare: 0.7,
    foodImport: 0.1, pollShare: 0.08, pollGdp: 0.002, lowCoast: 0.03, waterStress: 0.35, amazonDep: 0.0, adaptive: 0.9,
    agProd: 0.12, agExport: 0.17, enProd: 0.2, area: 0.14 },
  { id: 'lat', name: 'Latin America & Caribbean', lon: -60, lat: -12, pop: 665, gdp: 6.5,
    fossilShare: 0.68, energyImport: -0.05, energyRent: 0.03, emitShare: 0.05, internetDep: 0.75, tradeOpen: 0.45, seaShare: 0.85,
    foodImport: 0.15, pollShare: 0.12, pollGdp: 0.01, lowCoast: 0.05, waterStress: 0.2, amazonDep: 0.6, adaptive: 0.55,
    agProd: 0.11, agExport: 0.2, enProd: 0.07, area: 0.15 },
  { id: 'eur', name: 'Europe', lon: 15, lat: 50, pop: 680, gdp: 24.6,
    fossilShare: 0.7, energyImport: 0.55, energyRent: 0.005, emitShare: 0.12, internetDep: 0.9, tradeOpen: 0.9, seaShare: 0.75,
    foodImport: 0.15, pollShare: 0.08, pollGdp: 0.002, lowCoast: 0.05, waterStress: 0.3, amazonDep: 0.0, adaptive: 0.85,
    agProd: 0.12, agExport: 0.15, enProd: 0.08, area: 0.04 },
  { id: 'rca', name: 'Russia & Central Asia', lon: 75, lat: 55, pop: 241, gdp: 2.6,
    fossilShare: 0.88, energyImport: -0.9, energyRent: 0.12, emitShare: 0.06, internetDep: 0.8, tradeOpen: 0.45, seaShare: 0.5,
    foodImport: 0.1, pollShare: 0.05, pollGdp: 0.004, lowCoast: 0.01, waterStress: 0.4, amazonDep: 0.0, adaptive: 0.5,
    agProd: 0.06, agExport: 0.06, enProd: 0.12, area: 0.15 },
  { id: 'mena', name: 'Middle East & North Africa', lon: 38, lat: 27, pop: 494, gdp: 3.9,
    fossilShare: 0.97, energyImport: -1.2, energyRent: 0.15, emitShare: 0.07, internetDep: 0.75, tradeOpen: 0.6, seaShare: 0.85,
    foodImport: 0.5, pollShare: 0.09, pollGdp: 0.006, lowCoast: 0.07, waterStress: 0.85, amazonDep: 0.0, adaptive: 0.5,
    agProd: 0.04, agExport: 0.02, enProd: 0.17, area: 0.08 },
  { id: 'ssa', name: 'Sub-Saharan Africa', lon: 22, lat: 1, pop: 1200, gdp: 2.0,
    fossilShare: 0.4, energyImport: -0.1, energyRent: 0.06, emitShare: 0.03, internetDep: 0.4, tradeOpen: 0.5, seaShare: 0.9,
    foodImport: 0.2, pollShare: 0.1, pollGdp: 0.02, lowCoast: 0.03, waterStress: 0.45, amazonDep: 0.0, adaptive: 0.3,
    agProd: 0.09, agExport: 0.04, enProd: 0.05, area: 0.16 },
  { id: 'sas', name: 'South Asia', lon: 78, lat: 23, pop: 1940, gdp: 4.4,
    fossilShare: 0.75, energyImport: 0.4, energyRent: 0.01, emitShare: 0.1, internetDep: 0.55, tradeOpen: 0.4, seaShare: 0.9,
    foodImport: 0.08, pollShare: 0.08, pollGdp: 0.012, lowCoast: 0.08, waterStress: 0.8, amazonDep: 0.0, adaptive: 0.4,
    agProd: 0.15, agExport: 0.04, enProd: 0.05, area: 0.04 },
  { id: 'eas', name: 'East Asia', lon: 112, lat: 35, pop: 1640, gdp: 24.5,
    fossilShare: 0.83, energyImport: 0.3, energyRent: 0.01, emitShare: 0.34, internetDep: 0.85, tradeOpen: 0.4, seaShare: 0.9,
    foodImport: 0.2, pollShare: 0.09, pollGdp: 0.006, lowCoast: 0.07, waterStress: 0.6, amazonDep: 0.0, adaptive: 0.75,
    agProd: 0.22, agExport: 0.06, enProd: 0.2, area: 0.09 },
  { id: 'sea', name: 'Southeast Asia', lon: 112, lat: 4, pop: 690, gdp: 3.8,
    fossilShare: 0.8, energyImport: 0.1, energyRent: 0.03, emitShare: 0.06, internetDep: 0.7, tradeOpen: 0.9, seaShare: 0.9,
    foodImport: 0.15, pollShare: 0.1, pollGdp: 0.012, lowCoast: 0.12, waterStress: 0.3, amazonDep: 0.0, adaptive: 0.5,
    agProd: 0.07, agExport: 0.12, enProd: 0.05, area: 0.03 },
  { id: 'oce', name: 'Oceania', lon: 140, lat: -25, pop: 45, gdp: 2.0,
    fossilShare: 0.9, energyImport: -1.5, energyRent: 0.04, emitShare: 0.012, internetDep: 0.88, tradeOpen: 0.45, seaShare: 0.98,
    foodImport: 0.1, pollShare: 0.07, pollGdp: 0.004, lowCoast: 0.05, waterStress: 0.4, amazonDep: 0.0, adaptive: 0.8,
    agProd: 0.02, agExport: 0.06, enProd: 0.03, area: 0.06 },
];

// Derived exposure fields.
for (const r of REGIONS) {
  r.cleanShare = +(1 - r.fossilShare).toFixed(3);
  r.energyImportPos = Math.max(0, r.energyImport);
}

export const FIELD_DOCS = {
  pop: { label: 'Population (millions)', status: 'data', note: 'Rounded ~2023, UN WPP 2024.' },
  gdp: { label: 'GDP (US$ trillion, nominal)', status: 'data', note: 'Rounded ~2023, World Bank WDI.' },
  fossilShare: { label: 'Fossil share of primary energy', status: 'assumption', note: 'Informed by Energy Institute Statistical Review; regional blend is approximate.' },
  energyImport: { label: 'Net energy import dependence', status: 'assumption', note: 'Positive = importer, negative = exporter (relative to own use).' },
  energyRent: { label: 'Hydrocarbon rents (share of GDP)', status: 'assumption', note: 'Informed by World Bank natural-resource-rent series; regional blend.' },
  emitShare: { label: 'Share of global CO2 emissions', status: 'assumption', note: 'Approximate.' },
  internetDep: { label: 'Digital dependence', status: 'assumption', note: 'Index 0-1, informed by internet penetration.' },
  tradeOpen: { label: 'Trade openness', status: 'assumption', note: 'Index scaled from trade/GDP.' },
  seaShare: { label: 'Seaborne share of trade', status: 'assumption', note: 'Global seaborne share by volume is >80% (UNCTAD); regional values assumed.' },
  foodImport: { label: 'Food import dependence', status: 'assumption', note: 'Share of calories imported; MENA is the most import-dependent region.' },
  pollShare: { label: 'Pollinator-dependent share of crop output', status: 'assumption', note: 'Globally ~5-8% of production volume is attributable to pollination (IPBES).' },
  pollGdp: { label: 'Pollination value at risk (share of GDP)', status: 'assumption', note: 'Higher where agriculture is a larger share of the economy.' },
  lowCoast: { label: 'Population share below ~5 m elevation', status: 'assumption', note: 'Wide uncertainty; depends on elevation model (cf. Kulp & Strauss 2019).' },
  waterStress: { label: 'Baseline water stress', status: 'assumption', note: 'Index 0-1.' },
  amazonDep: { label: 'Dependence on Amazon moisture recycling', status: 'assumption', note: 'Non-zero only for Latin America.' },
  adaptive: { label: 'Adaptive capacity', status: 'assumption', note: 'Index 0-1 reflecting income and institutional capacity. Scales adaptive pathways.' },
  agProd: { label: 'Share of world crop production', status: 'assumption', note: 'Aggregation weight.' },
  agExport: { label: 'Share of world agri-food exports', status: 'assumption', note: 'Coupling weight for world food prices.' },
  enProd: { label: 'Share of world energy production', status: 'assumption', note: 'Coupling weight for world energy prices.' },
  area: { label: 'Share of land area', status: 'assumption', note: 'Aggregation weight for ecological nodes.' },
};

const MAP = {
  nam: ['Canada', 'United States of America', 'Greenland'],
  lat: ['Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Rep.', 'Puerto Rico', 'Bahamas', 'Trinidad and Tobago', 'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'Ecuador', 'Peru', 'Brazil', 'Bolivia', 'Paraguay', 'Chile', 'Argentina', 'Uruguay', 'Falkland Is.'],
  eur: ['Iceland', 'Ireland', 'United Kingdom', 'Portugal', 'Spain', 'France', 'Belgium', 'Netherlands', 'Luxembourg', 'Germany', 'Switzerland', 'Austria', 'Italy', 'Denmark', 'Norway', 'Sweden', 'Finland', 'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Croatia', 'Bosnia and Herz.', 'Serbia', 'Montenegro', 'Kosovo', 'Albania', 'Macedonia', 'Greece', 'Bulgaria', 'Romania', 'Moldova', 'Ukraine', 'Belarus', 'Cyprus', 'N. Cyprus', 'Turkey'],
  rca: ['Russia', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Georgia', 'Armenia', 'Azerbaijan'],
  mena: ['Morocco', 'W. Sahara', 'Algeria', 'Tunisia', 'Libya', 'Egypt', 'Israel', 'Palestine', 'Lebanon', 'Syria', 'Jordan', 'Iraq', 'Iran', 'Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Kuwait'],
  ssa: ['Mauritania', 'Mali', 'Niger', 'Chad', 'Sudan', 'S. Sudan', 'Eritrea', 'Djibouti', 'Ethiopia', 'Somalia', 'Somaliland', 'Senegal', 'Gambia', 'Guinea-Bissau', 'Guinea', 'Sierra Leone', 'Liberia', "Côte d'Ivoire", 'Burkina Faso', 'Ghana', 'Togo', 'Benin', 'Nigeria', 'Cameroon', 'Central African Rep.', 'Eq. Guinea', 'Gabon', 'Congo', 'Dem. Rep. Congo', 'Uganda', 'Kenya', 'Rwanda', 'Burundi', 'Tanzania', 'Angola', 'Zambia', 'Malawi', 'Mozambique', 'Zimbabwe', 'Botswana', 'Namibia', 'South Africa', 'Lesotho', 'eSwatini', 'Madagascar'],
  sas: ['Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka'],
  eas: ['China', 'Mongolia', 'North Korea', 'South Korea', 'Japan', 'Taiwan'],
  sea: ['Myanmar', 'Thailand', 'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Brunei', 'Indonesia', 'Philippines', 'Timor-Leste'],
  oce: ['Australia', 'New Zealand', 'Papua New Guinea', 'Solomon Is.', 'Vanuatu', 'Fiji', 'New Caledonia'],
};

export const UNMAPPED = ['Antarctica', 'Fr. S. Antarctic Lands'];

export const COUNTRY_REGION = {};
for (const [rid, names] of Object.entries(MAP)) for (const n of names) COUNTRY_REGION[n] = rid;

export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));
