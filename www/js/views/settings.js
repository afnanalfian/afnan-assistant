// ===== Pengaturan: profil, tema, foto pengingat, notifikasi, backup =====
import { S, save, flush, replaceState, cat, acc, goal, defaultState } from '../state.js';
import { icon } from '../icons.js';
import { esc, uid, today, nowHM, HARI, pad } from '../utils.js';
import { openSheet, $, $$, toast, confirmBox, choose, hydrate, photoPicker, addPhotoFromFile, pickFile, promptBox, forgetImg, bindSeg, seg } from '../ui.js';
import { blobAll, blobSet, blobDel, blobClear } from '../db.js';
import { isNative, saveTextFile, shareTextFile, exactAlarmStatus, openExactAlarmSetting, ensureNotifPermission } from '../native.js';
import { testNotification, rescheduleNow } from '../notify.js';
import { resetVaultForgot } from './vault.js';
import { PALETTE } from '../charts.js';

export const APP_VERSION = '1.0.0';
const SLOTS = [
  ['expense', 'Form Pengeluaran', 'Muncul saat mencatat pengeluaran (mis. foto istri marah 😅)'],
  ['budget', 'Peringatan Anggaran', 'Muncul saat anggaran ≥80% atau terlampaui'],
  ['income', 'Form Pemasukan', 'Muncul saat mencatat pemasukan'],
  ['goal', 'Goal Tercapai', 'Muncul saat target tabungan terpenuhi'],
  ['home', 'Beranda', 'Penyemangat di halaman utama'],
];

