// ===== Komponen UI: bottom sheet, toast, konfirmasi, PIN pad, foto, tooltip =====
import { esc, parseNum, num, compressImage, uid } from './utils.js';
import { icon } from './icons.js';
import { blobGet, blobSet } from './db.js';
import { S, save } from './state.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Bottom sheet ----------
const stack = [];
export function openSheet({ title, body, onMount, full = false, cls = '' }) {
  const root = $('#sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet ${full ? 'full' : ''} ${cls}" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="sheet-head"><h2>${esc(title || '')}</h2><button class="icon-btn sheet-x" aria-label="Tutup">${icon('x')}</button></div>
      <div class="sheet-body">${body || ''}</div>
    </div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const entry = { wrap, closed: false, onClose: null };
  const close = () => {
    if (entry.closed) return; entry.closed = true;
    const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 220);
    entry.onClose?.();
  };
  entry.close = close;
  stack.push(entry);
  $('.sheet-backdrop', wrap).onclick = close;
  $('.sheet-x', wrap).onclick = close;
  const el = $('.sheet-body', wrap);
  onMount?.(el, close, entry);
  return close;
}
export const closeTopSheet = () => { const t = stack[stack.length - 1]; if (t) { t.close(); return true; } return false; };
export const closeAllSheets = () => { while (stack.length) stack[stack.length - 1].close(); };

// ---------- Toast ----------
export function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = esc(msg);
  $('#toast-root').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ---------- Konfirmasi ----------
export function confirmBox(message, { ok = 'Ya', cancel = 'Batal', danger = false, title = 'Konfirmasi' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet({
      title,
      body: `<p class="muted" style="margin:0 0 18px">${message}</p>
        <div class="row gap"><button class="btn ghost grow" data-a="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'} grow" data-a="1">${esc(ok)}</button></div>`,
      onMount: (el, cl, entry) => {
        entry.onClose = () => { if (!done) resolve(false); };
        $$('[data-a]', el).forEach((b) => (b.onclick = () => { done = true; resolve(b.dataset.a === '1'); cl(); }));
      },
    });
    return close;
  });
}

// Input teks sederhana
export function promptBox(title, placeholder = '', value = '') {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      title,
      body: `<input class="inp" id="pb-in" placeholder="${esc(placeholder)}" value="${esc(value)}">
        <div class="row gap" style="margin-top:14px"><button class="btn ghost grow" data-a="0">Lewati</button><button class="btn primary grow" data-a="1">Simpan</button></div>`,
      onMount: (el, cl, entry) => {
        entry.onClose = () => { if (!done) resolve(null); };
        const inp = $('#pb-in', el); setTimeout(() => inp.focus(), 250);
        $$('[data-a]', el).forEach((b) => (b.onclick = () => { done = true; resolve(b.dataset.a === '1' ? inp.value.trim() : null); cl(); }));
      },
    });
  });
}

// Pilihan aksi (action sheet)
export function choose(title, options) {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      title,
      body: `<div class="choice-list">${options.map((o, i) => `<button class="choice ${o.danger ? 'danger' : ''}" data-i="${i}">${o.icon ? icon(o.icon, 20) : ''}<span>${esc(o.label)}</span></button>`).join('')}</div>`,
      onMount: (el, cl, entry) => {
        entry.onClose = () => { if (!done) resolve(null); };
        $$('[data-i]', el).forEach((b) => (b.onclick = () => { done = true; resolve(options[+b.dataset.i].value); cl(); }));
      },
    });
  });
}

// ---------- PIN pad ----------
export function pinPad({ title = 'Masukkan PIN', subtitle = '', length = 6, onSubmit }) {
  return openSheet({
    title,
    cls: 'pin-sheet',
    body: `<p class="muted center" style="margin:0 0 12px">${esc(subtitle)}</p>
      <div class="pin-dots">${Array.from({ length }, () => '<i></i>').join('')}</div>
      <div class="pin-err center"></div>
      <div class="pin-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => `<button class="pin-k" data-k="${k}" ${k === '' ? 'disabled' : ''}>${k}</button>`).join('')}</div>`,
    onMount: (el, close) => {
      let v = '';
      const dots = $$('.pin-dots i', el), err = $('.pin-err', el);
      const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < v.length));
      const press = async (k) => {
        if (k === '⌫') v = v.slice(0, -1);
        else if (v.length < length) v += k;
        paint();
        if (v.length === length) {
          const res = await onSubmit(v, close);
          if (res === false) { err.textContent = 'PIN salah, coba lagi'; el.querySelector('.pin-dots').classList.add('shake'); setTimeout(() => el.querySelector('.pin-dots')?.classList.remove('shake'), 400); v = ''; paint(); }
          else if (typeof res === 'string') { err.textContent = res; v = ''; paint(); }
        } else err.textContent = '';
      };
      $$('.pin-k', el).forEach((b) => (b.onclick = () => press(b.dataset.k)));
    },
  });
}

