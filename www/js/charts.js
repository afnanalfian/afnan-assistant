// ===== Grafik SVG ringan (tanpa library, berjalan offline) =====
import { esc, rpShort } from './utils.js';

// Palet kategorikal (urutan tetap — jangan diputar)
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const OTHER = '#9aa0a6';

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

export function legend(items) {
  return `<div class="legend">${items.map((i) => `<span class="lg"><i style="background:${i.color}"></i>${esc(i.name)}</span>`).join('')}</div>`;
}

// Donat dengan celah 2px antar-segmen
export function donut(items, opt = {}) {
  const size = opt.size || 168, th = opt.thickness || 20, r = (size - th) / 2, cx = size / 2, cy = size / 2;
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  let segs = '';
  if (total <= 0) {
    segs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${th}"/>`;
  } else {
    let a0 = -Math.PI / 2;
    const gap = items.filter((i) => i.value > 0).length > 1 ? 0.025 : 0;
    for (const it of items) {
      if (it.value <= 0) continue;
      const ang = (it.value / total) * Math.PI * 2;
      const s = a0 + gap / 2, e = a0 + ang - gap / 2;
      a0 += ang;
      if (ang >= Math.PI * 2 - 0.0001) {
        segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${th}" data-tip="${esc(it.tip || it.label)}"/>`;
        continue;
      }
      const large = e - s > Math.PI ? 1 : 0;
      const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      segs += `<path d="M${p(s)} A${r},${r} 0 ${large} 1 ${p(e)}" fill="none" stroke="${it.color}" stroke-width="${th}" data-tip="${esc(it.tip || it.label)}"/>`;
    }
  }
  const center = `<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="d-top">${esc(opt.top || '')}</text><text x="${cx}" y="${cy + 15}" text-anchor="middle" class="d-sub">${esc(opt.sub || '')}</text>`;
  return `<svg class="chart donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">${segs}${center}</svg>`;
}

