// ===== Modul Habit Tracker (harian, mingguan, bulanan) =====
import { S, save } from '../state.js';
import { icon } from '../icons.js';
import { esc, uid, today, addDays, parseYmd, weekStart, weekLabel, monthLabel, monthOf, addMonths, daysInMonth, pad, HR, fmtDate } from '../utils.js';
import { openSheet, $, $$, bindSeg, seg, toast, confirmBox, empty, confetti } from '../ui.js';
import { periodKey, prevPeriodDate, nextPeriodDate, periodStartOf, isDone, setDone, activeOn, streak, bestStreak, habitStats, PERIOD_LABEL, unitLabel } from '../logic.js';
import { ring } from '../charts.js';
import { PALETTE } from '../charts.js';

const EMOJI = ['📖', '🕌', '🤲', '🏃', '💪', '🚶', '💧', '🥗', '😴', '📝', '💻', '📚', '🧘', '🧹', '💰', '📵', '🦷', '☀️', '👨‍👩‍👧', '🎯', '🌱', '🚴', '🍎', '✍️'];
const anchors = { daily: today(), weekly: today(), monthly: today() };

const periodTitle = (p, d) => p === 'daily'
  ? { t: d === today() ? 'Hari ini' : d === addDays(today(), -1) ? 'Kemarin' : fmtDate(d, { day: true, long: true }), s: fmtDate(d, { long: true }) }
  : p === 'weekly' ? { t: periodKey('weekly', d) === periodKey('weekly') ? 'Minggu ini' : periodKey('weekly', d) === periodKey('weekly', addDays(today(), -7)) ? 'Minggu lalu' : 'Minggu ' + periodKey('weekly', d).slice(6), s: weekLabel(weekStart(d)) }
    : { t: monthOf(d) === monthOf(today()) ? 'Bulan ini' : monthLabel(monthOf(d)), s: monthLabel(monthOf(d)) };

export function render(params) {
  const p = params.p || 'daily';
  const d = anchors[p];
  const key = periodKey(p, d);
  const isCur = key === periodKey(p);
  const list = S.habits.filter((h) => !h.archived && h.period === p);
  const active = list.filter((h) => activeOn(h, d) && (h.createdAt || '').slice(0, 10) <= (p === 'daily' ? d : addDays(periodStartOf(p, d), p === 'weekly' ? 6 : 31)));
  const done = active.filter((h) => isDone(h, key)).length;
  const counts = ['daily', 'weekly', 'monthly'].map((pp) => {
    const l = S.habits.filter((h) => !h.archived && h.period === pp && activeOn(h, today()));
    return `${l.filter((h) => isDone(h, periodKey(pp))).length}/${l.length}`;
  });
  const pt = periodTitle(p, d);
  const archived = S.habits.filter((h) => h.archived && h.period === p);

  const html = `<div class="tabs">
      <a href="#/habits?p=daily" class="${p === 'daily' ? 'on' : ''}">Harian · ${counts[0]}</a>
      <a href="#/habits?p=weekly" class="${p === 'weekly' ? 'on' : ''}">Mingguan · ${counts[1]}</a>
      <a href="#/habits?p=monthly" class="${p === 'monthly' ? 'on' : ''}">Bulanan · ${counts[2]}</a></div>
    <div class="period-nav"><button class="icon-btn" data-nav="-1">${icon('left')}</button>
      <div class="pl">${esc(pt.t)}<small>${esc(pt.s)}</small></div>
      <button class="icon-btn" data-nav="1" ${isCur ? 'disabled style="opacity:.3"' : ''}>${icon('right')}</button></div>
    ${active.length ? `<div class="card"><div class="score">${ring(active.length ? (done / active.length) * 100 : 0, { size: 72, color: 'var(--accent)' })}
      <div><div style="font-weight:750;font-size:17px">${done} dari ${active.length} habit</div>
      <div class="muted small">${done === active.length ? 'Luar biasa, semua tuntas! 🎉' : isCur ? `Masih ${active.length - done} lagi ${p === 'daily' ? 'hari ini' : p === 'weekly' ? 'minggu ini' : 'bulan ini'}. Semangat!` : 'Kamu bisa melengkapi ceklis periode lalu.'}</div></div></div></div>` : ''}
    ${list.length ? list.map((h) => habitRow(h, d, key)).join('') : `<div class="card">${empty('checkCircle', `Belum ada habit ${PERIOD_LABEL[p].toLowerCase()}`, 'Ketuk + untuk menambah habit. Contoh: Tilawah 1 juz, Olahraga, Menabung.')}</div>`}
    ${archived.length ? `<div class="sec-t">Diarsipkan</div>${archived.map((h) => `<div class="habit" data-h="${h.id}" style="opacity:.6"><div class="hem" style="background:${h.color}22">${h.emoji}</div><div class="main"><div class="t1">${esc(h.name)}</div><div class="t2">Diarsipkan</div></div></div>`).join('')}` : ''}
    <p class="hint center">${p === 'daily' ? 'Pengingat dikirim tiap malam' : p === 'weekly' ? 'Pengingat dikirim tiap akhir pekan' : 'Pengingat dikirim di hari terakhir tiap bulan'} — atur di Pengaturan.</p>`;

  return {
    title: 'Habit Tracker', sub: PERIOD_LABEL[p], html,
    fab: () => openHabitForm({ period: p }),
    mount(el) {
      $$('[data-nav]', el).forEach((b) => (b.onclick = () => {
        const nd = +b.dataset.nav < 0 ? prevPeriodDate(p, anchors[p]) : nextPeriodDate(p, anchors[p]);
        if (nd > today() && periodKey(p, nd) !== periodKey(p)) return;
        anchors[p] = nd > today() ? today() : nd; window.dispatchEvent(new Event('rerender'));
      }));
      $$('[data-ck]', el).forEach((b) => (b.onclick = (e) => {
        e.stopPropagation();
        const h = S.habits.find((x) => x.id === b.dataset.ck);
        const v = !isDone(h, key);
        setDone(h, key, v);
        if (v && navigator.vibrate) navigator.vibrate(18);
        save();
        const nowDone = active.filter((x) => isDone(x, key)).length;
        if (v && nowDone === active.length && active.length > 1) { confetti(); toast('Semua habit tuntas! 🎉', 'good'); }
      }));
      $$('[data-h]', el).forEach((r) => (r.onclick = () => openHabitDetail(S.habits.find((x) => x.id === r.dataset.h))));
    },
  };
}

