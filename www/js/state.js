// ===== State aplikasi + persistensi + brankas terenkripsi =====
import { kvGet, kvSet } from './db.js';
import { uid, debounce, sum, monthOf } from './utils.js';

export const SCHEMA = 1;

const C = (kind, name, emoji, color, extra = {}) => ({ id: uid(), kind, name, emoji, color, ...extra });

export function defaultState() {
  return {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    settings: {
      name: 'Afnan',
      theme: 'auto',
      onboarded: false,
      reminders: {
        habitDaily: { on: true, time: '21:00' },
        habitWeekly: { on: true, weekday: 0, time: '19:00' }, // 0 = Minggu
        habitMonthly: { on: true, time: '20:00' },          // hari terakhir tiap bulan
        morning: { on: true, time: '06:30' },                // ringkasan agenda pagi
        finance: { on: false, time: '21:30' },               // pengingat catat keuangan
      },
      photoSlots: {
        expense: { photoId: null, caption: 'Hati-hati! Pikir dua kali sebelum belanja 😬' },
        income: { photoId: null, caption: 'Alhamdulillah, rezeki masuk! 🤲' },
        budget: { photoId: null, caption: 'Anggaran hampir/sudah habis! Jangan sampai istri marah…' },
        goal: { photoId: null, caption: 'Target tercapai! Kamu hebat! 🎉' },
        home: { photoId: null, caption: 'Semangat hari ini!' },
      },
      hideAmounts: false,
      vaultShortcut: false,
      lastAutoBackup: null,
      autoBackup: true,
    },
    photos: [], // {id, label, createdAt} -> data di store 'blobs' dengan key 'ph:'+id
    // Planner
    eventCats: [
      { id: 'kerja', name: 'Kerja', color: '#2a78d6' },
      { id: 'pribadi', name: 'Pribadi', color: '#6250d6' },
      { id: 'keluarga', name: 'Keluarga', color: '#e87ba4' },
      { id: 'ibadah', name: 'Ibadah', color: '#1baf7a' },
      { id: 'kesehatan', name: 'Kesehatan', color: '#eb6834' },
      { id: 'lainnya', name: 'Lainnya', color: '#8a8f98' },
    ],
    events: [],
    // Habit
    habits: [],
    habitLogs: {}, // { habitId: { periodKey: true } }
    // Keuangan
    accounts: [
      { id: uid(), name: 'Tunai', type: 'cash', emoji: '💵', color: '#1baf7a', initial: 0, archived: false },
      { id: uid(), name: 'BRI', type: 'bank', emoji: '🏦', color: '#2a78d6', initial: 0, archived: false },
      { id: uid(), name: 'BSI', type: 'bank', emoji: '🏦', color: '#008300', initial: 0, archived: false },
      { id: uid(), name: 'GoPay', type: 'ewallet', emoji: '📱', color: '#199e70', initial: 0, archived: false },
    ],
    categories: [
      C('expense', 'Makan & Minum', '🍽️', '#eb6834'),
      C('expense', 'Transportasi', '🚗', '#2a78d6'),
      C('expense', 'Belanja Rumah Tangga', '🛒', '#1baf7a'),
      C('expense', 'Tagihan & Utilitas', '💡', '#eda100'),
      C('expense', 'Pulsa & Internet', '📶', '#6250d6'),
      C('expense', 'Kesehatan', '💊', '#e34948'),
      C('expense', 'Pendidikan', '📚', '#008300'),
      C('expense', 'Hiburan', '🎬', '#e87ba4'),
      C('expense', 'Sedekah & Zakat', '🤲', '#199e70'),
      C('expense', 'Keluarga', '👨‍👩‍👧', '#d55181'),
      C('expense', 'Pakaian', '👕', '#9085e9'),
      C('expense', 'Lainnya', '📦', '#8a8f98'),
      C('expense', 'Tabungan Goals', '🎯', '#0B3B5C', { system: 'goal' }),
      C('expense', 'Pembayaran Cicilan', '💳', '#52514e', { system: 'debt' }),
      C('income', 'Gaji', '💼', '#2a78d6'),
      C('income', 'Tunjangan / Tukin', '🏅', '#1baf7a'),
      C('income', 'Honor / Lembur', '💵', '#eda100'),
      C('income', 'Usaha / Bisnis', '🏪', '#eb6834'),
      C('income', 'Hadiah', '🎁', '#e87ba4'),
      C('income', 'Lainnya', '➕', '#8a8f98'),
      C('income', 'Pencairan Goal', '🎯', '#0B3B5C', { system: 'goal' }),
      C('income', 'Dana Pinjaman', '🏦', '#52514e', { system: 'debt' }),
    ],
    transactions: [], // {id,type,amount,accountId,toAccountId,categoryId,goalId,date,time,note,photoId,createdAt}
    budgets: {},      // { 'YYYY-MM': { categoryId: amount } }
    goals: [],        // {id,name,emoji,target,deadline,photoId,color,createdAt,completedAt,note}
    // Brankas (hutang) terenkripsi
    vault: null,          // {salt, iv, data} | null
    vaultPinHash: null,   // hash untuk verifikasi
    vaultReminders: [],   // [{day}] — tanpa detail, untuk notifikasi diskret
  };
}

