// ===== Kredensial rahasia (password, email, rekening, PIN, tanggal, catatan) =====
// Disimpan di dalam brankas terenkripsi yang sama dengan data hutang.
import { icon } from '../icons.js';
import { esc, uid, today, fmtDate, parseYmd, diffDays } from '../utils.js';
import { openSheet, $, $$, toast, confirmBox, empty } from '../ui.js';

export const TYPES = {
  password: { label: 'Akun / Password', emoji: '🔑', color: '#7B2FF7', fields: [['Situs / Aplikasi', false], ['Username / Email', false], ['Password', true]] },
  email: { label: 'Email', emoji: '📧', color: '#FF3D7F', fields: [['Alamat email', false], ['Password', true], ['Email/No. pemulihan', false]] },
  bank: { label: 'Rekening', emoji: '🏦', color: '#12B886', fields: [['Bank', false], ['Nama pemilik', false], ['Nomor rekening', true], ['PIN m-banking', true]] },
  pin: { label: 'PIN / Kode', emoji: '🔢', color: '#FF6A3D', fields: [['Untuk', false], ['PIN / Kode', true]] },
  card: { label: 'Kartu', emoji: '💳', color: '#2a78d6', fields: [['Nama kartu', false], ['Nomor kartu', true], ['Berlaku s.d.', false], ['CVV', true]] },
  date: { label: 'Tanggal Penting', emoji: '📅', color: '#E88A00', fields: [['Tanggal', false, 'date']] },
  wifi: { label: 'Wi-Fi', emoji: '📶', color: '#0FC2A0', fields: [['Nama Wi-Fi (SSID)', false], ['Password', true]] },
  note: { label: 'Catatan', emoji: '📝', color: '#8a8f98', fields: [] },
};

let filter = 'all', q = '';
const mask = (v) => '•'.repeat(Math.min(12, Math.max(6, String(v).length)));

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (_) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast('Disalin ke clipboard 📋', 'good');
  navigator.vibrate?.(15);
}

// hitung "x hari lagi" untuk tanggal berulang tahunan
function nextYearly(ymdStr) {
  if (!ymdStr) return null;
  const d = parseYmd(ymdStr), t = parseYmd(today());
  let n = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (n < t) n = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  const days = Math.round((n - t) / 86400000);
  return { days, years: n.getFullYear() - d.getFullYear() };
}

function subtitle(it) {
  const T = TYPES[it.type] || TYPES.note;
  if (it.type === 'date') {
    const v = it.fields[0]?.value; const nx = nextYearly(v);
    return v ? `${fmtDate(v, { long: true })}${nx ? ` · ${nx.days === 0 ? '🎉 Hari ini!' : nx.days + ' hari lagi'}${it.yearly && nx.years > 0 ? ` (ke-${nx.years})` : ''}` : ''}` : '';
  }
  const pub = it.fields.find((f) => !f.secret && f.value);
  return pub ? pub.value : T.label;
}

export function secretsHtml(V) {
  const list = (V.secrets || []).filter((it) => (filter === 'all' || it.type === filter || (filter === 'fav' && it.fav)) &&
    (!q || [it.title, it.note, ...it.fields.filter((f) => !f.secret).map((f) => f.value)].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.title.localeCompare(b.title));
  const counts = {}; for (const it of V.secrets || []) counts[it.type] = (counts[it.type] || 0) + 1;
  const upcoming = (V.secrets || []).filter((it) => it.type === 'date' && it.yearly).map((it) => ({ it, nx: nextYearly(it.fields[0]?.value) })).filter((x) => x.nx && x.nx.days <= 30).sort((a, b) => a.nx.days - b.nx.days);
  return `
    <div class="vault-banner"><div class="small" style="opacity:.8">Kredensial tersimpan</div><div class="v-big">${(V.secrets || []).length} item</div>
      <div class="small" style="opacity:.8">🔐 Terenkripsi AES-256 dengan PIN brankas — tidak pernah keluar dari HP ini.</div></div>
    ${upcoming.length ? `<div class="card"><div class="card-h"><h3>📅 Tanggal penting dalam 30 hari</h3></div><div class="list">${upcoming.map(({ it, nx }) => `<div class="li tap" data-sec="${it.id}"><div class="ava" style="background:#E88A0022">📅</div><div class="main"><div class="t1">${esc(it.title)}</div><div class="t2">${fmtDate(it.fields[0].value, { noYear: true })}${nx.years > 0 ? ` · ke-${nx.years}` : ''}</div></div><span class="pill ${nx.days <= 3 ? 'warn' : ''}">${nx.days === 0 ? 'Hari ini' : nx.days + ' hari'}</span></div>`).join('')}</div></div>` : ''}
    <div class="search">${icon('search', 18)}<input id="sec-q" placeholder="Cari judul, situs, email…" value="${esc(q)}"></div>
    <div class="chips" style="margin-bottom:12px"><button class="chip ${filter === 'all' ? 'on' : ''}" data-sf="all">Semua</button><button class="chip ${filter === 'fav' ? 'on' : ''}" data-sf="fav">⭐ Favorit</button>
      ${Object.entries(TYPES).filter(([k]) => counts[k]).map(([k, t]) => `<button class="chip ${filter === k ? 'on' : ''}" data-sf="${k}">${t.emoji} ${t.label} <span class="faint small">${counts[k]}</span></button>`).join('')}</div>
    <div class="card" style="padding-top:6px">${list.length ? `<div class="list">${list.map((it) => { const T = TYPES[it.type] || TYPES.note; return `<div class="li tap sec-item" data-sec="${it.id}"><div class="ava" style="background:${T.color}22">${T.emoji}</div>
        <div class="main"><div class="t1">${it.fav ? '⭐ ' : ''}${esc(it.title)}</div><div class="t2">${esc(subtitle(it))}</div></div>${icon('right', 18, 'faint')}</div>`; }).join('')}</div>`
      : empty('lock', (V.secrets || []).length ? 'Tidak ditemukan' : 'Belum ada kredensial', 'Simpan password, email, rekening, PIN ATM, tanggal penting, dll. Ketuk + untuk menambah.')}</div>`;
}

export function bindSecrets(el, V, persist, rerender) {
  const qi = $('#sec-q', el);
  if (qi) qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; rerender(); const n = document.querySelector('#sec-q'); n?.focus(); n?.setSelectionRange(pos, pos); };
  $$('[data-sf]', el).forEach((b) => (b.onclick = () => { filter = b.dataset.sf; rerender(); }));
  $$('[data-sec]', el).forEach((r) => (r.onclick = () => openSecret(V.secrets.find((x) => x.id === r.dataset.sec), V, persist)));
}

