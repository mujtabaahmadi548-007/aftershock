// Small canvas charts: sparklines with uncertainty bands, and a larger annotated time-series chart.
import { setupCanvas, HARM, GOOD } from './format.js';

const yearTicks = (T) => { const out = []; for (let w = 52; w < T; w += 52) out.push(w); return out; };

function extent(list) {
  let lo = 0, hi = 0;
  for (const s of list) for (const k of ['c', 'lo', 'hi']) if (s[k]) for (const v of s[k]) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 1e-6) { hi += 0.01; lo -= 0.01; }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

// series: {c, lo, hi}; pol: node polarity (+1 good up); t: cursor
export function sparkline(canvas, s, t, { pol = 1, T = s.c.length - 1, color } = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const [y0, y1] = extent([s]);
  const X = (i) => (i / T) * (w - 2) + 1;
  const Y = (v) => h - 2 - ((v - y0) / (y1 - y0)) * (h - 4);
  const last = s.c[Math.min(T, Math.round(t))] || 0;
  const col = color || (last * pol < 0 ? HARM : GOOD);
  // band
  if (s.lo) {
    ctx.beginPath();
    for (let i = 0; i <= T; i += 2) ctx.lineTo(X(i), Y(s.hi[i]));
    for (let i = T - (T % 2); i >= 0; i -= 2) ctx.lineTo(X(i), Y(s.lo[i]));
    ctx.closePath(); ctx.fillStyle = 'rgba(160,180,210,0.13)'; ctx.fill();
  }
  // zero
  ctx.strokeStyle = 'rgba(160,180,210,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke(); ctx.setLineDash([]);
  // future (dim) + past (bright)
  const tc = Math.min(T, Math.max(0, Math.round(t)));
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(160,180,210,0.35)';
  ctx.beginPath(); for (let i = tc; i <= T; i++) ctx.lineTo(X(i), Y(s.c[i])); ctx.stroke();
  ctx.strokeStyle = col;
  ctx.beginPath(); for (let i = 0; i <= tc; i++) ctx.lineTo(X(i), Y(s.c[i])); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(tc), Y(s.c[tc]), 2.6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
}

// Larger chart. lines: [{s:{c,lo,hi}, color, label, dash}]; fmt: value formatter
export function chart(canvas, lines, t, { T, fmt = (v) => v.toFixed(2), branch = null } = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const padL = 52, padR = 10, padT = 10, padB = 20;
  const [y0, y1] = extent(lines.map((l) => l.s));
  const X = (i) => padL + (i / T) * (w - padL - padR);
  const Y = (v) => padT + (1 - (v - y0) / (y1 - y0)) * (h - padT - padB);
  ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillStyle = '#7f8ea4'; ctx.strokeStyle = 'rgba(160,180,210,0.08)'; ctx.lineWidth = 1;
  // y ticks
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let k = 0; k <= 3; k++) {
    const v = y0 + ((y1 - y0) * k) / 3, y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(fmt(v), padL - 6, y);
  }
  // zero line
  if (y0 < 0 && y1 > 0) { ctx.strokeStyle = 'rgba(200,215,235,0.28)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke(); ctx.setLineDash([]); }
  // x ticks
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#7f8ea4';
  for (const wk of yearTicks(T)) { const x = X(wk); ctx.fillText(`Y${wk / 52}`, x, h - padB + 5); ctx.strokeStyle = 'rgba(160,180,210,0.06)'; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke(); }
  if (branch != null) { ctx.strokeStyle = 'rgba(244,241,232,0.5)'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(X(branch), padT); ctx.lineTo(X(branch), h - padB); ctx.stroke(); ctx.setLineDash([]); }
  for (const l of lines) {
    const s = l.s;
    if (s.lo) {
      ctx.beginPath();
      for (let i = 0; i <= T; i += 2) ctx.lineTo(X(i), Y(s.hi[i]));
      for (let i = T - (T % 2); i >= 0; i -= 2) ctx.lineTo(X(i), Y(s.lo[i]));
      ctx.closePath(); ctx.fillStyle = l.band || 'rgba(160,180,210,0.12)'; ctx.fill();
    }
    ctx.strokeStyle = l.color; ctx.lineWidth = 1.6; ctx.setLineDash(l.dash || []);
    ctx.beginPath(); for (let i = 0; i <= T; i++) ctx.lineTo(X(i), Y(s.c[i])); ctx.stroke(); ctx.setLineDash([]);
  }
  const tc = Math.min(T, Math.max(0, Math.round(t)));
  ctx.strokeStyle = '#f4f1e8'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(X(tc), padT); ctx.lineTo(X(tc), h - padB); ctx.stroke(); ctx.globalAlpha = 1;
  for (const l of lines) { ctx.beginPath(); ctx.arc(X(tc), Y(l.s.c[tc]), 3, 0, Math.PI * 2); ctx.fillStyle = l.color; ctx.fill(); }
}
