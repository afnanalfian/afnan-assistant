// ===== Modul Planner: kalender, kegiatan, pengingat =====
import { S, save } from '../state.js';
import { icon } from '../icons.js';
import { esc, uid, ymd, today, parseYmd, addDays, monthKey, monthOf, addMonths, daysInMonth, monthLabel, HR, HARI, fmtDate, relDay, pad, nowHM } from '../utils.js';
import { openSheet, $, $$, bindSeg, seg, toast, confirmBox, choose, empty } from '../ui.js';
import { agenda, occurrences, occStatus, eventCat } from '../logic.js';

const REMIND = [[-1, 'Tanpa pengingat'], [0, 'Tepat waktu'], [5, '5 menit sebelum'], [15, '15 menit sebelum'], [30, '30 menit sebelum'], [60, '1 jam sebelum'], [120, '2 jam sebelum'], [1440, '1 hari sebelum']];
const REPEAT = [['none', 'Tidak berulang'], ['daily', 'Setiap hari'], ['weekly', 'Setiap minggu'], ['monthly', 'Setiap bulan'], ['yearly', 'Setiap tahun']];
const PRIO = { low: 'Rendah', med: 'Sedang', high: 'Tinggi' };

let sel = today();
let viewMonth = monthKey();

export function render(params) {
  if (params.d) { sel = params.d; viewMonth = monthOf(sel); }
  const tab = params.v || 'cal';
  const missedAll = agenda(addDays(today(), -60), today()).filter((o) => o.status === 'missed');
  const tabs = `<div class="tabs">
    <a href="#/planner?v=cal" class="${tab === 'cal' ? 'on' : ''}">Kalender</a>
    <a href="#/planner?v=up" class="${tab === 'up' ? 'on' : ''}">Mendatang</a>
    <a href="#/planner?v=missed" class="${tab === 'missed' ? 'on' : ''}">Terlewat${missedAll.length ? ` (${missedAll.length})` : ''}</a>
    <a href="#/planner?v=all" class="${tab === 'all' ? 'on' : ''}">Semua</a></div>`;
  let html = tabs;
  if (tab === 'cal') html += calendar() + dayList(sel);
  else if (tab === 'up') html += upcoming();
  else if (tab === 'missed') html += missedView(missedAll);
  else html += allView();
  return {
    title: 'Planner',
    sub: tab === 'cal' ? fmtDate(sel, { day: true, long: true }) : '',
    html,
    fab: () => openEventForm({ date: tab === 'cal' ? sel : today() }),
    mount(el) {
      $$('[data-cal-nav]', el).forEach((b) => (b.onclick = () => { viewMonth = addMonths(viewMonth, +b.dataset.calNav); rerender(); }));
      $('[data-cal-today]', el)?.addEventListener('click', () => { sel = today(); viewMonth = monthKey(); rerender(); });
      $$('[data-day]', el).forEach((b) => (b.onclick = () => { sel = b.dataset.day; if (monthOf(sel) !== viewMonth) viewMonth = monthOf(sel); rerender(); }));
      bindOccList(el);
      $$('[data-ev]', el).forEach((r) => (r.onclick = () => { const x = S.events.find((e) => e.id === r.dataset.ev); if (x) openEventForm({ ev: x }); }));
      $$('[data-resched]', el).forEach((b) => (b.onclick = () => {
        const ev = S.events.find((e) => e.id === b.dataset.resched);
        if (!ev) return;
        if (ev.repeat && ev.repeat !== 'none') { ev.skip ||= {}; ev.skip[b.dataset.date] = true; toast('Kemunculan dilewati'); }
        else { ev.date = today(); toast('Dipindah ke hari ini'); }
        save();
      }));
    },
  };
}
const rerender = () => window.dispatchEvent(new Event('rerender'));