function openSecret(it, V, persist) {
  if (!it) return;
  const T = TYPES[it.type] || TYPES.note;
  openSheet({
    title: `${T.emoji} ${it.title}`,
    body: `<div class="row gap" style="margin-bottom:12px"><span class="pill">${T.label}</span>${it.updatedAt ? `<span class="pill">Diubah ${fmtDate(it.updatedAt.slice(0, 10))}</span>` : ''}</div>
      ${it.fields.filter((f) => f.value).map((f, i) => `<div class="sec-field"><div class="main"><div class="lbl">${esc(f.label)}</div>
          <div class="val" data-v="${i}">${f.secret ? mask(f.value) : esc(f.type === 'date' ? fmtDate(f.value, { long: true, day: true }) : f.value)}</div></div>
          ${f.secret ? `<button class="icon-btn" data-eye="${i}" aria-label="Lihat">${icon('eye', 19)}</button>` : ''}
          <button class="icon-btn" data-copy="${i}" aria-label="Salin">${icon('copy', 19)}</button></div>`).join('')}
      ${it.type === 'date' && it.fields[0]?.value ? (() => { const nx = nextYearly(it.fields[0].value); const ago = diffDays(it.fields[0].value, today()); return `<div class="warn-box" style="background:var(--grad-soft)">📅<div>${ago >= 0 ? `Sudah <b>${ago.toLocaleString('id-ID')} hari</b> sejak tanggal ini.` : `<b>${(-ago).toLocaleString('id-ID')} hari</b> lagi.`}${it.yearly && nx ? ` Peringatan tahunan berikutnya: <b>${nx.days === 0 ? 'hari ini 🎉' : nx.days + ' hari lagi'}</b>.` : ''}</div></div>`; })() : ''}
      ${it.note ? `<div class="sec-field"><div class="main"><div class="lbl">Catatan</div><div style="white-space:pre-wrap">${esc(it.note)}</div></div><button class="icon-btn" data-copy="note">${icon('copy', 19)}</button></div>` : ''}
      <div class="sheet-actions"><button class="btn ghost" data-a="del">${icon('trash', 18)}</button><button class="btn ghost" data-a="fav">${it.fav ? '★' : '☆'}</button><button class="btn primary grow" data-a="edit">${icon('edit', 18)} Ubah</button></div>`,
    onMount: (el, close) => {
      $$('[data-eye]', el).forEach((b) => (b.onclick = () => {
        const i = +b.dataset.eye, v = $(`[data-v="${i}"]`, el), f = it.fields.filter((x) => x.value)[i];
        const shown = v.dataset.shown === '1';
        v.textContent = shown ? mask(f.value) : f.value; v.dataset.shown = shown ? '0' : '1';
        b.innerHTML = icon(shown ? 'eye' : 'eyeOff', 19);
      }));
      $$('[data-copy]', el).forEach((b) => (b.onclick = () => copy(b.dataset.copy === 'note' ? it.note : it.fields.filter((x) => x.value)[+b.dataset.copy].value)));
      $('[data-a="fav"]', el).onclick = async () => { it.fav = !it.fav; await persist(); close(); };
      $('[data-a="edit"]', el).onclick = () => { close(); openSecretForm(V, persist, it); };
      $('[data-a="del"]', el).onclick = async () => {
        if (!(await confirmBox(`Hapus “${esc(it.title)}”?`, { ok: 'Hapus', danger: true }))) return;
        V.secrets = V.secrets.filter((x) => x !== it); await persist(); close(); toast('Dihapus');
      };
    },
  });
}