// Batang (grouped / stacked)
export function bars({ labels, series, height = 180, fmt = rpShort, stacked = false, maxV = null, showLegend = true }) {
  const W = 340, H = height, padL = 38, padB = 22, padT = 8, padR = 6;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = labels.length;
  const vmax = maxV ?? niceMax(stacked
    ? Math.max(0, ...labels.map((_, i) => series.reduce((s, se) => s + (se.values[i] || 0), 0)))
    : Math.max(0, ...series.flatMap((s) => s.values)));
  const y = (v) => padT + ih - (v / vmax) * ih;
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = (vmax / 4) * k, yy = y(v);
    g += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL - 6}" y="${yy + 3}" text-anchor="end" class="axis">${esc(fmt(v))}</text>`;
  }
  const bw = iw / n;
  const groupW = Math.min(bw * 0.72, stacked ? 22 : 14 * series.length + 2 * (series.length - 1));
  const each = stacked ? groupW : (groupW - 2 * (series.length - 1)) / series.length;
  let marks = '', hits = '', xl = '';
  const step = Math.ceil(n / 12);
  labels.forEach((lab, i) => {
    const gx = padL + bw * i + (bw - groupW) / 2;
    let acc = 0;
    series.forEach((se, j) => {
      const v = se.values[i] || 0;
      if (v <= 0) return;
      const x = stacked ? gx : gx + j * (each + 2);
      const top = stacked ? y(acc + v) : y(v);
      const bot = stacked ? y(acc) : y(0);
      const h = Math.max(1, bot - top - (stacked && acc > 0 ? 2 : 0));
      const rr = Math.min(4, each / 2, h);
      marks += `<path d="M${x},${top + h} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + each - rr} Q${x + each},${top} ${x + each},${top + rr} V${top + h} Z" fill="${se.color}"/>`;
      acc += v;
    });
    const tip = `${lab}: ` + series.map((se) => `${se.name} ${fmt(se.values[i] || 0)}`).join(' · ');
    hits += `<rect x="${padL + bw * i}" y="${padT}" width="${bw}" height="${ih}" fill="transparent" data-tip="${esc(tip)}"/>`;
    if (i % step === 0) xl += `<text x="${padL + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle" class="axis">${esc(lab)}</text>`;
  });
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:${H}px">${g}<line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" class="base"/>${marks}${xl}${hits}</svg>`;
  return svg + (showLegend && series.length > 1 ? legend(series) : '');
}

// Garis (2px) dengan penanda di titik terakhir
export function line({ labels, series, height = 170, fmt = (v) => Math.round(v) + '%', maxV = null, minV = 0, showLegend = true }) {
  const W = 340, H = height, padL = 34, padB = 22, padT = 10, padR = 10;
  const iw = W - padL - padR, ih = H - padT - padB, n = labels.length;
  const all = series.flatMap((s) => s.values.filter((v) => v != null));
  const vmax = maxV ?? niceMax(Math.max(1, ...all));
  const x = (i) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (v) => padT + ih - ((v - minV) / (vmax - minV)) * ih;
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = minV + ((vmax - minV) / 4) * k, yy = y(v);
    g += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL - 6}" y="${yy + 3}" text-anchor="end" class="axis">${esc(fmt(v))}</text>`;
  }
  let paths = '', dots = '', hits = '', xl = '';
  for (const se of series) {
    let d = '', started = false, last = null;
    se.values.forEach((v, i) => {
      if (v == null) { started = false; return; }
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; started = true; last = i;
    });
    if (se.area && d) paths += `<path d="${d} L${x(last)},${y(minV)} L${x(se.values.findIndex((v) => v != null))},${y(minV)} Z" fill="${se.color}" opacity=".10"/>`;
    paths += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    if (last != null) dots += `<circle cx="${x(last)}" cy="${y(se.values[last])}" r="4" fill="${se.color}" stroke="var(--card)" stroke-width="2"/>`;
  }
  const step = Math.ceil(n / 8);
  const bw = iw / Math.max(1, n - 1);
  labels.forEach((lab, i) => {
    const tip = `${lab}: ` + series.map((se) => `${se.name} ${se.values[i] == null ? '–' : fmt(se.values[i])}`).join(' · ');
    hits += `<rect x="${x(i) - bw / 2}" y="${padT}" width="${bw}" height="${ih}" fill="transparent" data-tip="${esc(tip)}"/>`;
    if (i % step === 0 || i === n - 1) xl += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="axis">${esc(lab)}</text>`;
  });
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}${paths}${dots}${xl}${hits}</svg>`;
  return svg + (showLegend && series.length > 1 ? legend(series) : '');
}

// Cincin progres
export function ring(p, opt = {}) {
  const size = opt.size || 64, th = opt.th || 7, r = (size - th) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, p));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${th}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${opt.color || 'var(--primary)'}" stroke-width="${th}" stroke-linecap="round"
      stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring-t" style="font-size:${opt.fs || size / 4.2}px">${esc(opt.label ?? Math.round(v) + '%')}</text></svg>`;
}

// Bar horizontal (HTML)
export function hbars(items, opt = {}) {
  const max = opt.max ?? Math.max(1, ...items.map((i) => i.value));
  return `<div class="hbars">${items.map((i) => `
    <div class="hb" data-tip="${esc(i.tip || '')}">
      <div class="hb-top"><span class="hb-l">${i.emoji ? `<span class="em">${i.emoji}</span>` : `<i class="dot" style="background:${i.color}"></i>`}${esc(i.label)}</span><span class="hb-v">${esc(i.right ?? '')}</span></div>
      <div class="hb-track"><div class="hb-fill" style="width:${Math.max(0, Math.min(100, (i.value / (i.max || max)) * 100))}%;background:${i.color}"></div></div>
      ${i.sub ? `<div class="hb-sub">${i.sub}</div>` : ''}
    </div>`).join('')}</div>`;
}

// Warna sekuensial (satu hue, terang -> gelap) untuk heatmap
const SEQ = ['#e8eef5', '#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'];
export const seq = (t) => (t <= 0 ? 'var(--line)' : SEQ[Math.min(SEQ.length - 1, 1 + Math.floor(t * (SEQ.length - 2) + 0.0001))]);