function strip(h) {
  let d = today(); const out = [];
  for (let i = 0; i < 7; i++) { out.unshift(activeOn(h, d) ? (isDone(h, periodKey(h.period, d)) ? 'on' : '') : 'na'); d = prevPeriodDate(h.period, d); }
  return `<div class="week-strip">${out.map((c) => `<i class="${c}"></i>`).join('')}</div>`;
}

function habitRow(h, d, key) {
  const on = isDone(h, key), act = activeOn(h, d), st = streak(h);
  return `<div class="habit ${on ? 'done' : ''}" data-h="${h.id}" style="${act ? '' : 'opacity:.5'}">
    <div class="hem" style="background:${h.color}22">${h.emoji}</div>
    <div class="main"><div class="t1">${esc(h.name)}</div>
      <div class="t2">${st ? `<span>🔥 ${st} ${unitLabel(h.period)}</span>` : '<span>Mulai streak hari ini</span>'}${!act ? '<span>· libur</span>' : ''}</div>${strip(h)}</div>
    ${act ? `<button class="ck sq ${on ? 'on' : ''}" data-ck="${h.id}" aria-label="Ceklis">${icon('check', 18)}</button>` : ''}
  </div>`;
}

// ---------- Detail ----------
function heatmap(h) {
  if (h.period === 'daily') {
    // 12 minggu terakhir (Senin–Minggu)
    const start = addDays(weekStart(today()), -7 * 11);
    let cells = '';
    for (let i = 0; i < 84; i++) {
      const d = addDays(start, i);
      const fut = d > today(), on = isDone(h, d), act = activeOn(h, d) && d >= (h.createdAt || '').slice(0, 10);
      cells += `<div class="hc ${on ? 'on' : ''} ${!act || fut ? 'off' : ''}" style="${on ? `background:${h.color}` : ''}" data-tip="${fmtDate(d, { day: true })}: ${on ? 'selesai' : fut ? '-' : 'belum'}">${parseYmd(d).getDate()}</div>`;
    }
    return `<div class="heat">${HR.slice(1).concat(HR[0]).map((x) => `<div class="center faint small">${x}</div>`).join('')}${cells}</div>`;
  }
  const n = 12; let d = today(); const arr = [];
  for (let i = 0; i < n; i++) { arr.unshift(d); d = prevPeriodDate(h.period, d); }
  return `<div class="heat" style="grid-template-columns:repeat(6,1fr)">${arr.map((x) => {
    const on = isDone(h, periodKey(h.period, x));
    const lab = h.period === 'weekly' ? `${parseYmd(weekStart(x)).getDate()}/${parseYmd(weekStart(x)).getMonth() + 1}` : monthLabel(monthOf(x), true).split(' ')[0];
    return `<div class="hc ${on ? 'on' : ''}" style="${on ? `background:${h.color}` : ''};aspect-ratio:1.4" data-tip="${lab}: ${on ? 'selesai' : 'belum'}">${lab}</div>`;
  }).join('')}</div>`;
}

