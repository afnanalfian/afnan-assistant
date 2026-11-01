// ===== Afnan Assistant — titik masuk & router =====
import { load, S, save, onChange, flush } from './state.js';
import { requestPersist } from './db.js';
import { icon } from './icons.js';
import { $, $$, closeTopSheet, initTooltips, openSheet, toast } from './ui.js';
import { AppP, isNative } from './native.js';
import { initNotifications, reschedule } from './notify.js';
import { checkGoals } from './views/finance.js';
import { lockVault, isUnlocked } from './views/vault.js';
import * as home from './views/home.js';
import * as planner from './views/planner.js';
import * as habits from './views/habits.js';
import * as finance from './views/finance.js';
import * as evalv from './views/eval.js';
import * as settings from './views/settings.js';
import * as vault from './views/vault.js';

const ROUTES = { home, planner, habits, finance, eval: evalv, settings, vault };
const TAB_OF = { home: 'home', planner: 'planner', habits: 'habits', finance: 'finance', vault: 'finance', eval: 'eval', settings: 'home' };
let lastPath = null;

function parse() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [path, qs] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: ROUTES[path] ? path : 'home', params };
}

function renderRoute({ keepScroll = false } = {}) {
  const { path, params } = parse();
  if (lastPath === 'vault' && path !== 'vault') lockVault(); // kunci otomatis saat keluar
  const changed = path !== lastPath;
  const y = window.scrollY;
  let v;
  try { v = ROUTES[path].render(params); } catch (e) { console.error(e); v = { title: 'Terjadi kesalahan', html: `<div class="card"><b>Error:</b> ${String(e.message)}</div>` }; }
  $('#page-title').textContent = v.title || 'Afnan Assistant';
  $('#page-sub').textContent = v.sub || '';
  const back = $('#btn-back');
  back.hidden = !(v.back || path === 'vault');
  back.innerHTML = icon('back');
  back.onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/home'));
  const acts = $('#topbar-actions');
  acts.innerHTML = '';
  for (const a of v.actions || []) {
    const b = document.createElement('button'); b.className = 'icon-btn'; b.setAttribute('aria-label', a.label || ''); b.innerHTML = icon(a.icon); b.onclick = a.onClick; acts.appendChild(b);
  }
  // tekan lama judul (pintu rahasia brankas)
  const title = $('#page-title');
  title.onpointerdown = null;
  if (v.titleLongPress) {
    let t;
    title.onpointerdown = () => { t = setTimeout(() => { navigator.vibrate?.(30); v.titleLongPress(); }, 900); };
    title.onpointerup = title.onpointerleave = title.onpointercancel = () => clearTimeout(t);
  }
  const fab = $('#fab');
  fab.hidden = !v.fab; fab.innerHTML = icon('plus', 28); fab.onclick = v.fab || null;
  $$('#bottomnav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === TAB_OF[path]));
  const view = $('#view');
  view.innerHTML = v.html || '';
  try { v.mount?.(view); } catch (e) { console.error(e); }
  if (changed) { try { v.enter?.(); } catch (e) { console.error(e); } }
  window.scrollTo(0, keepScroll && !changed ? y : 0);
  lastPath = path;
}

async function main() {
  await load();
  await requestPersist();
  settings.applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', settings.applyTheme);
  document.body.classList.toggle('blur-amt', !!S.settings.hideAmounts);
  $$('#bottomnav .ni').forEach((n) => (n.innerHTML = icon(n.dataset.icon, 23)));
  initTooltips();
  checkGoals();

  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('rerender', () => renderRoute({ keepScroll: true }));
  onChange(() => { renderRoute({ keepScroll: true }); reschedule(); });
  renderRoute();
  setTimeout(() => $('#splash').classList.add('hide'), 250);
  setTimeout(() => $('#splash')?.remove(), 700);

  await initNotifications((route) => { location.hash = route; });
  reschedule();

  if (AppP) {
    AppP.addListener('backButton', () => {
      if (closeTopSheet()) return;
      const { path } = parse();
      if (path !== 'home') { if (path === 'settings' || path === 'vault') history.back(); else location.hash = '#/home'; }
      else AppP.minimizeApp();
    });
    AppP.addListener('pause', () => { flush(); if (isUnlocked()) { lockVault(); if (parse().path === 'vault') location.hash = '#/finance'; } });
    AppP.addListener('resume', () => { renderRoute({ keepScroll: true }); reschedule(); });
  } else {
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopSheet(); });
  }
  window.addEventListener('beforeunload', () => flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  if (!S.settings.onboarded) welcome();
  setTimeout(() => settings.autoBackup(), 4000);
}

function welcome() {
  openSheet({
    title: 'Selamat datang 👋',
    body: `<div class="center" style="margin-bottom:10px"><div class="splash-logo" style="margin:0 auto;background:var(--primary);color:#fff;width:64px;height:64px;font-size:32px;border-radius:20px">A</div></div>
      <p style="margin-top:0">Ini <b>Afnan Assistant</b> — asisten pribadi yang berjalan <b>100% offline</b>. Semua data tersimpan di HP ini saja.</p>
      <div class="list">
        <div class="li">${icon('calendar')}<div class="main"><div class="t1">Planner</div><div class="t2">Kalender kegiatan + pengingat</div></div></div>
        <div class="li">${icon('checkCircle')}<div class="main"><div class="t1">Habit</div><div class="t2">Ceklis harian, mingguan, bulanan</div></div></div>
        <div class="li">${icon('wallet')}<div class="main"><div class="t1">Keuangan</div><div class="t2">Kas, anggaran, goals & brankas rahasia</div></div></div>
        <div class="li">${icon('chart')}<div class="main"><div class="t1">Evaluasi</div><div class="t2">Skor & grafik perkembangan</div></div></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Nama panggilan</label><input class="inp" id="w-name" value="${S.settings.name}"></div>
      <p class="hint">Langkah awal: atur saldo awal di Keuangan → Kas, lalu unggah foto pengingat di Pengaturan.</p>
      <button class="btn primary block" id="w-go">Mulai</button>`,
    onMount: (el, close, entry) => {
      const done = () => { S.settings.name = $('#w-name', el).value.trim() || 'Afnan'; S.settings.onboarded = true; save(); };
      entry.onClose = done;
      $('#w-go', el).onclick = () => { close(); location.hash = '#/finance?t=acc'; };
    },
  });
}

main().catch((e) => { console.error(e); document.body.innerHTML = `<pre style="padding:20px;white-space:pre-wrap">Gagal memulai aplikasi:\n${e.stack || e}</pre>`; });
