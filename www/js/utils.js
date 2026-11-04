// ===== Utilitas umum: tanggal, format, id, escape =====

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = (n) => String(n).padStart(2, '0');

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const HR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// --- tanggal lokal (YYYY-MM-DD) ---
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthOf = (s) => s.slice(0, 7);
export const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return monthKey(d); };
export const daysInMonth = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const monthLabel = (mk, short = false) => { const [y, m] = mk.split('-').map(Number); return `${(short ? BLN : BULAN)[m - 1]} ${y}`; };
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Minggu ISO (Senin sebagai awal minggu)
export const weekStart = (s) => { const d = parseYmd(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); };
export const weekKey = (s) => {
  const d = parseYmd(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${pad(w)}`;
};
export const weekLabel = (startYmd) => {
  const a = parseYmd(startYmd), b = parseYmd(addDays(startYmd, 6));
  const sameM = a.getMonth() === b.getMonth();
  return `${a.getDate()}${sameM ? '' : ' ' + BLN[a.getMonth()]} – ${b.getDate()} ${BLN[b.getMonth()]} ${b.getFullYear()}`;
};

export const fmtDate = (s, opt = {}) => {
  if (!s) return '';
  const d = parseYmd(s.slice(0, 10));
  const base = `${d.getDate()} ${(opt.long ? BULAN : BLN)[d.getMonth()]}${opt.noYear ? '' : ' ' + d.getFullYear()}`;
  return opt.day ? `${(opt.long ? HARI : HR)[d.getDay()]}, ${base}` : base;
};
export const relDay = (s) => {
  const n = diffDays(today(), s);
  if (n === 0) return 'Hari ini';
  if (n === 1) return 'Besok';
  if (n === -1) return 'Kemarin';
  if (n > 1 && n < 7) return HARI[parseYmd(s).getDay()];
  return fmtDate(s, { day: true, noYear: parseYmd(s).getFullYear() === new Date().getFullYear() });
};

// --- uang ---
const nf = new Intl.NumberFormat('id-ID');
export const rp = (n, opt = {}) => {
  const v = Math.round(Number(n) || 0);
  const s = (v < 0 ? '-' : '') + 'Rp' + (opt.space ? ' ' : '') + nf.format(Math.abs(v));
  return opt.sign && v > 0 ? '+' + s : s;
};
export const rpShort = (n) => {
  const v = Number(n) || 0, a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 1e9) return sg + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
  if (a >= 1e6) return sg + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' jt';
  if (a >= 1e3) return sg + Math.round(a / 1e3) + ' rb';
  return sg + Math.round(a);
};
export const num = (n) => nf.format(Math.round(Number(n) || 0));
export const parseNum = (s) => Number(String(s ?? '').replace(/[^\d-]/g, '')) || 0;
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const hashStr = (s) => { let h = 0; for (const c of String(s)) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return Math.abs(h); };

export async function sha256(text) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'h' + hashStr(text);
}

export const greet = () => {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
};

// Kompres gambar dari File menjadi dataURL JPEG
export function compressImage(file, maxSide = 1024, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const r = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