// ---------- Input uang (pemisah ribuan otomatis) ----------
export function bindMoney(root) {
  $$('input[data-money]', root).forEach((inp) => {
    const fmt = () => { const v = parseNum(inp.value); inp.value = v ? num(v) : ''; };
    inp.addEventListener('input', () => { const pos = inp.value.length - inp.selectionStart; fmt(); const p = Math.max(0, inp.value.length - pos); inp.setSelectionRange(p, p); });
    fmt();
  });
}
export const moneyVal = (inp) => parseNum(inp?.value);

// Segmented control
export function bindSeg(root, onChange) {
  $$('.seg', root).forEach((seg) => $$('button', seg).forEach((b) => (b.onclick = () => {
    $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
    seg.dataset.value = b.dataset.v; onChange?.(b.dataset.v, seg);
  })));
}
export const seg = (name, opts, val) => `<div class="seg" data-name="${name}" data-value="${esc(val)}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${v === val ? 'on' : ''}">${l}</button>`).join('')}</div>`;

// ---------- Foto ----------
const cache = new Map();
export async function imgURL(key) {
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  const v = await blobGet(key).catch(() => null);
  if (v) cache.set(key, v);
  return v || null;
}
export const forgetImg = (key) => cache.delete(key);
export const photoKey = (id) => (id ? 'ph:' + id : null);

// isi semua <img data-img="key">
export function hydrate(root = document) {
  $$('img[data-img]', root).forEach(async (im) => {
    const u = await imgURL(im.dataset.img);
    if (u) { im.src = u; im.classList.add('ok'); } else im.closest('.ph-hide-empty')?.remove();
  });
}

export async function addPhotoFromFile(file, label = '') {
  const data = await compressImage(file, 480, 0.82);
  const id = uid();
  await blobSet('ph:' + id, data);
  cache.set('ph:' + id, data);
  S.photos.push({ id, label: label || 'Foto ' + (S.photos.length + 1), createdAt: new Date().toISOString() });
  save();
  return id;
}

export function pickFile(accept = 'image/*', capture = false) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    if (capture) inp.capture = 'environment';
    inp.onchange = () => resolve(inp.files?.[0] || null);
    inp.click();
  });
}

// Galeri pemilih foto pengingat
export function photoPicker({ title = 'Pilih Foto', current = null, allowNone = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      title,
      body: `<div class="ph-grid" id="phg"></div>
        <div class="row gap" style="margin-top:14px"><button class="btn ghost grow" id="ph-up">${icon('upload', 18)} Unggah foto baru</button></div>
        <p class="hint">Foto disimpan di perangkat dan diperkecil otomatis. Kelola semua foto di Pengaturan → Foto Pengingat.</p>`,
      onMount: (el, close, entry) => {
        entry.onClose = () => { if (!done) resolve(undefined); };
        const render = () => {
          $('#phg', el).innerHTML = (allowNone ? `<button class="ph-item none ${!current ? 'on' : ''}" data-id="">${icon('x', 22)}<span>Tanpa foto</span></button>` : '') +
            S.photos.map((p) => `<button class="ph-item ${current === p.id ? 'on' : ''}" data-id="${p.id}"><img data-img="ph:${p.id}" alt=""><span>${esc(p.label)}</span></button>`).join('');
          hydrate(el);
          $$('.ph-item', el).forEach((b) => (b.onclick = () => { done = true; resolve(b.dataset.id || null); close(); }));
        };
        render();
        $('#ph-up', el).onclick = async () => {
          const f = await pickFile(); if (!f) return;
          const label = (await promptBox('Label foto', 'mis. "Istri marah"')) || '';
          const id = await addPhotoFromFile(f, label);
          current = id; render();
        };
      },
    });
  });
}

// Kartu foto pengingat (avatar + caption)
export function slotCard(slotName, extraClass = '') {
  const sl = S.settings.photoSlots[slotName];
  if (!sl?.photoId) return '';
  return `<div class="slot-card ${extraClass} ph-hide-empty"><img data-img="ph:${sl.photoId}" alt=""><div class="slot-cap">${esc(sl.caption || '')}</div></div>`;
}

// ---------- Tooltip (tap/hover pada data-tip) ----------
let tipEl = null;
export function initTooltips() {
  tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl);
  const show = (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t || !t.dataset.tip) { tipEl.classList.remove('show'); return; }
    tipEl.textContent = t.dataset.tip;
    const x = e.clientX ?? e.touches?.[0]?.clientX, y = e.clientY ?? e.touches?.[0]?.clientY;
    tipEl.classList.add('show');
    const w = tipEl.offsetWidth;
    tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
    tipEl.style.top = Math.max(8, y - tipEl.offsetHeight - 14) + 'px';
  };
  document.addEventListener('pointerdown', show);
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') show(e); });
  document.addEventListener('scroll', () => tipEl.classList.remove('show'), true);
}

// ---------- Konfeti ----------
export function confetti() {
  const c = document.createElement('canvas');
  c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const cols = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 12, vy: Math.random() * -12 - 3, s: 4 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6 }));
  let f = 0;
  const tick = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); }
    if (++f < 120) requestAnimationFrame(tick); else c.remove();
  };
  tick();
}

export const empty = (ico, title, sub = '') => `<div class="empty">${icon(ico, 36)}<div class="empty-t">${esc(title)}</div>${sub ? `<div class="empty-s">${sub}</div>` : ''}</div>`;
