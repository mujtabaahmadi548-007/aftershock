// Navigable 3D globe (orthographic projection on canvas) with region-level impact overlays.
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';
import { COUNTRY_REGION, REGION_INDEX, REGIONS } from '../engine/regions.js';
import { MODEL, NODE_INDEX, N, RN } from '../engine/engine.js';
import { setupCanvas, sevColor, sevRGB, rgb, reducedMotion, fmtNode } from './format.js';

const COUNTRIES = feature(atlas, atlas.objects.countries).features.map((f) => ({
  f, name: f.properties.name, r: REGION_INDEX[COUNTRY_REGION[f.properties.name]] ?? -1,
}));
const GRAT = geoGraticule10();
const SPHERE = { type: 'Sphere' };

// Max |severity| of a node across regions and time, used as a shared colour-scale extent.
export function layerExtent(run, nodeId) {
  if (!run) return 1;
  const n = NODE_INDEX[nodeId], node = MODEL.nodes[n];
  let m = 0;
  for (let t = 0; t <= run.T; t += 2) for (let r = 0; r < REGIONS.length; r++) m = Math.max(m, Math.abs(run.x[t * RN + r * N + n]));
  return Math.max(m, node.unit === 'idx' ? 0.02 : 0.005);
}

export function regionValue(run, nodeId, r, t) {
  const n = NODE_INDEX[nodeId];
  const t0 = Math.floor(t), t1 = Math.min(run.T, t0 + 1), f = t - t0;
  return run.x[t0 * RN + r * N + n] * (1 - f) + run.x[t1 * RN + r * N + n] * f;
}

export function createView() { return { rot: [-20, -18], k: 1, last: -1e9 }; }