export let S = null;
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const persist = debounce(async () => {
  try { await kvSet('state', S); } catch (e) { console.error('Gagal simpan', e); }
}, 250);

export function save(opts = {}) {
  S.updatedAt = new Date().toISOString();
  persist();
  if (!opts.silent) listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
}

export async function flush() { await kvSet('state', S); }

export async function load() {
  const saved = await kvGet('state');
  S = saved ? migrate(saved) : defaultState();
  if (!saved) await kvSet('state', S);
  return S;
}

export function replaceState(next) { S = migrate(next); return flush(); }

function migrate(s) {
  const d = defaultState();
  // isi kunci yang belum ada (untuk versi lama / backup)
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  s.settings = { ...d.settings, ...s.settings };
  s.settings.reminders = { ...d.settings.reminders, ...s.settings.reminders };
  s.settings.photoSlots = { ...d.settings.photoSlots, ...s.settings.photoSlots };
  for (const sys of ['goal', 'debt']) for (const kind of ['income', 'expense']) {
    if (!s.categories.some((c) => c.system === sys && c.kind === kind)) s.categories.push(d.categories.find((c) => c.system === sys && c.kind === kind));
  }
  s.schema = SCHEMA;
  return s;
}

// ===== Selektor keuangan =====
export const cat = (id) => S.categories.find((c) => c.id === id);
export const acc = (id) => S.accounts.find((a) => a.id === id);
export const goal = (id) => S.goals.find((g) => g.id === id);
export const sysCat = (kind, sys) => S.categories.find((c) => c.kind === kind && c.system === sys);

export function accountBalance(id, uptoDate = null) {
  const a = acc(id); if (!a) return 0;
  let b = Number(a.initial) || 0;
  for (const t of S.transactions) {
    if (uptoDate && t.date > uptoDate) continue;
    if (t.type === 'income' && t.accountId === id) b += t.amount;
    else if (t.type === 'expense' && t.accountId === id) b -= t.amount;
    else if (t.type === 'transfer') { if (t.accountId === id) b -= t.amount + (t.fee || 0); if (t.toAccountId === id) b += t.amount; }
  }
  return b;
}
export const totalCash = (upto = null) => sum(S.accounts.filter((a) => !a.archived), (a) => accountBalance(a.id, upto));

export function goalSaved(id) {
  let s = 0;
  for (const t of S.transactions) if (t.goalId === id) s += t.type === 'expense' ? t.amount : -t.amount;
  return s;
}
export const totalGoals = () => sum(S.goals, (g) => goalSaved(g.id));

export function txInMonth(mk) { return S.transactions.filter((t) => monthOf(t.date) === mk); }
export function monthTotals(mk) {
  const list = txInMonth(mk);
  const income = sum(list.filter((t) => t.type === 'income' && !cat(t.categoryId)?.system), (t) => t.amount);
  const expense = sum(list.filter((t) => t.type === 'expense' && !cat(t.categoryId)?.system), (t) => t.amount);
  const saving = sum(list.filter((t) => t.type === 'expense' && cat(t.categoryId)?.system === 'goal'), (t) => t.amount);
  const debtPay = sum(list.filter((t) => t.type === 'expense' && cat(t.categoryId)?.system === 'debt'), (t) => t.amount);
  const incomeAll = sum(list.filter((t) => t.type === 'income'), (t) => t.amount);
  const expenseAll = sum(list.filter((t) => t.type === 'expense'), (t) => t.amount);
  return { income, expense, saving, debtPay, incomeAll, expenseAll, net: incomeAll - expenseAll, count: list.length };
}
export function spentByCat(mk) {
  const m = {};
  for (const t of txInMonth(mk)) if (t.type === 'expense') m[t.categoryId] = (m[t.categoryId] || 0) + t.amount;
  return m;
}

// ===== Brankas (AES-GCM, kunci dari PIN via PBKDF2) =====
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function vaultEncrypt(pin, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { salt: b64(salt), iv: b64(iv), data: b64(ct) };
}
export async function vaultDecrypt(pin, v) {
  const key = await deriveKey(pin, unb64(v.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
export const emptyVault = () => ({ debts: [], payments: [] });