export function render() {
  const R = S.settings.reminders;
  const timeRow = (k, t1, t2, extra = '') => `<div class="set-row"><div class="main"><div class="t1">${t1}</div><div class="t2">${t2}</div></div>${extra}<input type="time" data-rt="${k}" value="${R[k].time}"><label class="switch"><input type="checkbox" data-ron="${k}" ${R[k].on ? 'checked' : ''}><span></span></label></div>`;
  const html = `
    <div class="sec-t">Profil & Tampilan</div>
    <div class="card"><div class="field"><label>Nama panggilan</label><input class="inp" id="s-name" value="${esc(S.settings.name)}"></div>
      <div class="field" style="margin:0"><label>Tema</label>${seg('theme', [['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']], S.settings.theme)}</div></div>

    <div class="sec-t">Foto Pengingat</div>
    <div class="card"><div class="card-h"><h3>Galeri foto</h3><button class="link" id="s-ph-add">+ Unggah</button></div>
      <div class="ph-grid" id="s-ph">${S.photos.length ? S.photos.map((p) => `<button class="ph-item" data-ph="${p.id}"><img data-img="ph:${p.id}"><span>${esc(p.label)}</span></button>`).join('') : '<div class="muted small" style="grid-column:1/-1">Belum ada foto. Unggah foto kecil (mis. foto istri lagi marah 😄) untuk dipasang sebagai pengingat.</div>'}</div></div>
    <div class="card"><div class="card-h"><h3>Pasang foto di…</h3></div>
      ${SLOTS.map(([k, t, d]) => { const sl = S.settings.photoSlots[k]; return `<div class="set-row" data-slot="${k}" style="cursor:pointer"><div class="ph-pick" style="width:auto;border:0;padding:0">${sl.photoId ? `<img data-img="ph:${sl.photoId}">` : `<span class="ph0">${icon('image', 20)}</span>`}</div>
        <div class="main"><div class="t1">${t}</div><div class="t2">${sl.photoId ? '“' + esc(sl.caption) + '”' : d}</div></div>${icon('right', 18, 'faint')}</div>`; }).join('')}
      <p class="hint">Foto khusus per kategori pengeluaran bisa diatur di Keuangan → Kategori.</p></div>

    <div class="sec-t">Pengingat & Notifikasi</div>
    <div class="card">
      ${timeRow('habitDaily', 'Habit harian', 'Setiap malam')}
      ${timeRow('habitWeekly', 'Habit mingguan', 'Akhir pekan', `<select data-rwd>${HARI.map((h, i) => `<option value="${i}" ${+R.habitWeekly.weekday === i ? 'selected' : ''}>${h}</option>`).join('')}</select>`)}
      ${timeRow('habitMonthly', 'Habit bulanan', 'Hari terakhir tiap bulan')}
      ${timeRow('morning', 'Ringkasan agenda pagi', 'Daftar kegiatan hari itu')}
      ${timeRow('finance', 'Catat keuangan', 'Pengingat mencatat transaksi harian')}
      <div class="row gap" style="margin-top:12px"><button class="btn ghost grow sm" id="s-test">${icon('bell', 16)} Tes notifikasi</button><button class="btn ghost grow sm" id="s-exact">${icon('clock', 16)} Izin alarm tepat</button></div>
      <p class="hint" id="s-exact-st">${isNative ? '' : 'Notifikasi aktif saat dijalankan sebagai aplikasi Android.'}</p></div>

    <div class="sec-t">Planner</div>
    <div class="card"><div class="card-h"><h3>Kategori kegiatan</h3><button class="link" id="s-ec-add">+ Tambah</button></div>
      <div class="chips">${S.eventCats.map((c) => `<button class="chip" data-ec="${c.id}"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div></div>

    <div class="sec-t">Data & Cadangan</div>
    <div class="card">
      <div class="set-row"><div class="main"><div class="t1">Backup otomatis mingguan</div><div class="t2">Disimpan ke folder Documents/AfnanAssistant${S.settings.lastAutoBackup ? ' · terakhir ' + esc(S.settings.lastAutoBackup.slice(0, 10)) : ''}</div></div><label class="switch"><input type="checkbox" id="s-auto" ${S.settings.autoBackup ? 'checked' : ''}><span></span></label></div>
      <div class="grid2" style="margin-top:12px"><button class="btn ghost sm" id="s-bk-save">${icon('download', 16)} Simpan backup</button><button class="btn ghost sm" id="s-bk-share">${icon('share', 16)} Bagikan backup</button>
        <button class="btn ghost sm" id="s-restore">${icon('upload', 16)} Pulihkan</button><button class="btn ghost sm" id="s-csv">${icon('file', 16)} Ekspor CSV</button></div>
      <p class="hint">Simpan backup secara berkala ke Google Drive/WhatsApp lewat tombol Bagikan — data hanya ada di HP ini.</p></div>
    <div class="card">
      <div class="choice-list"><button class="choice" id="s-vault-forgot">${icon('lock', 20)} Lupa PIN Brankas</button>
      <button class="choice danger" id="s-reset">${icon('trash', 20)} Hapus semua data aplikasi</button></div></div>
    <p class="hint center">Afnan Assistant v${APP_VERSION} · 100% offline · data tersimpan lokal di perangkat</p>`;

  return {
    title: 'Pengaturan', html, back: true,
    async mount(el) {
      hydrate(el);
      bindSeg(el, (v) => { S.settings.theme = v; applyTheme(); save(); });
      $('#s-name', el).onchange = (e) => { S.settings.name = e.target.value.trim() || 'Afnan'; save(); toast('Nama disimpan'); };
      $('#s-ph-add', el).onclick = async () => { const f = await pickFile(); if (!f) return; const lab = await promptBox('Label foto', 'mis. "Istri marah"'); await addPhotoFromFile(f, lab || ''); toast('Foto ditambahkan', 'good'); };
      $$('[data-ph]', el).forEach((b) => (b.onclick = async () => {
        const p = S.photos.find((x) => x.id === b.dataset.ph);
        const a = await choose(p.label, [{ label: 'Ganti label', value: 'ren', icon: 'edit' }, { label: 'Hapus foto', value: 'del', icon: 'trash', danger: true }]);
        if (a === 'ren') { const l = await promptBox('Label foto', '', p.label); if (l) { p.label = l; save(); } }
        if (a === 'del' && (await confirmBox('Hapus foto ini? Foto juga dilepas dari semua tempat yang memakainya.', { ok: 'Hapus', danger: true }))) {
          S.photos = S.photos.filter((x) => x !== p);
          for (const sl of Object.values(S.settings.photoSlots)) if (sl.photoId === p.id) sl.photoId = null;
          for (const c of S.categories) if (c.photoId === p.id) c.photoId = null;
          for (const g of S.goals) if (g.photoId === p.id) g.photoId = null;
          blobDel('ph:' + p.id); forgetImg('ph:' + p.id); save();
        }
      }));
      $$('[data-slot]', el).forEach((r) => (r.onclick = () => editSlot(r.dataset.slot)));
      $$('[data-ron]', el).forEach((i) => (i.onchange = () => { S.settings.reminders[i.dataset.ron].on = i.checked; save(); }));
      $$('[data-rt]', el).forEach((i) => (i.onchange = () => { S.settings.reminders[i.dataset.rt].time = i.value || '21:00'; save(); toast('Waktu pengingat disimpan'); }));
      $('[data-rwd]', el).onchange = (e) => { S.settings.reminders.habitWeekly.weekday = +e.target.value; save(); };
      $('#s-test', el).onclick = async () => { const ok = await testNotification(); toast(ok ? 'Notifikasi tes akan muncul dalam 5 detik' : 'Notifikasi hanya tersedia di aplikasi Android', ok ? 'good' : ''); };
      $('#s-exact', el).onclick = async () => { await ensureNotifPermission(); await openExactAlarmSetting(); };
      if (isNative) exactAlarmStatus().then((s) => { const e = $('#s-exact-st', el); if (e) e.textContent = s === 'granted' ? '✔ Alarm tepat waktu diizinkan — pengingat akan muncul tepat jamnya.' : s === 'n/a' ? '' : '⚠️ Alarm tepat belum diizinkan; pengingat bisa sedikit terlambat. Ketuk “Izin alarm tepat”.'; });
      $('#s-ec-add', el).onclick = () => editEventCat();
      $$('[data-ec]', el).forEach((b) => (b.onclick = () => editEventCat(S.eventCats.find((c) => c.id === b.dataset.ec))));
      $('#s-auto', el).onchange = (e) => { S.settings.autoBackup = e.target.checked; save(); };
      $('#s-bk-save', el).onclick = () => doBackup('save');
      $('#s-bk-share', el).onclick = () => doBackup('share');
      $('#s-restore', el).onclick = restore;
      $('#s-csv', el).onclick = exportCSV;
      $('#s-vault-forgot', el).onclick = resetVaultForgot;
      $('#s-reset', el).onclick = async () => {
        if (!(await confirmBox('SEMUA data (planner, habit, keuangan, brankas, foto) akan dihapus permanen. Sudah backup?', { ok: 'Hapus semua', danger: true }))) return;
        if (!(await confirmBox('Yakin? Tindakan ini tidak bisa dibatalkan.', { ok: 'Ya, hapus', danger: true }))) return;
        await blobClear(); await replaceState(defaultState()); location.hash = '#/home'; location.reload();
      };
    },
  };
}

export function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0c1117' : '#f3f5f8';
}

function editSlot(k) {
  const sl = S.settings.photoSlots[k];
  const title = SLOTS.find((s) => s[0] === k)[1];
  const x = { ...sl };
  openSheet({
    title,
    body: `<div class="field"><label>Foto</label><button type="button" class="ph-pick" id="sl-ph"></button></div>
      <div class="field"><label>Pesan / caption</label><input class="inp" id="sl-cap" value="${esc(x.caption)}"></div>
      <div class="field"><label>Pratinjau</label><div id="sl-prev"></div></div>
      <button class="btn primary block" id="sl-save">Simpan</button>`,
    onMount: (el, close) => {
      const paint = () => {
        $('#sl-ph', el).innerHTML = x.photoId ? `<img data-img="ph:${x.photoId}"><span>Ganti foto</span>` : `<span class="ph0">${icon('image', 20)}</span><span class="muted">Pilih dari galeri</span>`;
        $('#sl-prev', el).innerHTML = x.photoId ? `<div class="slot-card ${k === 'expense' || k === 'budget' ? 'bad' : 'good'}"><img data-img="ph:${x.photoId}"><div class="slot-cap">${esc($('#sl-cap', el).value)}</div></div>` : '<div class="muted small">Belum ada foto dipilih.</div>';
        hydrate(el);
      };
      paint();
      $('#sl-cap', el).oninput = paint;
      $('#sl-ph', el).onclick = async () => { const id = await photoPicker({ current: x.photoId }); if (id !== undefined) { x.photoId = id; paint(); } };
      $('#sl-save', el).onclick = () => { sl.photoId = x.photoId; sl.caption = $('#sl-cap', el).value.trim(); save(); close(); toast('Disimpan', 'good'); };
    },
  });
}

function editEventCat(c = null) {
  const x = c ? { ...c } : { name: '', color: PALETTE[S.eventCats.length % 8] };
  openSheet({
    title: c ? 'Ubah Kategori Kegiatan' : 'Kategori Kegiatan Baru',
    body: `<div class="field"><label>Nama</label><input class="inp" id="ec-n" value="${esc(x.name)}"></div>
      <div class="field"><label>Warna</label><div class="color-row" id="ec-c">${PALETTE.concat('#8a8f98').map((cc) => `<button type="button" style="background:${cc}" data-c="${cc}" class="${cc === x.color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="row gap">${c ? `<button class="btn ghost" id="ec-del">${icon('trash', 18)}</button>` : ''}<button class="btn primary grow" id="ec-s">Simpan</button></div>`,
    onMount: (el, close) => {
      $$('#ec-c button', el).forEach((b) => (b.onclick = () => $$('#ec-c button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $('#ec-del', el)?.addEventListener('click', async () => {
        if (S.eventCats.length <= 1) return;
        if (!(await confirmBox('Hapus kategori? Kegiatan di kategori ini dipindah ke “Lainnya”/kategori terakhir.', { ok: 'Hapus', danger: true }))) return;
        S.eventCats = S.eventCats.filter((y) => y !== c);
        const fb = S.eventCats[S.eventCats.length - 1].id;
        for (const ev of S.events) if (ev.catId === c.id) ev.catId = fb;
        save(); close();
      });
      $('#ec-s', el).onclick = () => {
        const name = $('#ec-n', el).value.trim(); if (!name) return;
        const color = $('#ec-c button.on', el)?.dataset.c || PALETTE[0];
        if (c) Object.assign(c, { name, color }); else S.eventCats.push({ id: uid(), name, color });
        save(); close();
      };
    },
  });
}

// ---------- Backup ----------
async function buildBackup(withImages = true) {
  await flush();
  return JSON.stringify({ app: 'afnan-assistant', version: APP_VERSION, exportedAt: new Date().toISOString(), state: S, blobs: withImages ? await blobAll() : {} });
}
const stamp = () => { const d = new Date(); return `${today().replace(/-/g, '')}-${pad(d.getHours())}${pad(d.getMinutes())}`; };

async function doBackup(mode) {
  try {
    const withImg = await choose('Sertakan foto?', [{ label: 'Ya, sertakan semua foto (file lebih besar)', value: 'y', icon: 'image' }, { label: 'Tidak, data saja (lebih kecil)', value: 'n', icon: 'file' }]);
    if (!withImg) return;
    const txt = await buildBackup(withImg === 'y');
    const name = `afnan-backup-${stamp()}.json`;
    if (mode === 'share') await shareTextFile(name, txt);
    else { await saveTextFile(name, txt); toast(isNative ? 'Tersimpan di Documents/AfnanAssistant' : 'Backup diunduh', 'good'); }
  } catch (e) { console.error(e); toast('Gagal membuat backup: ' + (e.message || e), 'bad'); }
}

export async function autoBackup() {
  if (!isNative || !S.settings.autoBackup) return;
  const last = S.settings.lastAutoBackup ? new Date(S.settings.lastAutoBackup) : null;
  if (last && Date.now() - last.getTime() < 7 * 86400000) return;
  try {
    const txt = await buildBackup(true);
    try { await saveTextFile('afnan-autobackup.json', txt); } catch (_) { await saveTextFile(`afnan-autobackup-${stamp()}.json`, txt); }
    S.settings.lastAutoBackup = new Date().toISOString(); save({ silent: true });
  } catch (e) { console.warn('autobackup gagal', e); }
}

async function restore() {
  const f = await pickFile('application/json,.json,text/plain,*/*');
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'afnan-assistant' || !data.state) throw new Error('Bukan file backup Afnan Assistant');
    if (!(await confirmBox(`Pulihkan backup tanggal ${esc(data.exportedAt?.slice(0, 16).replace('T', ' ') || '?')}? Data saat ini akan DIGANTI.`, { ok: 'Pulihkan', danger: true }))) return;
    const hasBlobs = data.blobs && Object.keys(data.blobs).length;
    if (hasBlobs) await blobClear();
    for (const [k, v] of Object.entries(data.blobs || {})) await blobSet(k, v);
    await replaceState(data.state);
    toast('Data dipulihkan', 'good');
    setTimeout(() => location.reload(), 600);
  } catch (e) { toast('Gagal memulihkan: ' + e.message, 'bad'); }
}

export async function exportCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const typeL = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer', adjust: 'Penyesuaian' };
  const rows = [['Tanggal', 'Jam', 'Jenis', 'Kategori', 'Goal', 'Kas', 'Kas Tujuan', 'Nominal', 'Keterangan'].join(',')];
  for (const t of [...S.transactions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
    rows.push([t.date, t.time, typeL[t.type], cat(t.categoryId)?.name, goal(t.goalId)?.name, acc(t.accountId)?.name, acc(t.toAccountId)?.name, t.amount, t.note].map(q).join(','));
  const txt = '﻿' + rows.join('\n');
  try { await shareTextFile(`afnan-transaksi-${stamp()}.csv`, txt, 'text/csv'); } catch (e) { toast('Gagal ekspor: ' + e.message, 'bad'); }
}