export class Globe {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.opts = opts;
    this.view = opts.view || createView();
    this.run = null; this.layer = 'gdp'; this.t = 0; this.sel = -1; this.hover = -1; this.hoverPt = null;
    this.ext = 1;
    this.proj = geoOrthographic().clipAngle(90).precision(0.6);
    this.path = null;
    this.drag = null;
    this.bind();
  }
  setRun(run) { this.run = run; }
  setLayer(id) { this.layer = id; }
  setExtent(e) { this.ext = e; }
  setTime(t) { this.t = t; }
  setSelected(r) { this.sel = r; }

  bind() {
    const c = this.c;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0 };
    });
    c.addEventListener('pointermove', (e) => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        const s = 0.28 / this.view.k;
        this.view.rot[0] += dx * s;
        this.view.rot[1] = Math.max(-75, Math.min(75, this.view.rot[1] - dy * s));
        this.view.last = performance.now();
        this.opts.onHover && this.opts.onHover(null);
      } else this.pick(e, false);
    });
    const end = (e) => {
      if (this.drag && this.drag.moved < 5) this.pick(e, true);
      this.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { this.drag = null; });
    c.addEventListener('pointerleave', () => { this.hover = -1; this.hoverPt = null; this.opts.onHover && this.opts.onHover(null); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.view.k = Math.max(0.75, Math.min(3.2, this.view.k * Math.exp(-e.deltaY * 0.0012)));
      this.view.last = performance.now();
    }, { passive: false });
  }

  pick(e, click) {
    const rect = this.c.getBoundingClientRect();
    const p = [e.clientX - rect.left, e.clientY - rect.top];
    // geographic points first
    const pts = this.geoPoints();
    for (const g of pts) {
      if (g.xy && Math.hypot(g.xy[0] - p[0], g.xy[1] - p[1]) < 8) {
        this.hoverPt = g; this.hover = -1;
        this.opts.onHover && this.opts.onHover({ x: e.clientX, y: e.clientY, html: `<b>${g.name}</b><span>${g.kind || 'Site'} · schematic marker</span>` });
        return;
      }
    }
    this.hoverPt = null;
    const ll = this.proj.invert(p);
    let r = -1, name = null;
    if (ll && geoDistance(ll, [-this.view.rot[0], -this.view.rot[1]]) < Math.PI / 2) {
      for (const c of COUNTRIES) if (geoContains(c.f, ll)) { r = c.r; name = c.name; break; }
    }
    this.hover = r;
    if (click) { this.opts.onSelect && this.opts.onSelect(r); return; }
    if (!this.opts.onHover) return;
    if (r < 0 || !this.run) { this.opts.onHover(name ? { x: e.clientX, y: e.clientY, html: `<b>${name}</b><span>Not modelled</span>` } : null); return; }
    const node = MODEL.nodes[NODE_INDEX[this.layer]];
    const v = regionValue(this.run, this.layer, r, this.t);
    this.opts.onHover({ x: e.clientX, y: e.clientY, html: `<b>${REGIONS[r].name}</b><span>${name}</span><span>${node.label}: <em>${fmtNode(node, v)}</em></span><span class="tip-hint">Click to inspect region</span>` });
  }

  geoPoints() {
    const geo = this.run && this.run.scenario.geo;
    if (!geo || !geo.points) return [];
    return geo.points.map((p) => ({ ...p, kind: geo.kind, xy: this._visible([p.lon, p.lat]) ? this.proj([p.lon, p.lat]) : null }));
  }
  _visible(ll) { return geoDistance(ll, [-this.view.rot[0], -this.view.rot[1]]) < Math.PI / 2 - 0.02; }

  frame(now, dt) {
    const v = this.view;
    if (!this.drag && !this.opts.follower && !reducedMotion() && now - v.last > 4500) v.rot[0] += dt * 0.0045;
    this.draw(now);
  }

  draw(now) {
    const { ctx, w, h } = setupCanvas(this.c);
    if (w < 10 || h < 10) return;
    const R0 = Math.min(w, h) * 0.45 * this.view.k;
    const cx = w / 2, cy = h / 2;
    this.proj.translate([cx, cy]).scale(R0).rotate([this.view.rot[0], this.view.rot[1]]);
    const path = geoPath(this.proj, ctx);
    ctx.clearRect(0, 0, w, h);

    // atmosphere
    const atm = ctx.createRadialGradient(cx, cy, R0 * 0.96, cx, cy, R0 * 1.22);
    atm.addColorStop(0, 'rgba(98,150,214,0.30)');
    atm.addColorStop(0.35, 'rgba(70,110,170,0.10)');
    atm.addColorStop(1, 'rgba(40,60,100,0)');
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(cx, cy, R0 * 1.22, 0, Math.PI * 2); ctx.fill();

    // ocean
    const oc = ctx.createRadialGradient(cx - R0 * 0.35, cy - R0 * 0.4, R0 * 0.1, cx, cy, R0 * 1.05);
    oc.addColorStop(0, '#13243a'); oc.addColorStop(0.7, '#0a1424'); oc.addColorStop(1, '#060c17');
    ctx.beginPath(); path(SPHERE); ctx.fillStyle = oc; ctx.fill();

    ctx.beginPath(); path(GRAT); ctx.strokeStyle = 'rgba(150,180,220,0.07)'; ctx.lineWidth = 0.6; ctx.stroke();

    const run = this.run;
    const node = MODEL.nodes[NODE_INDEX[this.layer]];
    const sev = REGIONS.map((_, r) => (run ? node.pol * regionValue(run, this.layer, r, this.t) : 0));

    // countries
    for (const c of COUNTRIES) {
      ctx.beginPath(); path(c.f);
      ctx.fillStyle = c.r < 0 ? '#131b27' : sevColor(sev[c.r], this.ext);
      ctx.fill();
    }
    ctx.beginPath();
    for (const c of COUNTRIES) path(c.f);
    ctx.strokeStyle = 'rgba(4,8,14,0.75)'; ctx.lineWidth = 0.5; ctx.stroke();

    const hl = (r, col, lw) => {
      ctx.beginPath();
      for (const c of COUNTRIES) if (c.r === r) path(c.f);
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
    };
    if (this.hover >= 0 && this.hover !== this.sel) hl(this.hover, 'rgba(232,237,244,0.45)', 1);
    if (this.sel >= 0) hl(this.sel, '#f4f1e8', 1.6);

    // lighting
    const lt = ctx.createRadialGradient(cx - R0 * 0.45, cy - R0 * 0.5, R0 * 0.05, cx, cy, R0);
    lt.addColorStop(0, 'rgba(255,255,255,0.06)'); lt.addColorStop(0.55, 'rgba(0,0,0,0)'); lt.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.beginPath(); path(SPHERE); ctx.fillStyle = lt; ctx.fill();
    ctx.beginPath(); path(SPHERE); ctx.strokeStyle = 'rgba(150,190,240,0.25)'; ctx.lineWidth = 1; ctx.stroke();

    if (!run) return;
    const anim = reducedMotion() ? 0 : now;
    const geo = run.scenario.geo || {};

    // schematic lanes
    if (geo.lanes) {
      const shipN = MODEL.nodes[NODE_INDEX.shipping];
      const g = run.g, t0 = Math.min(run.T, Math.round(this.t));
      const sv = shipN.pol * g[t0 * N + shipN.i];
      ctx.setLineDash([3, 6]); ctx.lineDashOffset = -anim * 0.012 * (1 + sv);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = Math.abs(sv) < 0.01 ? 'rgba(170,205,240,0.55)' : sevColor(sv, 0.6, 0.85);
      for (const lane of geo.lanes) { ctx.beginPath(); path({ type: 'LineString', coordinates: lane.pts }); ctx.stroke(); }
      ctx.setLineDash([]);
    }

    // origin arcs
    if (run.scenario.origin) {
      for (const oid of run.scenario.origin) {
        const o = REGIONS.find((r) => r.id === oid);
        ctx.setLineDash([2, 5]); ctx.lineDashOffset = -anim * 0.02;
        REGIONS.forEach((r, i) => {
          if (r.id === oid) return;
          const a = Math.min(1, Math.abs(sev[i]) / this.ext);
          if (a < 0.04) return;
          ctx.beginPath(); path({ type: 'LineString', coordinates: [[o.lon, o.lat], [r.lon, r.lat]] });
          ctx.strokeStyle = sevColor(sev[i], this.ext, 0.25 + 0.6 * a); ctx.lineWidth = 0.8 + 1.6 * a; ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    }

    // hotspots
    REGIONS.forEach((r, i) => {
      const a = Math.min(1, Math.abs(sev[i]) / this.ext);
      if (a < 0.03 || !this._visible([r.lon, r.lat])) return;
      const [x, y] = this.proj([r.lon, r.lat]);
      const col = sevRGB(sev[i], this.ext);
      const base = 3 + 10 * Math.sqrt(a) * Math.min(1.4, this.view.k);
      const ph = anim ? ((anim * 0.0006 + i * 0.17) % 1) : 0.5;
      ctx.beginPath(); ctx.arc(x, y, base + ph * 16 * a, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(col, (1 - ph) * 0.65); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, Math.max(2, base * 0.45), 0, Math.PI * 2);
      ctx.fillStyle = rgb(col, 0.95); ctx.fill();
      ctx.strokeStyle = 'rgba(5,9,15,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    });

    // geographic markers
    for (const p of this.geoPoints()) {
      if (!p.xy) continue;
      const [x, y] = p.xy, s = p === this.hoverPt || (this.hoverPt && this.hoverPt.name === p.name) ? 6 : 4;
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
      ctx.fillStyle = 'rgba(6,10,16,0.85)'; ctx.fill();
      ctx.strokeStyle = '#f0c27a'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // selected region label
    if (this.sel >= 0 && this._visible([REGIONS[this.sel].lon, REGIONS[this.sel].lat])) {
      const r = REGIONS[this.sel];
      const [x, y] = this.proj([r.lon, r.lat]);
      ctx.font = '600 11px "Archivo", system-ui, sans-serif';
      const label = r.name.toUpperCase();
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(6,10,16,0.82)';
      ctx.fillRect(x + 12, y - 22, tw + 12, 18);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillText(label, x + 18, y - 9);
    }
  }
}