function openHabitDetail(h) {
  if (!h) return;
  const from30 = h.period === 'daily' ? addDays(today(), -29) : h.period === 'weekly' ? addDays(today(), -7 * 11) : addMonths(monthOf(today()), -11) + '-01';
  const s30 = habitStats(h, from30, today());
  const sAll = habitStats(h, (h.createdAt || today()).slice(0, 10), today());
  openSheet({
    title: 'Detail Habit',
    body: `<div class="row gap" style="margin-bottom:14px"><div class="hem" style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;background:${h.color}22">${h.emoji}</div>
      <div><h2 style="font-size:19px">${esc(h.name)}</h2><div class="muted small">${PERIOD_LABEL[h.period]}${h.period === 'daily' && h.days && h.days.length < 7 ? ' · ' + h.days.map((x) => HR[x]).join(', ') : ''} · sejak ${fmtDate(h.createdAt.slice(0, 10))}</div></div></div>
      <div class="grid3" style="margin-bottom:14px">
        <div class="stat"><div class="s-l">🔥 Streak</div><div class="s-v">${streak(h)}</div><div class="s-s">${unitLabel(h.period)}</div></div>
        <div class="stat"><div class="s-l">🏆 Terbaik</div><div class="s-v">${bestStreak(h)}</div><div class="s-s">${unitLabel(h.period)}</div></div>
        <div class="stat"><div class="s-l">📈 Konsisten</div><div class="s-v">${s30.rate ?? '–'}${s30.rate != null ? '%' : ''}</div><div class="s-s">${h.period === 'daily' ? '30 hari' : h.period === 'weekly' ? '12 minggu' : '12 bulan'}</div></div>
      </div>
      <div class="card flat"><div class="card-h"><h3>Riwayat</h3><span class="pill">${sAll.done}× total</span></div>${heatmap(h)}</div>
      ${h.note ? `<p class="muted" style="white-space:pre-wrap">${esc(h.note)}</p>` : ''}
      <div class="sheet-actions"><button class="btn ghost" data-a="del">${icon('trash', 18)}</button>
        <button class="btn ghost grow" data-a="arc">${h.archived ? 'Aktifkan' : 'Arsipkan'}</button>
        <button class="btn primary grow" data-a="edit">${icon('edit', 18)} Ubah</button></div>`,
    onMount: (el, close) => {
      $('[data-a="edit"]', el).onclick = () => { close(); openHabitForm({ h }); };
      $('[data-a="arc"]', el).onclick = () => { h.archived = !h.archived; save(); close(); toast(h.archived ? 'Habit diarsipkan' : 'Habit diaktifkan'); };
      $('[data-a="del"]', el).onclick = async () => {
        if (!(await confirmBox(`Hapus habit “${esc(h.name)}” beserta seluruh riwayatnya?`, { ok: 'Hapus', danger: true }))) return;
        S.habits = S.habits.filter((x) => x !== h); delete S.habitLogs[h.id]; save(); close(); toast('Habit dihapus');
      };
    },
  });
}

// ---------- Form ----------
export function openHabitForm({ h = null, period = 'daily' } = {}) {
  const x = h ? { ...h } : { name: '', emoji: '📖', color: PALETTE[S.habits.length % PALETTE.length], period, days: [0, 1, 2, 3, 4, 5, 6], note: '' };
  openSheet({
    title: h ? 'Ubah Habit' : 'Habit Baru',
    full: true,
    body: `<div class="field"><label>Nama habit</label><input class="inp" id="h-name" value="${esc(x.name)}" placeholder="mis. Tilawah 1 juz"></div>
      <div class="field"><label>Jenis</label>${seg('period', [['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan']], x.period)}</div>
      <div class="field" id="h-days-w" style="${x.period === 'daily' ? '' : 'display:none'}"><label>Aktif di hari</label><div class="chips" id="h-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${(x.days || []).includes(d) ? 'on' : ''}" data-d="${d}">${HR[d]}</button>`).join('')}</div></div>
      <div class="field"><label>Ikon</label><div class="emoji-row" id="h-emo">${EMOJI.map((e) => `<button type="button" class="${e === x.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Warna</label><div class="color-row" id="h-col">${PALETTE.map((c) => `<button type="button" style="background:${c}" data-c="${c}" class="${c === x.color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="field"><label>Catatan / target (opsional)</label><textarea class="inp" id="h-note">${esc(x.note)}</textarea></div>
      <div class="sheet-actions"><button class="btn primary block" id="h-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindSeg(el, (v) => ($('#h-days-w', el).style.display = v === 'daily' ? '' : 'none'));
      $$('#h-days .chip', el).forEach((c) => (c.onclick = () => c.classList.toggle('on')));
      $$('#h-emo button', el).forEach((b) => (b.onclick = () => $$('#h-emo button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $$('#h-col button', el).forEach((b) => (b.onclick = () => $$('#h-col button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $('#h-save', el).onclick = () => {
        const name = $('#h-name', el).value.trim();
        if (!name) { toast('Nama habit wajib diisi', 'bad'); return; }
        const days = $$('#h-days .chip.on', el).map((c) => +c.dataset.d);
        const data = { name, period: $('.seg[data-name="period"]', el).dataset.value, days: days.length ? days : [0, 1, 2, 3, 4, 5, 6], emoji: $('#h-emo button.on', el)?.textContent || '✅', color: $('#h-col button.on', el)?.dataset.c || PALETTE[0], note: $('#h-note', el).value.trim() };
        if (h) Object.assign(h, data); else S.habits.push({ id: uid(), ...data, archived: false, createdAt: today() });
        save(); close(); toast(h ? 'Habit diperbarui' : 'Habit ditambahkan', 'good');
        if (!h) location.hash = '#/habits?p=' + data.period;
      };
    },
  });
}
