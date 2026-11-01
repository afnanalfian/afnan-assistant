// ===== Beranda: ringkasan hari ini =====
import { S, save, totalCash, monthTotals, spentByCat, goalSaved, sysCat } from '../state.js';
import { icon } from '../icons.js';
import { esc, today, addDays, monthKey, fmtDate, greet, rp, rpShort, pct, sum, HARI, parseYmd } from '../utils.js';
import { $, $$, hydrate, slotCard, toast, confetti } from '../ui.js';
import { agenda } from '../logic.js';
import { occRow, bindOccList, openEventForm } from './planner.js';
import { openTxForm, recentTx, motivation } from './finance.js';
import { openHabitForm } from './habits.js';
import { periodKey, isDone, setDone, activeOn, streak } from '../logic.js';
import { ring } from '../charts.js';

export function render() {
  const d = today();
  const todayList = agenda(d, d);
  const missed = agenda(addDays(d, -14), addDays(d, -1)).filter((o) => o.status === 'missed');
  const soon = agenda(addDays(d, 1), addDays(d, 7)).filter((o) => o.status !== 'done');
  const daily = S.habits.filter((h) => !h.archived && h.period === 'daily' && activeOn(h, d));
  const weekly = S.habits.filter((h) => !h.archived && h.period === 'weekly');
  const monthly = S.habits.filter((h) => !h.archived && h.period === 'monthly');
  const doneD = daily.filter((h) => isDone(h, d)).length;
  const mk = monthKey(), T = monthTotals(mk);
  const b = S.budgets[mk] || {}, sp = spentByCat(mk);
  const bTot = sum(Object.values(b)), bUsed = sum(Object.keys(b), (id) => sp[id] || 0);
  const g = S.goals.filter((x) => !x.completedAt).sort((a, z) => pct(goalSaved(z.id), z.target) - pct(goalSaved(a.id), a.target))[0];
  const dow = parseYmd(d).getDay();
  const weekendNudge = (dow === 0 || dow === 6) && weekly.some((h) => !isDone(h, periodKey('weekly')));
  const dt = new Date(); const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const monthNudge = lastDay - dt.getDate() <= 2 && monthly.some((h) => !isDone(h, periodKey('monthly')));

  const html = `
    <div style="margin:2px 2px 12px"><div class="muted small">${HARI[dow]}, ${fmtDate(d, { long: true })}</div><h2 style="font-size:23px">${greet()}, ${esc(S.settings.name || 'Afnan')} 👋</h2></div>
    ${slotCard('home', 'info')}
    <div class="hero">
      <button class="icon-btn eye" data-eye>${icon(S.settings.hideAmounts ? 'eyeOff' : 'eye', 20)}</button>
      <div class="h-sm">Total saldo kas</div><div class="h-big"><span class="amt-h">${rp(totalCash())}</span></div>
      <div class="h-row"><div class="h-chip"><span>Masuk bln ini</span><b class="amt-h">${rpShort(T.income)}</b></div><div class="h-chip"><span>Keluar bln ini</span><b class="amt-h">${rpShort(T.expense)}</b></div></div>
    </div>
    <div class="grid3" style="margin-bottom:12px">
      <button class="btn ghost" style="height:64px;flex-direction:column;gap:2px;font-size:12px" data-q="exp"><span class="exp">${icon('arrowUp', 20)}</span>Pengeluaran</button>
      <button class="btn ghost" style="height:64px;flex-direction:column;gap:2px;font-size:12px" data-q="inc"><span class="inc">${icon('arrowDown', 20)}</span>Pemasukan</button>
      <button class="btn ghost" style="height:64px;flex-direction:column;gap:2px;font-size:12px" data-q="ev"><span style="color:var(--primary)">${icon('calendar', 20)}</span>Kegiatan</button>
    </div>
    ${weekendNudge ? `<a class="warn-box" href="#/habits?p=weekly" style="text-decoration:none">🗓️<div>Akhir pekan! Jangan lupa isi <b>ceklis habit mingguan</b>.</div></a>` : ''}
    ${monthNudge ? `<a class="warn-box" href="#/habits?p=monthly" style="text-decoration:none">📆<div>Bulan hampir berakhir — isi <b>ceklis habit bulanan</b>.</div></a>` : ''}
    ${missed.length ? `<a class="warn-box" href="#/planner?v=missed" style="text-decoration:none;background:var(--bad-soft)">⚠️<div><b>${missed.length} kegiatan terlewat</b> dalam 2 minggu terakhir. Ketuk untuk meninjau.</div></a>` : ''}
    <div class="card"><div class="card-h"><h3>Agenda Hari Ini</h3><a class="link" href="#/planner?d=${d}">Kalender</a></div>
      ${todayList.length ? `<div class="list">${todayList.map((o) => occRow(o)).join('')}</div>` : `<div class="muted small" style="padding:6px 0">Tidak ada kegiatan hari ini. ${soon.length ? '' : 'Santai sejenak 😊'}</div>`}
      ${soon.length ? `<div class="sec-t" style="margin:14px 0 4px">Segera (7 hari)</div><div class="list">${soon.slice(0, 4).map((o) => occRow(o, { showDate: true })).join('')}</div>` : ''}</div>
    <div class="card"><div class="card-h"><h3>Habit Hari Ini</h3><a class="link" href="#/habits">Semua</a></div>
      ${daily.length ? `<div class="row gap" style="margin-bottom:8px">${ring((doneD / daily.length) * 100, { size: 56, th: 6, color: 'var(--accent)' })}<div><b>${doneD}/${daily.length} selesai</b><div class="muted small">${doneD === daily.length ? 'Semua tuntas, mantap! 🎉' : 'Yuk selesaikan sisanya'}</div></div></div>
        <div class="list">${daily.map((h) => `<div class="li"><div class="ava" style="background:${h.color}22">${h.emoji}</div><div class="main"><div class="t1">${esc(h.name)}</div><div class="t2">${streak(h) ? '🔥 ' + streak(h) + ' hari' : 'Belum ada streak'}</div></div><button class="ck sq ${isDone(h, d) ? 'on' : ''}" data-hck="${h.id}">${icon('check', 16)}</button></div>`).join('')}</div>`
        : `<div class="muted small">Belum ada habit harian. <button class="link" style="border:0;background:none;color:var(--primary);font-weight:650" data-q="habit">+ Tambah habit</button></div>`}</div>
    <div class="grid-md-2">
    ${bTot ? `<a class="card" href="#/finance?t=budget" style="display:block;text-decoration:none;color:inherit"><div class="card-h"><h3>Anggaran Bulan Ini</h3><span class="pill ${bUsed > bTot ? 'bad' : pct(bUsed, bTot) >= 80 ? 'warn' : 'good'}">${pct(bUsed, bTot)}%</span></div>
      <div class="prog"><div style="width:${Math.min(100, pct(bUsed, bTot))}%;background:${bUsed > bTot ? 'var(--exp)' : pct(bUsed, bTot) >= 80 ? 'var(--warn)' : 'var(--accent)'}"></div></div>
      <div class="row between small" style="margin-top:6px"><span class="muted">Terpakai ${rp(bUsed)}</span><span class="muted">dari ${rp(bTot)}</span></div></a>` : ''}
    ${g ? `<a class="card" href="#/finance?t=goals" style="display:block;text-decoration:none;color:inherit"><div class="card-h"><h3>Goal: ${esc(g.emoji + ' ' + g.name)}</h3><span class="pill">${pct(goalSaved(g.id), g.target)}%</span></div>
      <div class="prog"><div style="width:${Math.min(100, pct(goalSaved(g.id), g.target))}%"></div></div><div class="small" style="margin-top:6px;font-weight:600">${motivation(pct(goalSaved(g.id), g.target))}</div></a>` : ''}
    </div>
    <div class="card"><div class="card-h"><h3>Transaksi Terakhir</h3><a class="link" href="#/finance?t=tx">Semua</a></div>${recentTx(4)}</div>`;

  return {
    title: 'Afnan Assistant', sub: '',
    actions: [{ icon: 'settings', label: 'Pengaturan', onClick: () => (location.hash = '#/settings') }],
    html,
    fab: () => openTxForm({}),
    mount(el) {
      hydrate(el);
      bindOccList(el);
      $$('[data-tx]', el).forEach((r) => (r.onclick = () => (location.hash = '#/finance?t=tx')));
      $('[data-eye]', el).onclick = () => { S.settings.hideAmounts = !S.settings.hideAmounts; document.body.classList.toggle('blur-amt', S.settings.hideAmounts); save(); };
      $$('[data-q]', el).forEach((b) => (b.onclick = () => {
        const q = b.dataset.q;
        if (q === 'exp') openTxForm({ type: 'expense' });
        else if (q === 'inc') openTxForm({ type: 'income' });
        else if (q === 'ev') openEventForm({ date: today() });
        else openHabitForm({ period: 'daily' });
      }));
      $$('[data-hck]', el).forEach((b) => (b.onclick = () => {
        const h = S.habits.find((x) => x.id === b.dataset.hck);
        const v = !isDone(h, d); setDone(h, d, v); save();
        if (v && daily.every((x) => isDone(x, d)) && daily.length > 1) { confetti(); toast('Semua habit hari ini tuntas! 🎉', 'good'); }
      }));
    },
  };
}
