// ===== Penjadwalan notifikasi lokal (tanpa internet) =====
import { S } from './state.js';
import { Notif, ensureNotifPermission } from './native.js';
import { agenda, eventCat } from './logic.js';
import { today, addDays, monthKey, addMonths, daysInMonth, debounce, parseYmd } from './utils.js';

const CH = 'afnan-reminder';
let ready = false;

export async function initNotifications(onTap) {
  if (!Notif) return;
  try {
    await ensureNotifPermission();
    await Notif.createChannel?.({ id: CH, name: 'Pengingat Afnan Assistant', description: 'Pengingat kegiatan, habit, dan keuangan', importance: 4, visibility: 1, vibration: true }).catch(() => {});
    Notif.addListener('localNotificationActionPerformed', (e) => { const r = e?.notification?.extra?.route; if (r) onTap?.(r); });
    ready = true;
  } catch (e) { console.warn('notif init', e); }
}

const at = (d, hm) => { const [h, m] = hm.split(':').map(Number); const x = parseYmd(d); x.setHours(h, m, 0, 0); return x; };

export function buildNotifications() {
  const out = [];
  let id = 1000;
  const now = new Date();
  const push = (n) => out.push({ id: id++, channelId: CH, smallIcon: 'ic_stat_notify', iconColor: '#0E7C66', ...n });
  const R = S.settings.reminders;

  // 1) Kegiatan planner (45 hari ke depan)
  const list = agenda(today(), addDays(today(), 45)).filter((o) => o.status !== 'done' && o.ev.remind != null && o.ev.remind >= 0);
  for (const o of list) {
    const base = at(o.date, o.ev.time || '07:00');
    const when = new Date(base.getTime() - o.ev.remind * 60000);
    if (when <= now) continue;
    const r = o.ev.remind;
    const lead = r >= 1440 ? 'Besok' : !o.ev.time ? 'Hari ini' : r === 0 ? 'Sekarang' : r >= 60 ? `${r / 60} jam lagi` : `${r} menit lagi`;
    push({ title: `📅 ${o.ev.title}`, body: `${lead}${o.ev.time ? ' · ' + o.ev.time : ' · Sepanjang hari'}${o.ev.location ? ' · ' + o.ev.location : ''} — ${eventCat(o.ev.catId).name}`, schedule: { at: when, allowWhileIdle: true }, extra: { route: '#/planner?d=' + o.date } });
    if (out.length > 220) break;
  }

  // 2) Ringkasan pagi (14 hari, hanya jika ada kegiatan)
  if (R.morning.on) for (let i = 0; i < 14; i++) {
    const d = addDays(today(), i), when = at(d, R.morning.time);
    if (when <= now) continue;
    const items = agenda(d, d).filter((o) => o.status !== 'done');
    if (!items.length) continue;
    push({ title: `☀️ Agenda hari ini (${items.length})`, body: items.slice(0, 4).map((o) => `${o.ev.time || '•'} ${o.ev.title}`).join('  |  ') + (items.length > 4 ? ` +${items.length - 4} lagi` : ''), schedule: { at: when, allowWhileIdle: true }, extra: { route: '#/planner?d=' + d } });
  }

  const has = (p) => S.habits.some((h) => !h.archived && h.period === p);
  const hm = (t) => t.split(':').map(Number);
  // 3) Habit harian — setiap malam
  if (R.habitDaily.on && has('daily')) { const [h, m] = hm(R.habitDaily.time); push({ title: '✅ Waktunya isi habit harian', body: 'Centang habit yang sudah kamu lakukan hari ini. Jaga streak-mu! 🔥', schedule: { on: { hour: h, minute: m }, allowWhileIdle: true }, extra: { route: '#/habits?p=daily' } }); }
  // 4) Habit mingguan — akhir pekan
  if (R.habitWeekly.on && has('weekly')) { const [h, m] = hm(R.habitWeekly.time); push({ title: '🗓️ Akhir pekan: isi habit mingguan', body: 'Sudah sejauh mana target minggu ini? Yuk ceklis sekarang.', schedule: { on: { weekday: (Number(R.habitWeekly.weekday) || 0) + 1, hour: h, minute: m }, allowWhileIdle: true }, extra: { route: '#/habits?p=weekly' } }); }
  // 5) Habit bulanan — hari terakhir tiap bulan (12 bulan ke depan)
  if (R.habitMonthly.on && has('monthly')) for (let i = 0; i < 12; i++) {
    const mk = addMonths(monthKey(), i), d = `${mk}-${daysInMonth(mk)}`, when = at(d, R.habitMonthly.time);
    if (when > now) push({ title: '📆 Akhir bulan: isi habit bulanan', body: 'Bulan hampir berakhir — tandai habit bulanan yang sudah tercapai.', schedule: { at: when, allowWhileIdle: true }, extra: { route: '#/habits?p=monthly' } });
  }
  // 6) Catat keuangan harian
  if (R.finance.on) { const [h, m] = hm(R.finance.time); push({ title: '💰 Sudah catat keuangan hari ini?', body: 'Catat pemasukan & pengeluaran selagi masih ingat.', schedule: { on: { hour: h, minute: m }, allowWhileIdle: true }, extra: { route: '#/finance?t=tx' } }); }
  // 7) Pengingat cicilan (diskret, tanpa detail)
  for (const r of S.vaultReminders || []) push({ title: '🔔 Pengingat pembayaran', body: 'Ada pembayaran terjadwal hari ini. Buka aplikasi untuk detail.', schedule: { on: { day: Math.min(28, Number(r.day) || 1), hour: 8, minute: 0 }, allowWhileIdle: true }, extra: { route: '#/home' } });
  return out;
}

async function doReschedule() {
  if (!Notif || !ready) return;
  try {
    const pend = await Notif.getPending();
    if (pend?.notifications?.length) await Notif.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
    const list = buildNotifications();
    if (list.length) await Notif.schedule({ notifications: list });
  } catch (e) { console.warn('reschedule', e); }
}
export const reschedule = debounce(doReschedule, 1200);
export const rescheduleNow = doReschedule;

export async function testNotification() {
  if (!Notif) return false;
  await ensureNotifPermission();
  await Notif.schedule({ notifications: [{ id: 99, channelId: CH, smallIcon: 'ic_stat_notify', title: '🔔 Tes notifikasi', body: 'Notifikasi Afnan Assistant berfungsi dengan baik!', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
  return true;
}