function calendar() {
  const first = parseYmd(viewMonth + '-01');
  const lead = (first.getDay() + 6) % 7; // Senin awal
  const start = addDays(viewMonth + '-01', -lead);
  const end = addDays(start, 41);
  const occ = agenda(start, end);
  const byDay = {};
  for (const o of occ) (byDay[o.date] ||= []).push(o);
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const list = byDay[d] || [];
    const dots = [...new Set(list.map((o) => (o.status === 'missed' ? 'var(--exp)' : o.status === 'done' ? 'var(--faint)' : eventCat(o.ev.catId).color)))].slice(0, 3);
    const cls = [monthOf(d) !== viewMonth ? 'out' : '', d === today() ? 'today' : '', d === sel ? 'sel' : '', parseYmd(d).getDay() === 0 ? 'sun' : ''].join(' ');
    cells += `<button class="cal-d ${cls}" data-day="${d}">${parseYmd(d).getDate()}<span class="cal-dots">${dots.map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`;
    if (i === 34 && addDays(start, 35) > `${viewMonth}-${pad(daysInMonth(viewMonth))}`) break;
  }
  return `<div class="card">
    <div class="cal-h"><button class="icon-btn" data-cal-nav="-1">${icon('left')}</button>
      <div class="center"><h3>${monthLabel(viewMonth)}</h3>${viewMonth !== monthKey() || sel !== today() ? `<button class="link" style="border:0;background:none;color:var(--primary);font-weight:600;font-size:12.5px" data-cal-today>Kembali ke hari ini</button>` : ''}</div>
      <button class="icon-btn" data-cal-nav="1">${icon('right')}</button></div>
    <div class="cal-grid">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h) => `<div class="cal-dow">${h}</div>`).join('')}${cells}</div>
  </div>`;
}

export function occRow(o, opt = {}) {
  const c = eventCat(o.ev.catId);
  const time = o.ev.time ? `${o.ev.time}${o.ev.endTime ? '–' + o.ev.endTime : ''}` : 'Sepanjang hari';
  const extra = [opt.showDate ? relDay(o.date) : '', time, o.ev.location ? '📍 ' + esc(o.ev.location) : ''].filter(Boolean).join(' · ');
  return `<div class="li tap ${o.status}" data-occ="${o.ev.id}" data-date="${o.date}">
    <button class="ck ${o.status === 'done' ? 'on' : ''}" data-toggle aria-label="Tandai selesai">${icon('check', 16)}</button>
    <div class="main"><div class="t1">${o.ev.priority === 'high' ? '<span class="exp">❗</span> ' : ''}${esc(o.ev.title)}</div>
      <div class="t2">${o.status === 'missed' ? '⚠️ Terlewat · ' : ''}${extra}</div></div>
    <div class="end"><span class="pill" style="color:${c.color}"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span>${o.ev.repeat && o.ev.repeat !== 'none' ? `<div class="faint" style="margin-top:4px">${icon('repeat', 14)}</div>` : ''}</div>
  </div>`;
}

export function bindOccList(el) {
  $$('[data-occ]', el).forEach((row) => {
    const ev = () => S.events.find((e) => e.id === row.dataset.occ);
    $('[data-toggle]', row).onclick = (e) => {
      e.stopPropagation();
      const x = ev(); if (!x) return;
      x.done ||= {};
      if (x.done[row.dataset.date]) delete x.done[row.dataset.date];
      else { x.done[row.dataset.date] = new Date().toISOString(); toast('Kegiatan selesai ✔', 'good'); }
      save();
    };
    row.onclick = () => { const x = ev(); if (x) openDetail(x, row.dataset.date); };
  });
}

function dayList(d) {
  const list = agenda(d, d);
  const done = list.filter((o) => o.status === 'done').length;
  return `<div class="card"><div class="card-h"><h3>${relDay(d)}</h3><span class="pill">${list.length ? `${done}/${list.length} selesai` : 'Kosong'}</span></div>
    ${list.length ? `<div class="list">${list.map((o) => occRow(o)).join('')}</div>` : empty('calendar', 'Belum ada kegiatan', 'Ketuk tombol + untuk menambah kegiatan di tanggal ini.')}</div>`;
}

function upcoming() {
  const list = agenda(today(), addDays(today(), 30)).filter((o) => o.status !== 'done');
  if (!list.length) return `<div class="card">${empty('calendar', 'Tidak ada kegiatan dalam 30 hari ke depan')}</div>`;
  let html = '', last = '';
  for (const o of list) {
    if (o.date !== last) { html += `<div class="day-h"><span>${relDay(o.date)}</span><span>${fmtDate(o.date)}</span></div>`; last = o.date; }
    html += occRow(o);
  }
  return `<div class="card"><div class="list">${html}</div></div>`;
}

function missedView(list) {
  if (!list.length) return `<div class="card">${empty('checkCircle', 'Tidak ada kegiatan terlewat 🎉', 'Semua kegiatan 60 hari terakhir sudah tuntas.')}</div>`;
  return `<div class="warn-box">${icon('alert', 18)}<div>${list.length} kegiatan terlewat dalam 60 hari terakhir. Tandai selesai jika sudah dikerjakan, atau pindahkan ke hari ini.</div></div>
    <div class="card"><div class="list">${list.slice().reverse().map((o) => occRow(o, { showDate: true }) + `<div class="row gap" style="justify-content:flex-end;padding:0 0 10px"><button class="btn sm ghost" data-resched="${o.ev.id}" data-date="${o.date}">${o.ev.repeat && o.ev.repeat !== 'none' ? 'Lewati' : 'Pindah ke hari ini'}</button></div>`).join('')}</div></div>`;
}

