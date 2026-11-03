// ===== Logika domain: kemunculan kegiatan & periode habit =====
import { S } from './state.js';
import { parseYmd, ymd, addDays, today, weekKey, weekStart, monthOf, addMonths, daysInMonth, pad } from './utils.js';

// ---------- Planner ----------
export const eventCat = (id) => S.eventCats.find((c) => c.id === id) || S.eventCats[S.eventCats.length - 1];

export function occurrences(ev, from, to) {
  const out = [];
  const until = ev.until && ev.until < to ? ev.until : to;
  if (!ev.repeat || ev.repeat === 'none') {
    if (ev.date >= from && ev.date <= to) out.push(ev.date);
    return out;
  }
  if (ev.date > until) return out;
  const start = parseYmd(ev.date);
  if (ev.repeat === 'daily') {
    let d = ev.date < from ? from : ev.date;
    for (let i = 0; d <= until && i < 1500; i++, d = addDays(d, 1)) out.push(d);
  } else if (ev.repeat === 'weekly') {
    let d = ev.date;
    if (d < from) { const k = Math.ceil((parseYmd(from) - start) / (7 * 86400000)); d = addDays(ev.date, k * 7); }
    for (let i = 0; d <= until && i < 400; i++, d = addDays(d, 7)) if (d >= from) out.push(d);
  } else if (ev.repeat === 'monthly' || ev.repeat === 'yearly') {
    const step = ev.repeat === 'monthly' ? 1 : 12;
    const day = start.getDate();
    let mk = monthOf(ev.date);
    const fromMk = monthOf(from);
    if (mk < fromMk) { const [y1, m1] = mk.split('-').map(Number), [y2, m2] = fromMk.split('-').map(Number); const diff = (y2 - y1) * 12 + (m2 - m1); mk = addMonths(mk, Math.floor(diff / step) * step); }
    for (let i = 0; i < 400; i++, mk = addMonths(mk, step)) {
      if (day <= daysInMonth(mk)) {
        const d = `${mk}-${pad(day)}`;
        if (d > until) break;
        if (d >= from && d >= ev.date) out.push(d);
      } else if (`${mk}-01` > until) break;
    }
  }
  return out.filter((d) => !ev.skip?.[d]);
}

export function occStatus(ev, d) {
  if (ev.done?.[d]) return 'done';
  const due = new Date(`${d}T${ev.endTime || ev.time || '23:59'}:00`);
  return due < new Date() ? 'missed' : 'upcoming';
}

export function agenda(from, to) {
  const list = [];
  for (const ev of S.events) for (const d of occurrences(ev, from, to)) list.push({ ev, date: d, status: occStatus(ev, d) });
  list.sort((a, b) => (a.date + (a.ev.time || '00:00')).localeCompare(b.date + (b.ev.time || '00:00')));
  return list;
}

// ---------- Habit ----------
export const PERIOD_LABEL = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };
export const periodKey = (period, d = today()) => (period === 'daily' ? d : period === 'weekly' ? weekKey(d) : monthOf(d));
export const periodStartOf = (period, d) => (period === 'daily' ? d : period === 'weekly' ? weekStart(d) : monthOf(d) + '-01');
export const periodEndOf = (period, d) => (period === 'daily' ? d : period === 'weekly' ? addDays(weekStart(d), 6) : `${monthOf(d)}-${pad(daysInMonth(monthOf(d)))}`);
export const prevPeriodDate = (period, d) => (period === 'daily' ? addDays(d, -1) : period === 'weekly' ? addDays(weekStart(d), -7) : addMonths(monthOf(d), -1) + '-01');
export const nextPeriodDate = (period, d) => (period === 'daily' ? addDays(d, 1) : period === 'weekly' ? addDays(weekStart(d), 7) : addMonths(monthOf(d), 1) + '-01');

export const isDone = (h, key) => !!S.habitLogs[h.id]?.[key];
export function setDone(h, key, v) {
  S.habitLogs[h.id] ||= {};
  if (v) S.habitLogs[h.id][key] = true; else delete S.habitLogs[h.id][key];
}
// apakah habit harian aktif di tanggal d (hari tertentu saja)
export const activeOn = (h, d) => h.period !== 'daily' || !h.days || h.days.length === 7 || h.days.includes(parseYmd(d).getDay());

// daftar tanggal-awal periode dalam rentang [from,to] mulai dari dibuatnya habit, tidak melewati hari ini
export function periodsInRange(h, from, to) {
  const out = [];
  const created = h.createdAt?.slice(0, 10) || from;
  const end = to > today() ? today() : to;
  let d = periodStartOf(h.period, from < created ? created : from);
  for (let i = 0; d <= end && i < 1000; i++, d = nextPeriodDate(h.period, d)) {
    if (periodEndOf(h.period, d) < created) continue;
    if (activeOn(h, d)) out.push(d);
  }
  return out;
}

// statistik: selesai / seharusnya (periode berjalan dihitung hanya jika sudah dicentang)
export function habitStats(h, from, to) {
  const ps = periodsInRange(h, from, to);
  const cur = periodKey(h.period);
  let done = 0, expected = 0;
  for (const d of ps) {
    const k = periodKey(h.period, d);
    const ok = isDone(h, k);
    if (k === cur && !ok) continue;
    expected++; if (ok) done++;
  }
  return { done, expected, rate: expected ? Math.round((done / expected) * 100) : null };
}

export function streak(h) {
  let d = today(), n = 0;
  if (!isDone(h, periodKey(h.period, d))) d = prevPeriodDate(h.period, d);
  for (let i = 0; i < 2000; i++) {
    if (!activeOn(h, d)) { d = prevPeriodDate(h.period, d); continue; }
    if (!isDone(h, periodKey(h.period, d))) break;
    n++; d = prevPeriodDate(h.period, d);
  }
  return n;
}
export function bestStreak(h) {
  const created = h.createdAt?.slice(0, 10) || today();
  let d = periodStartOf(h.period, created), best = 0, run = 0;
  for (let i = 0; d <= today() && i < 3000; i++, d = nextPeriodDate(h.period, d)) {
    if (!activeOn(h, d)) continue;
    if (isDone(h, periodKey(h.period, d))) { run++; best = Math.max(best, run); } else if (periodKey(h.period, d) !== periodKey(h.period)) run = 0;
  }
  return best;
}

export const unitLabel = (p) => (p === 'daily' ? 'hari' : p === 'weekly' ? 'minggu' : 'bulan');
export { ymd };
