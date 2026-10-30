# AFTERSHOCK — The Consequence Engine

Introduce a hypothetical change to the world and watch its consequences cascade through ecology, agriculture,
energy, transport, the economy, technology, infrastructure, society and geopolitics. Every link and every number
is labelled by how well it is supported.

**This is an exploratory model, not a forecast.** It has not been validated against outcomes. Results are
conditional on the premise you choose and on the assumptions documented in the app's *Model & assumptions* view.

## Run it

```bash
npm install          # esbuild, d3-geo, topojson-client, world-atlas
npm test             # engine test suite (Node's built-in runner, no UI involved)
npm run build        # bundles everything into dist/index.html (one self-contained page)
# open dist/preview.html in a browser (full HTML document; the map data is embedded)
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers python3 scripts/smoke.py   # optional headless UI smoke test
```

## Architecture

```
src/engine/            pure, deterministic, no DOM
  model.js             9 systems, 43 variables, 129 causal links (each with evidence class, rationale, references)
  regions.js           10 macro-regions: rounded baseline data + labelled exposure assumptions; country→region map
  scenarios.js         8 scenarios: premise, parameters, shocks, assumptions, literature anchors, plausibility caveat
  engine.js            simulation, sensitivity envelope, pathway confidence, driver attribution, events, KPIs, branching
src/ui/                vanilla ES modules, canvas rendering
  globe.js             orthographic 3D globe: regional impact fills, hotspots, schematic lanes/sites, origin arcs
  network.js           animated causal network (ellipse layout, evidence-coloured links, harm/benefit particles)
  timeline.js          seismograph-style intensity strip with consequence markers and scrubbing
  panels.js            scenario picker, parameters, indicators, inspector with expandable causal tree, consequences
  compare.js           counterfactual futures (branch at a week, or a different hypothetical) side by side
  modelview.js         every variable, link, regional value, scenario assumption and reference in readable tables
  main.js              state, playback clock (play, pause, rewind, step, 4 speeds), selection, views, keyboard
test/engine.test.js    19 tests: determinism, baseline, bounds at parameter extremes, causality and lags, recovery,
                       monotonicity, branch identity, faithful explanations, direction checks, repair cap, map coverage
```

## How the engine works

Each variable is a deviation from a no-shock baseline, per region, per week, over 10 years. Each week it moves
toward the level implied by its drivers with a first-order delay (system-dynamics form):

```
drive(t) = shocks + Σ links  f(source(t − lag)) × exposure(region) × scale
x(t+1)   = x(t) + (clamp(drive) − x(t)) / τ
```

Markets couple regions (prices, trade, shipping…); climate stress is a global commons. Two documented rules:
the **gain rule** (improvements transmit at half strength and count as speculative) and the **repair rule**
(rebuilding and substitution can cancel damage but never lift a variable above baseline).

**Integrity labels.** Links are *established* (direction documented), *assumption* or *speculative*. Outputs carry a
*pathway confidence* (contributions weighted 0.9 / 0.6 / 0.3 by evidence class, multiplied along the causal chain).
Consequences are *estimated* (≥ 50%) or *speculative* (< 50%, or reached only by the upper sensitivity bound).

**Uncertainty.** Two extra deterministic runs scale every link by its class uncertainty (±25 / 50 / 85%), stronger and
weaker transmission. The band is their envelope: a sensitivity range, not a statistical confidence interval.
No random numbers are used anywhere.

## Data status

Population and GDP are rounded ~2023 figures (UN WPP 2024, World Bank WDI) entered from general knowledge and not
re-verified in this build. All other regional values are exposure indices chosen by the authors. Reference anchors
were entered from background knowledge; check a source before citing anything that depends on it.
