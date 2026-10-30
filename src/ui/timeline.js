// Seismograph-style timeline: aggregate shock intensity over time, event ticks by evidence class, scrubber.
import { MODEL, N } from '../engine/engine.js';
import { REGIONS } from '../engine/regions.js';
import { setupCanvas, OUTCOME, HARM, GOOD, fmtWeek } from './format.js';

// Intensity = mean over nodes of |global deviation| normalised by that node's maximum in this run,
// signed by whether the net change is harmful or beneficial. It is a visual summary, not a model output.
export function intensity(run) {
  const T = run.T, out = new Float64Array(T + 1), sgn = new Float64Array(T + 1);
  const mx = MODEL.nodes.map((n) => { let m = 0; for (let t = 0; t <= T; t++) m = Math.max(m, Math.abs(run.g[t * N + n.i])); return m; });
  const gmx = Math.max(...mx, 1e-6);
  for (let t = 0; t <= T; t++) {
    let s = 0, d = 0;
    for (const n of MODEL.nodes) {
      const v = run.g[t * N + n.i];
      // weight nodes by their own peak relative to the largest, so tiny wiggles do not dominate
      const wgt = Math.sqrt(mx[n.i] / gmx);
      if (mx[n.i] > 1e-9) { s += wgt * Math.abs(v) / mx[n.i]; d += wgt * n.pol * v / mx[n.i]; }
    }
    out[t] = s; sgn[t] = d;
  }
  const m = Math.max(...out, 1e-9);
  for (let t = 0; t <= T; t++) out[t] /= m;
  return { v: out, sgn };
}

export class Timeline {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.opts = opts; this.run = null; this.runB = null; this.t = 0; this.hoverEv = null;
    this.bind();
  }
  setRun(run) { this.run = run; this.I = run ? intensity(run) : null; }
  setRunB(run) { this.runB = run; this.IB = run ? intensity(run) : null; }
  setTime(t) { this.t = t; }

  geom(w) { const padL = 8, padR = 8; return { padL, X: (t) => padL + (t / this.run.T) * (w - padL - padR), T: (x) => ((x - padL) / (w - padL - padR)) * this.run.T }; }

  bind() {
    const c = this.c;
    c.style.touchAction = 'none';
    let scrub = false;
    const tAt = (e) => { const r = c.getBoundingClientRect(); return Math.max(0, Math.min(this.run.T, this.geom(r.width).T(e.clientX - r.left))); };
    c.addEventListener('pointerdown', (e) => {
      if (!this.run) return;
      const ev = this.eventAt(e);
      if (ev) { this.opts.onEvent && this.opts.onEvent(ev); return; }
      scrub = true; c.setPointerCapture(e.pointerId); this.opts.onScrub && this.opts.onScrub(tAt(e), true);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.run) return;
      if (scrub) { this.opts.onScrub && this.opts.onScrub(tAt(e), true); return; }
      const ev = this.eventAt(e);
      this.hoverEv = ev;
      c.style.cursor = ev ? 'pointer' : 'ew-resize';
      if (this.opts.onHover) {
        if (ev) {
          const cls = OUTCOME[ev.cls];
          const where = ev.region >= 0 ? REGIONS[ev.region].name : 'World';
          this.opts.onHover({ x: e.clientX, y: e.clientY, html: `<b>${ev.title}</b><span>${where} · ${fmtWeek(ev.t)}</span><span>${cls.label}${ev.conf != null ? ` · pathway confidence ${(ev.conf * 100).toFixed(0)}%` : ''}</span>` });
        } else this.opts.onHover(null);
      }
    });
    const up = () => { if (scrub) { scrub = false; this.opts.onScrub && this.opts.onScrub(null, false); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { this.hoverEv = null; this.opts.onHover && this.opts.onHover(null); });
  }

  eventMarks(w) {
    if (!this.run) return [];
    const { X } = this.geom(w);
    // one mark per (event id, first time) in lanes to limit overlap
    const marks = [];
    const lanes = [];
    for (const ev of this.run.events) {
      const x = X(ev.t);
      let lane = 0;
      while (lanes[lane] !== undefined && x - lanes[lane] < 7) lane++;
      if (lane > 3) continue;
      lanes[lane] = x;
      marks.push({ ev, x, y: 8 + lane * 7 });
    }
    return marks;
  }
  eventAt(e) {
    const r = this.c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 6;
    for (const m of this.eventMarks(r.width)) { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m.ev; } }
    return best;
  }

  frame() {
    const { ctx, w, h } = setupCanvas(this.c);
    ctx.clearRect(0, 0, w, h);
    if (!this.run) return;
    const { X } = this.geom(w);
    const T = this.run.T;
    const top = 34, bot = h - 16, mid = (top + bot) / 2, amp = (bot - top) / 2;
    // year grid
    ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (let wk = 0; wk <= T; wk += 52) {
      const x = X(wk);
      ctx.strokeStyle = 'rgba(160,180,210,0.10)'; ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, bot); ctx.stroke();
      ctx.fillStyle = '#6c7b90'; ctx.fillText(wk === 0 ? 'T+0' : `Y${wk / 52}`, Math.min(w - 14, Math.max(14, x)), h - 3);
    }
    // midline
    ctx.strokeStyle = 'rgba(160,180,210,0.22)'; ctx.beginPath(); ctx.moveTo(X(0), mid); ctx.lineTo(X(T), mid); ctx.stroke();
    // waveform: mirrored seismograph hatch
    const tc = this.t;
    const I = this.I;
    for (let px = Math.floor(X(0)); px <= X(T); px++) {
      const t = Math.max(0, Math.min(T, Math.round(((px - X(0)) / (X(T) - X(0))) * T)));
      const v = I.v[t];
      if (v < 0.002) continue;
      // seismic jitter: deterministic texture from the time index, purely visual
      const jit = 0.82 + 0.18 * Math.abs(Math.sin(t * 12.9898) * 0.5 + Math.sin(t * 4.1414) * 0.5);
      const a = v * amp * jit;
      const past = t <= tc;
      const col = I.sgn[t] < 0 ? HARM : GOOD;
      ctx.strokeStyle = col; ctx.globalAlpha = past ? 0.9 : 0.22;
      ctx.beginPath(); ctx.moveTo(px + 0.5, mid - a); ctx.lineTo(px + 0.5, mid + a); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (this.IB && this.runB) {
      ctx.strokeStyle = '#9fc3ff'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]);
      ctx.beginPath();
      for (let t = 0; t <= Math.min(T, this.runB.T); t++) ctx.lineTo(X(t), mid - this.IB.v[t] * amp);
      ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    // events
    for (const m of this.eventMarks(w)) {
      const col = OUTCOME[m.ev.cls].color;
      ctx.globalAlpha = m.ev.t <= tc ? 1 : 0.4;
      ctx.fillStyle = col;
      if (m.ev.cls === 'premise') { ctx.fillRect(m.x - 1, m.y - 4, 2, 8); }
      else if (m.ev.cls === 'estimated') { ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(m.x, m.y, 2.4, 0, Math.PI * 2); ctx.stroke(); }
      if (this.hoverEv === m.ev) { ctx.strokeStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    // cursor
    const x = X(tc);
    ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, bot + 2); ctx.stroke();
    ctx.fillStyle = '#f4f1e8';
    ctx.beginPath(); ctx.moveTo(x - 5, bot + 2); ctx.lineTo(x + 5, bot + 2); ctx.lineTo(x, bot - 4); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1;
  }
}