const genPass = (n = 14) => { const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?'; const a = crypto.getRandomValues(new Uint32Array(n)); return [...a].map((x) => cs[x % cs.length]).join(''); };

export function openSecretForm(V, persist, it = null) {
  let type = it?.type || 'password';
  let fields = it ? it.fields.map((f) => ({ ...f })) : null;
  const tmpl = (t) => TYPES[t].fields.map(([label, secret, ftype]) => ({ label, value: '', secret, type: ftype || 'text' }));
  if (!fields) fields = tmpl(type);
  openSheet({
    title: it ? 'Ubah Kredensial' : 'Simpan Kredensial', full: true,
    body: `${it ? '' : `<div class="field"><label>Jenis</label><div class="type-grid" id="sf-type">${Object.entries(TYPES).map(([k, t]) => `<button type="button" data-t="${k}" class="${k === type ? 'on' : ''}"><span class="em">${t.emoji}</span>${t.label}</button>`).join('')}</div></div>`}
      <div class="field"><label>Judul</label><input class="inp" id="sf-title" value="${esc(it?.title || '')}" placeholder="mis. Gmail pribadi, BRI tabungan, Ulang tahun istri"></div>
      <div id="sf-fields"></div>
      <button type="button" class="btn ghost sm" id="sf-add" style="margin-bottom:12px">${icon('plus', 15)} Tambah kolom</button>
      <div class="set-row" id="sf-yearly-w" style="${type === 'date' ? '' : 'display:none'}"><div class="main"><div class="t1">Peringati setiap tahun</div><div class="t2">Tampilkan hitung mundur tahunan (ulang tahun, anniversary)</div></div><label class="switch"><input type="checkbox" id="sf-yearly" ${it?.yearly ?? true ? 'checked' : ''}><span></span></label></div>
      <div class="field"><label>Catatan (opsional)</label><textarea class="inp" id="sf-note" rows="3">${esc(it?.note || '')}</textarea></div>
      <div class="sheet-actions"><button class="btn primary block" id="sf-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      const read = () => $$('.sf-row', el).forEach((r, i) => { fields[i].label = $('.sf-l', r).value; fields[i].value = $('.sf-v', r).value; fields[i].secret = $('.sf-s', r).checked; });
      const paint = () => {
        $('#sf-fields', el).innerHTML = fields.map((f, i) => `<div class="sf-row card flat" style="padding:10px 12px;margin-bottom:8px">
          <div class="row gap" style="margin-bottom:6px"><input class="inp sf-l" style="height:34px;font-size:12.5px;font-weight:600" value="${esc(f.label)}" placeholder="Nama kolom">
            <label class="row gap small muted" style="flex:none;gap:4px"><input type="checkbox" class="sf-s" ${f.secret ? 'checked' : ''}>Rahasia</label>
            <button type="button" class="icon-btn" data-rm="${i}" style="width:32px;height:32px">${icon('x', 16)}</button></div>
          <div class="row gap"><input class="inp sf-v" type="${f.type === 'date' ? 'date' : 'text'}" value="${esc(f.value)}" autocomplete="off" autocapitalize="off" spellcheck="false" ${/pin|kode|nomor|cvv/i.test(f.label) ? 'inputmode="numeric"' : ''}>
            ${/password/i.test(f.label) ? `<button type="button" class="btn ghost sm" data-gen="${i}" title="Buat password acak">🎲</button>` : ''}</div></div>`).join('');
        $$('[data-rm]', el).forEach((b) => (b.onclick = () => { read(); fields.splice(+b.dataset.rm, 1); paint(); }));
        $$('[data-gen]', el).forEach((b) => (b.onclick = () => { read(); fields[+b.dataset.gen].value = genPass(); paint(); toast('Password acak dibuat'); }));
      };
      paint();
      $$('#sf-type button', el).forEach((b) => (b.onclick = () => {
        type = b.dataset.t; $$('#sf-type button', el).forEach((x) => x.classList.toggle('on', x === b));
        fields = tmpl(type); paint(); $('#sf-yearly-w', el).style.display = type === 'date' ? '' : 'none';
      }));
      $('#sf-add', el).onclick = () => { read(); fields.push({ label: '', value: '', secret: false, type: 'text' }); paint(); };
      $('#sf-save', el).onclick = async () => {
        read();
        const title = $('#sf-title', el).value.trim();
        if (!title) return toast('Judul wajib diisi', 'bad');
        const data = { type, title, fields: fields.filter((f) => f.label || f.value), note: $('#sf-note', el).value.trim(), yearly: type === 'date' ? $('#sf-yearly', el).checked : false, updatedAt: new Date().toISOString() };
        if (it) Object.assign(it, data); else (V.secrets ||= []).push({ id: uid(), ...data, fav: false, createdAt: today() });
        await persist(); close(); toast('Tersimpan aman 🔐', 'good');
      };
    },
  });
}
