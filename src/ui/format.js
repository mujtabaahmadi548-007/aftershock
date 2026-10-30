// Formatting, color scales and small DOM helpers shared by the UI.
import { SYSTEMS } from '../engine/model.js';

export const EVIDENCE = {
  P: { label: 'Premise (your hypothetical)', short: 'Premise', color: '#e8edf4' },
  E: { label: 'Established relationship', short: 'Established', color: '#5cc99c' },
  A: { label: 'Model assumption', short: 'Assumption', color: '#74a9ff' },
  S: { label: 'Speculative pathway', short: 'Speculative', color: '#c592f7' },
};
export const OUTCOME = {
  premise: { label: 'Premise', color: '#e8edf4' },
  estimated: { label: 'Estimated consequence', color: '#f2b544' },
  speculative: { label: 'Speculative possibility', color: '#c592f7' },
  possible: { label: 'Speculative possibility', color: '#c592f7', note: 'Only the high-transmission bound reaches this threshold.' },
};
export const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) n.style.setProperty(sk, String(sv)); else n.style[sk] = sv; } }
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
};
export const $ = (sel, root = document) => root.querySelector(sel);

const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
export function fmtPctRaw(v, dp) {
  const a = Math.abs(v * 100);
  const d = dp ?? (a < 1 ? 2 : a < 10 ? 1 : 0);
  if (a < 0.005) return '0%';
  return `${sign(v)}${a.toFixed(d)}%`;
}
export function fmtNode(node, v) {
  if (node.unit === 'share') return `${(Math.max(0, v) * 100).toFixed(v * 100 < 1 ? 2 : 1)}% of pop.`;
  if (node.unit === 'idx') { const a = Math.abs(v * 100); return a < 0.05 ? '0 pts' : `${sign(v)}${a.toFixed(a < 10 ? 1 : 0)} pts`; }
  return fmtPctRaw(v);
}
export function fmtPeople(m) {
  if (Math.abs(m) < 0.05) return '0';
  if (Math.abs(m) >= 1000) return `${(m / 1000).toFixed(2)} bn`;
  return `${m.toFixed(m < 10 ? 1 : 0)} m`;
}
export function fmtUsd(tn) {
  const a = Math.abs(tn);
  if (a < 0.005) return '$0';
  if (a < 1) return `${sign(tn)}$${(a * 1000).toFixed(0)} bn`;
  return `${sign(tn)}$${a.toFixed(a < 10 ? 2 : 1)} tn`;
}
export function fmtKpi(def, v) {
  if (def.fmt === 'people') return fmtPeople(v);
  if (def.fmt === 'usd') return fmtUsd(v);
  return fmtPctRaw(v);
}
export function fmtWeek(t) {
  const w = Math.round(t);
  return `T+${w} wk`;
}
export function fmtSpan(t) {
  const w = Math.round(t);
  if (w < 9) return `${w} week${w === 1 ? '' : 's'}`;
  if (w < 104) return `${(w / 4.345).toFixed(w < 26 ? 1 : 0)} months`;
  return `${(w / 52).toFixed(1)} years`;
}

// Severity: negative = harm, positive = benefit, in node units.
export const severity = (node, v) => node.pol * v;

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (stops) => {
  const s = stops.map(([p, c]) => [p, hex(c)]);
  return (t) => {
    t = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < s.length - 2 && t > s[i + 1][0]) i++;
    const [p0, c0] = s[i], [p1, c1] = s[i + 1];
    const u = (t - p0) / (p1 - p0 || 1);
    return [lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u)];
  };
};
export const NEUTRAL = '#1d2838';
const harmRamp = ramp([[0, NEUTRAL], [0.2, '#5d4426'], [0.45, '#d58a2a'], [0.72, '#e4523a'], [1, '#c81f6c']]);
const goodRamp = ramp([[0, NEUTRAL], [0.4, '#1b5f5d'], [1, '#3fd0bb']]);
// sev in node units; max is the color-scale extent.
export function sevRGB(sev, max) {
  const t = Math.pow(Math.min(1, Math.abs(sev) / (max || 1)), 0.62);
  return sev < 0 ? harmRamp(t) : goodRamp(t);
}
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const sevColor = (sev, max, a = 1) => rgb(sevRGB(sev, max), a);
export const HARM = '#e8603c', GOOD = '#3fd0bb';

export function chip(basis, text) {
  const ev = EVIDENCE[basis] || OUTCOME[basis];
  return el('span', { class: `chip chip-${basis}` }, text || ev.short || ev.label);
}
export function confLabel(c) {
  if (c == null) return 'upper bound only';
  if (c >= 0.75) return 'mostly established links';
  if (c >= 0.5) return 'mixed: established and assumed';
  if (c >= 0.38) return 'assumption-heavy';
  return 'mostly speculative';
}

export function setupCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}

export const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ICONS = {
  ship: 'M3 15l2 4h14l2-4H3zm3-1V9h5V5h2v4h5v5M9 9V7',
  bee: 'M12 7a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3zm-3 5h6m-6 3h6M9 9C6 5 3 7 4 9.5S8 11 9 10m6-1c3-4 6-2 5 .5s-4 1.5-5 .5M12 7V4',
  net: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18M4 4l16 16',
  flame: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9zM4 4l16 16',
  wave: 'M2 10c3-3 5-3 8 0s5 3 8 0 3-2 4-1M2 15c3-3 5-3 8 0s5 3 8 0 3-2 4-1M12 3v4m-2-2l2 2 2-2',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M5.6 18.4l1.4-1.4m10-10l1.4-1.4',
  leaf: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15m-1-1c3-4 6-7 10-9M3 21l3-3',
  drop: 'M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12zM4 4l16 16',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5v14M16 5v14',
  rew: 'M11 6l-8 6 8 6zM20 6l-8 6 8 6z',
  reset: 'M5 5v14M19 6l-10 6 10 6z',
  back: 'M15 6l-6 6 6 6',
  fwd: 'M9 6l6 6-6 6',
};
export function icon(name, size = 18) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ico');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.net);
  p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.6');
  p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.append(p);
  return s;
}