function allView() {
  if (!S.events.length) return `<div class="card">${empty('list', 'Belum ada kegiatan')}</div>`;
  const evs = [...S.events].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card"><div class="list">${evs.map((ev) => {
    const c = eventCat(ev.catId);
    return `<div class="li tap" data-ev="${ev.id}"><div class="ava" style="background:${c.color}22;color:${c.color}">${icon(ev.repeat && ev.repeat !== 'none' ? 'repeat' : 'calendar', 19)}</div>
      <div class="main"><div class="t1">${esc(ev.title)}</div><div class="t2">${fmtDate(ev.date, { day: true })}${ev.time ? ' · ' + ev.time : ''} · ${REPEAT.find((r) => r[0] === (ev.repeat || 'none'))[1]}</div></div></div>`;
  }).join('')}</div></div>`;
}

// ---------- Detail ----------
function openDetail(ev, date) {
  const c = eventCat(ev.catId);
  const st = occStatus(ev, date);
  const rem = REMIND.find((r) => r[0] === (ev.remind ?? -1))?.[1] || '';
  openSheet({
    title: 'Detail Kegiatan',
    body: `<div class="row gap" style="margin-bottom:10px"><span class="pill" style="color:${c.color}"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span>
        <span class="pill ${st === 'done' ? 'good' : st === 'missed' ? 'bad' : ''}">${st === 'done' ? 'Selesai' : st === 'missed' ? 'Terlewat' : 'Akan datang'}</span>
        ${ev.priority ? `<span class="pill ${ev.priority === 'high' ? 'bad' : ''}">Prioritas ${PRIO[ev.priority]}</span>` : ''}</div>
      <h2 style="font-size:21px;margin-bottom:10px">${esc(ev.title)}</h2>
      <div class="list">
        <div class="li">${icon('calendar')}<div class="main"><div class="t1">${fmtDate(date, { day: true, long: true })}</div><div class="t2">${ev.time ? ev.time + (ev.endTime ? ' – ' + ev.endTime : '') : 'Sepanjang hari'}</div></div></div>
        ${ev.repeat && ev.repeat !== 'none' ? `<div class="li">${icon('repeat')}<div class="main"><div class="t1">${REPEAT.find((r) => r[0] === ev.repeat)[1]}</div><div class="t2">${ev.until ? 'Sampai ' + fmtDate(ev.until) : 'Tanpa batas'}</div></div></div>` : ''}
        <div class="li">${icon('bell')}<div class="main"><div class="t1">${rem}</div></div></div>
        ${ev.location ? `<div class="li">📍<div class="main"><div class="t1">${esc(ev.location)}</div></div></div>` : ''}
        ${ev.note ? `<div class="li">${icon('file')}<div class="main" style="white-space:pre-wrap">${esc(ev.note)}</div></div>` : ''}
      </div>
      <div class="sheet-actions">
        <button class="btn ghost" data-a="del">${icon('trash', 18)}</button>
        <button class="btn ghost grow" data-a="edit">${icon('edit', 18)} Ubah</button>
        <button class="btn ${st === 'done' ? 'ghost' : 'accent'} grow" data-a="done">${st === 'done' ? 'Batalkan selesai' : '✔ Selesai'}</button>
      </div>`,
    onMount: (el, close) => {
      $('[data-a="done"]', el).onclick = () => { ev.done ||= {}; if (ev.done[date]) delete ev.done[date]; else ev.done[date] = new Date().toISOString(); save(); close(); };
      $('[data-a="edit"]', el).onclick = () => { close(); openEventForm({ ev }); };
      $('[data-a="del"]', el).onclick = async () => {
        if (ev.repeat && ev.repeat !== 'none') {
          const v = await choose('Hapus kegiatan berulang', [{ label: 'Hanya tanggal ini', value: 'one', icon: 'calendar' }, { label: 'Semua kemunculan', value: 'all', icon: 'trash', danger: true }]);
          if (!v) return;
          if (v === 'one') { ev.skip ||= {}; ev.skip[date] = true; } else S.events = S.events.filter((e) => e !== ev);
        } else {
          if (!(await confirmBox('Hapus kegiatan ini?', { ok: 'Hapus', danger: true }))) return;
          S.events = S.events.filter((e) => e !== ev);
        }
        save(); close(); toast('Kegiatan dihapus');
      };
    },
  });
}

// ---------- Form ----------
export function openEventForm({ ev = null, date = today() } = {}) {
  const e = ev ? { ...ev } : { title: '', date, time: '', endTime: '', catId: 'kerja', priority: 'med', remind: 15, repeat: 'none', until: '', location: '', note: '' };
  const allDay = !e.time;
  openSheet({
    title: ev ? 'Ubah Kegiatan' : 'Kegiatan Baru',
    full: true,
    body: `<div class="field"><label>Judul kegiatan</label><input class="inp" id="f-title" value="${esc(e.title)}" placeholder="mis. Rapat evaluasi SE2026"></div>
      <div class="field"><label>Tanggal</label><input class="inp" type="date" id="f-date" value="${e.date}"></div>
      <div class="set-row"><div class="main"><div class="t1">Sepanjang hari</div><div class="t2">Tanpa jam tertentu</div></div><label class="switch"><input type="checkbox" id="f-allday" ${allDay ? 'checked' : ''}><span></span></label></div>
      <div class="grid2" id="f-times" style="margin-top:10px;${allDay ? 'display:none' : ''}">
        <div class="field"><label>Mulai</label><input class="inp" type="time" id="f-time" value="${e.time || nowHMr()}"></div>
        <div class="field"><label>Selesai (opsional)</label><input class="inp" type="time" id="f-end" value="${e.endTime || ''}"></div></div>
      <div class="field" style="margin-top:10px"><label>Kategori</label><div class="chips" id="f-cat">${S.eventCats.map((c) => `<button type="button" class="chip ${c.id === e.catId ? 'on' : ''}" data-id="${c.id}"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div></div>
      <div class="field"><label>Prioritas</label>${seg('prio', [['low', 'Rendah'], ['med', 'Sedang'], ['high', 'Tinggi']], e.priority || 'med')}</div>
      <div class="grid2"><div class="field"><label>Pengingat</label><select class="inp" id="f-remind">${REMIND.map(([v, l]) => `<option value="${v}" ${v === (e.remind ?? -1) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Pengulangan</label><select class="inp" id="f-repeat">${REPEAT.map(([v, l]) => `<option value="${v}" ${v === (e.repeat || 'none') ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="field" id="f-until-w" style="${!e.repeat || e.repeat === 'none' ? 'display:none' : ''}"><label>Berulang sampai (kosongkan = selamanya)</label><input class="inp" type="date" id="f-until" value="${e.until || ''}"></div>
      <div class="field"><label>Lokasi (opsional)</label><input class="inp" id="f-loc" value="${esc(e.location)}" placeholder="mis. Kantor BPS Pangkep"></div>
      <div class="field"><label>Catatan (opsional)</label><textarea class="inp" id="f-note" rows="3">${esc(e.note)}</textarea></div>
      <div class="sheet-actions"><button class="btn primary block" id="f-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindSeg(el);
      $('#f-allday', el).onchange = (x) => ($('#f-times', el).style.display = x.target.checked ? 'none' : '');
      $('#f-repeat', el).onchange = (x) => ($('#f-until-w', el).style.display = x.target.value === 'none' ? 'none' : '');
      $$('#f-cat .chip', el).forEach((c) => (c.onclick = () => { $$('#f-cat .chip', el).forEach((x) => x.classList.toggle('on', x === c)); }));
      if (!ev) setTimeout(() => $('#f-title', el).focus(), 300);
      $('#f-save', el).onclick = () => {
        const title = $('#f-title', el).value.trim();
        if (!title) { toast('Judul wajib diisi', 'bad'); return; }
        const isAll = $('#f-allday', el).checked;
        const data = {
          title, date: $('#f-date', el).value || today(),
          time: isAll ? '' : $('#f-time', el).value, endTime: isAll ? '' : $('#f-end', el).value,
          catId: $('#f-cat .chip.on', el)?.dataset.id || 'lainnya',
          priority: $('.seg[data-name="prio"]', el).dataset.value,
          remind: Number($('#f-remind', el).value), repeat: $('#f-repeat', el).value,
          until: $('#f-until', el).value || '', location: $('#f-loc', el).value.trim(), note: $('#f-note', el).value.trim(),
        };
        if (ev) Object.assign(ev, data);
        else S.events.push({ id: uid(), ...data, done: {}, skip: {}, createdAt: new Date().toISOString() });
        save(); close(); toast(ev ? 'Kegiatan diperbarui' : 'Kegiatan ditambahkan', 'good');
        if (!ev) { sel = data.date; viewMonth = monthOf(sel); }
      };
    },
  });
}
const nowHMr = () => { const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export { occurrences };
