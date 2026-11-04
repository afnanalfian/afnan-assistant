// ===== Brankas Hutang (rahasia, dilindungi PIN & terenkripsi AES-GCM) =====
import { S, save, acc, sysCat, accountBalance, vaultEncrypt, vaultDecrypt, emptyVault } from '../state.js';
import { icon } from '../icons.js';
import { esc, uid, today, nowHM, rp, rpShort, pct, sum, groupBy, fmtDate, sha256, monthKey, pad, daysInMonth, addMonths, diffDays } from '../utils.js';
import { openSheet, $, $$, toast, confirmBox, pinPad, empty, bindMoney, moneyVal, confetti } from '../ui.js';
import { hbars, PALETTE } from '../charts.js';
import { secretsHtml, bindSecrets, openSecretForm } from './secrets.js';

let vtab = 'debt';

let V = null;     // data brankas terbuka (di memori saja)
let PIN = null;
export const isUnlocked = () => !!V;
export function lockVault() { V = null; PIN = null; }
const rerender = () => window.dispatchEvent(new Event('rerender'));

async function persistVault() {
  S.vault = await vaultEncrypt(PIN, V);
  const days = [...new Set(V.debts.filter((d) => d.remind && remaining(d) > 0 && d.dueDay).map((d) => Number(d.dueDay)))];
  S.vaultReminders = days.map((day) => ({ day }));
  save();
}

const paid = (d) => sum(V.payments.filter((p) => p.debtId === d.id), (p) => p.amount);
const remaining = (d) => Math.max(0, d.amount - paid(d));
function nextDue(d) {
  if (!d.dueDay) return null;
  const now = new Date(); const day = Math.min(Number(d.dueDay), 28);
  let mk = monthKey();
  if (now.getDate() > day) mk = addMonths(mk, 1);
  return `${mk}-${pad(day)}`;
}
export function vaultSummary() {
  if (!V) return null;
  const act = V.debts.filter((d) => remaining(d) > 0);
  return { total: sum(act, remaining), monthly: sum(act, (d) => d.installment || 0), count: act.length, paidTotal: sum(V.payments, (p) => p.amount) };
}

// ---------- Pintu masuk ----------
export function render() {
  if (!V) {
    return {
      title: 'Brankas Rahasia', sub: 'Terkunci', html: `<div class="card center" style="padding:36px 18px">${icon('lock', 46)}<h3 style="margin:12px 0 6px">Brankas terkunci</h3>
        <p class="muted small">Hutang & kredensial (password, rekening, PIN, dll.) disimpan terenkripsi dan hanya bisa dibuka dengan PIN rahasia.</p><button class="btn primary block" id="v-open">${icon('unlock', 18)} Buka Brankas</button></div>`,
      mount(el) { $('#v-open', el).onclick = () => unlock(); },
      enter() { setTimeout(() => { if (location.hash.startsWith('#/vault') && !V && !document.querySelector('.pin-sheet')) unlock(); }, 150); },
    };
  }
  return renderOpen();
}

function unlock() {
  if (!S.vaultPinHash) {
    let first = null;
    pinPad({
      title: 'Buat PIN Brankas', subtitle: 'Buat PIN 6 digit untuk melindungi data hutang', onSubmit: async (v, close) => {
        if (!first) { first = v; close(); setTimeout(() => pinPad({ title: 'Ulangi PIN', subtitle: 'Masukkan PIN yang sama sekali lagi', onSubmit: async (v2, c2) => {
          if (v2 !== first) { first = null; c2(); toast('PIN tidak sama, ulangi', 'bad'); return true; }
          PIN = v2; V = emptyVault(); S.vaultPinHash = await sha256('afnan-vault:' + v2); await persistVault(); c2(); toast('Brankas dibuat 🔐', 'good'); rerender(); return true;
        } }), 250); return true; }
      },
    });
    return;
  }
  pinPad({
    title: 'PIN Brankas', subtitle: 'Masukkan PIN untuk membuka data hutang',
    onSubmit: async (v, close) => {
      if ((await sha256('afnan-vault:' + v)) !== S.vaultPinHash) return false;
      try { V = S.vault ? await vaultDecrypt(v, S.vault) : emptyVault(); V.secrets ||= []; V.debts ||= []; V.payments ||= []; PIN = v; } catch (e) { return 'Gagal membuka brankas'; }
      close(); rerender(); return true;
    },
  });
}

// ---------- Tampilan terbuka ----------
function renderOpen() {
  const tabs = `<div class="tabs"><button class="${vtab === 'debt' ? 'on' : ''}" data-vt="debt">💳 Hutang</button><button class="${vtab === 'sec' ? 'on' : ''}" data-vt="sec">🔑 Kredensial</button></div>`;
  const bindTabs = (el) => $$('[data-vt]', el).forEach((b) => (b.onclick = () => { vtab = b.dataset.vt; rerender(); }));
  const actions = [{ icon: 'lock', label: 'Kunci', onClick: () => { lockVault(); location.hash = '#/finance'; toast('Brankas dikunci'); } }, { icon: 'settings', label: 'Pengaturan brankas', onClick: vaultSettings }];
  if (vtab === 'sec') {
    return { title: 'Brankas Rahasia', sub: '🔓 Terbuka · terkunci saat keluar', actions, fab: () => openSecretForm(V, persistVault),
      html: tabs + secretsHtml(V), mount(el) { bindTabs(el); bindSecrets(el, V, persistVault, rerender); } };
  }
  const r = renderDebt();
  r.html = tabs + r.html; r.actions = actions; r.title = 'Brankas Rahasia';
  const m = r.mount; r.mount = (el) => { bindTabs(el); m(el); };
  return r;
}

function renderDebt() {
  const sm = vaultSummary();
  const act = V.debts.filter((d) => remaining(d) > 0), done = V.debts.filter((d) => remaining(d) <= 0);
  const byCred = groupBy(act, (d) => d.creditor || 'Lainnya');
  const credList = Object.entries(byCred).map(([k, l], i) => ({ label: k, value: sum(l, remaining), color: PALETTE[i % 8], right: rp(sum(l, remaining)), sub: `${l.length} hutang · cicilan ${rp(sum(l, (d) => d.installment || 0))}/bln` })).sort((a, b) => b.value - a.value);
  const debtCard = (d) => {
    const r = remaining(d), p = pct(paid(d), d.amount), nd = nextDue(d);
    const monthsLeft = d.installment ? Math.ceil(r / d.installment) : null;
    const thisMonthPaid = V.payments.some((x) => x.debtId === d.id && x.date.slice(0, 7) === monthKey());
    return `<div class="card" data-debt="${d.id}">
      <div class="row between"><div style="min-width:0"><div style="font-weight:750">${esc(d.name || d.creditor)}</div><div class="muted small">Dari: ${esc(d.creditor)}</div></div>
        <div class="end" style="text-align:right"><div style="font-weight:800" class="${r ? 'exp' : 'inc'}">${rp(r)}</div><div class="faint small">sisa dari ${rpShort(d.amount)}</div></div></div>
      <div class="prog" style="margin:10px 0 8px"><div style="width:${p}%;background:${r ? 'var(--primary)' : 'var(--inc)'}"></div></div>
      <div class="row gap" style="flex-wrap:wrap">${r ? `${d.installment ? `<span class="pill">💳 ${rp(d.installment)}/bln</span>` : ''}${nd ? `<span class="pill ${thisMonthPaid ? 'good' : diffDays(today(), nd) <= 3 ? 'warn' : ''}">${thisMonthPaid ? '✔ Bulan ini lunas' : '📅 Jatuh tempo ' + fmtDate(nd, { noYear: true })}</span>` : ''}${monthsLeft ? `<span class="pill">⏳ ±${monthsLeft} bln lagi</span>` : ''}` : '<span class="pill good">LUNAS</span>'}<span class="pill">${p}% terbayar</span></div>
    </div>`;
  };
  return {
    title: 'Brankas Hutang', sub: '🔓 Terbuka · terkunci saat keluar',
    actions: [{ icon: 'lock', label: 'Kunci', onClick: () => { lockVault(); location.hash = '#/finance'; toast('Brankas dikunci'); } }, { icon: 'settings', label: 'Pengaturan brankas', onClick: vaultSettings }],
    fab: () => openDebtForm(),
    html: `<div class="vault-banner"><div class="small" style="opacity:.8">Total sisa hutang</div><div class="v-big">${rp(sm.total)}</div>
        <div class="h-row" style="display:flex;gap:10px"><div class="grow"><div class="small" style="opacity:.75">Cicilan / bulan</div><b>${rp(sm.monthly)}</b></div><div class="grow"><div class="small" style="opacity:.75">Hutang aktif</div><b>${sm.count}</b></div><div class="grow"><div class="small" style="opacity:.75">Sudah dibayar</div><b>${rpShort(sm.paidTotal)}</b></div></div></div>
      ${credList.length ? `<div class="card"><div class="card-h"><h3>Sisa hutang per asal</h3></div>${hbars(credList)}</div>` : ''}
      ${act.length ? act.map(debtCard).join('') : `<div class="card">${empty('lock', 'Tidak ada hutang aktif', 'Ketuk + untuk mencatat hutang beserta asal dan cicilannya.')}</div>`}
      ${done.length ? `<div class="sec-t">✅ Lunas</div>${done.map(debtCard).join('')}` : ''}`,
    mount(el) { $$('[data-debt]', el).forEach((c) => (c.onclick = () => openDebtDetail(V.debts.find((d) => d.id === c.dataset.debt)))); },
  };
}

function openDebtDetail(d) {
  const pays = V.payments.filter((p) => p.debtId === d.id).sort((a, b) => b.date.localeCompare(a.date));
  openSheet({
    title: d.name || d.creditor,
    body: `<div class="grid2" style="margin-bottom:12px"><div class="stat"><div class="s-l">Pokok hutang</div><div class="s-v">${rpShort(d.amount)}</div></div><div class="stat"><div class="s-l">Sisa</div><div class="s-v exp">${rpShort(remaining(d))}</div></div>
      <div class="stat"><div class="s-l">Cicilan/bulan</div><div class="s-v">${d.installment ? rpShort(d.installment) : '–'}</div></div><div class="stat"><div class="s-l">Jatuh tempo</div><div class="s-v">${d.dueDay ? 'Tgl ' + d.dueDay : '–'}</div></div></div>
      <div class="muted small" style="margin-bottom:10px">Asal: <b>${esc(d.creditor)}</b> · mulai ${fmtDate(d.startDate)}${d.tenor ? ` · tenor ${d.tenor} bln` : ''}${d.remind ? ' · 🔔 pengingat aktif' : ''}</div>
      ${d.note ? `<p class="muted" style="white-space:pre-wrap">${esc(d.note)}</p>` : ''}
      <div class="card flat"><div class="card-h"><h3>Riwayat pembayaran</h3><span class="pill">${pays.length}×</span></div>
        ${pays.length ? `<div class="list">${pays.map((p) => `<div class="li"><div class="ava">💳</div><div class="main"><div class="t1">${rp(p.amount)}</div><div class="t2">${fmtDate(p.date, { day: true })}${p.txId ? ' · dari kas' : ''}${p.note ? ' · ' + esc(p.note) : ''}</div></div><button class="icon-btn" data-delpay="${p.id}">${icon('trash', 17)}</button></div>`).join('')}</div>` : '<div class="muted small">Belum ada pembayaran.</div>'}</div>
      <div class="sheet-actions"><button class="btn ghost" data-a="del">${icon('trash', 18)}</button><button class="btn ghost grow" data-a="edit">${icon('edit', 18)} Ubah</button>${remaining(d) > 0 ? `<button class="btn primary grow" data-a="pay">Bayar</button>` : ''}</div>`,
    onMount: (el, close) => {
      $('[data-a="edit"]', el).onclick = () => { close(); openDebtForm(d); };
      $('[data-a="pay"]', el)?.addEventListener('click', () => { close(); openPayForm(d); });
      $('[data-a="del"]', el).onclick = async () => {
        if (!(await confirmBox('Hapus hutang ini beserta riwayat pembayarannya? (Transaksi kas terkait juga dihapus)', { ok: 'Hapus', danger: true }))) return;
        const ids = V.payments.filter((p) => p.debtId === d.id).map((p) => p.txId).concat(d.txId).filter(Boolean);
        S.transactions = S.transactions.filter((t) => !ids.includes(t.id));
        V.payments = V.payments.filter((p) => p.debtId !== d.id); V.debts = V.debts.filter((x) => x !== d);
        await persistVault(); close(); toast('Hutang dihapus');
      };
      $$('[data-delpay]', el).forEach((b) => (b.onclick = async () => {
        if (!(await confirmBox('Hapus pembayaran ini?', { ok: 'Hapus', danger: true }))) return;
        const p = V.payments.find((x) => x.id === b.dataset.delpay);
        if (p?.txId) S.transactions = S.transactions.filter((t) => t.id !== p.txId);
        V.payments = V.payments.filter((x) => x !== p); await persistVault(); close(); openDebtDetail(d);
      }));
    },
  });
}

const accChips = (id, sel) => `<div class="chips" id="${id}"><button type="button" class="chip ${!sel ? 'on' : ''}" data-id="">Tidak dari kas</button>${S.accounts.filter((a) => !a.archived).map((a) => `<button type="button" class="chip ${a.id === sel ? 'on' : ''}" data-id="${a.id}">${a.emoji || ''} ${esc(a.name)} <span class="faint small">${rpShort(accountBalance(a.id))}</span></button>`).join('')}</div>`;
const bindChips = (el, id) => $$(`#${id} .chip`, el).forEach((b) => (b.onclick = () => $$(`#${id} .chip`, el).forEach((x) => x.classList.toggle('on', x === b))));

function openDebtForm(d = null) {
  const x = d ? { ...d } : { creditor: '', name: '', amount: 0, startDate: today(), installment: 0, dueDay: '', tenor: '', remind: true, note: '' };
  const creditors = [...new Set(V.debts.map((y) => y.creditor).filter(Boolean))];
  openSheet({
    title: d ? 'Ubah Hutang' : 'Catat Hutang', full: true,
    body: `<div class="field"><label>Asal hutang (pemberi pinjaman)</label><input class="inp" id="d-cred" list="d-creds" value="${esc(x.creditor)}" placeholder="mis. Bank BRI, Koperasi, Pak Budi"><datalist id="d-creds">${creditors.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        ${creditors.length ? `<div class="chips" style="margin-top:8px">${creditors.map((c) => `<button type="button" class="chip" data-cr="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}</div>
      <div class="field"><label>Keterangan</label><input class="inp" id="d-name" value="${esc(x.name)}" placeholder="mis. KUR renovasi rumah"></div>
      <div class="field"><label>Jumlah hutang (pokok)</label><div class="money-wrap big"><input class="inp big" id="d-amt" inputmode="numeric" data-money value="${x.amount || ''}"></div></div>
      <div class="grid2"><div class="field"><label>Cicilan per bulan</label><div class="money-wrap"><input class="inp" id="d-inst" inputmode="numeric" data-money value="${x.installment || ''}"></div></div>
        <div class="field"><label>Tgl jatuh tempo (1–28)</label><input class="inp" id="d-due" type="number" min="1" max="28" value="${x.dueDay || ''}"></div></div>
      <div class="grid2"><div class="field"><label>Tanggal mulai</label><input class="inp" type="date" id="d-start" value="${x.startDate}"></div><div class="field"><label>Tenor (bulan, opsional)</label><input class="inp" id="d-tenor" type="number" min="1" value="${x.tenor || ''}"></div></div>
      <div class="set-row"><div class="main"><div class="t1">Pengingat jatuh tempo</div><div class="t2">Notifikasi diskret tanpa menyebut “hutang”</div></div><label class="switch"><input type="checkbox" id="d-rem" ${x.remind ? 'checked' : ''}><span></span></label></div>
      ${!d ? `<div class="field" style="margin-top:12px"><label>Dana pinjaman masuk ke kas? (opsional)</label>${accChips('d-acc', null)}</div>` : ''}
      <div class="field"><label>Catatan</label><textarea class="inp" id="d-note">${esc(x.note)}</textarea></div>
      <div class="sheet-actions"><button class="btn primary block" id="d-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindMoney(el); if (!d) bindChips(el, 'd-acc');
      $$('[data-cr]', el).forEach((b) => (b.onclick = () => ($('#d-cred', el).value = b.dataset.cr)));
      $('#d-save', el).onclick = async () => {
        const creditor = $('#d-cred', el).value.trim(), amount = moneyVal($('#d-amt', el));
        if (!creditor || amount <= 0) return toast('Asal dan jumlah hutang wajib diisi', 'bad');
        const data = { creditor, name: $('#d-name', el).value.trim(), amount, installment: moneyVal($('#d-inst', el)), dueDay: Math.min(28, Math.max(0, Number($('#d-due', el).value) || 0)) || '', startDate: $('#d-start', el).value || today(), tenor: Number($('#d-tenor', el).value) || '', remind: $('#d-rem', el).checked, note: $('#d-note', el).value.trim() };
        if (d) Object.assign(d, data);
        else {
          const nd = { id: uid(), ...data, createdAt: today() };
          const accId = $('#d-acc .chip.on', el)?.dataset.id;
          if (accId) { const tx = { id: uid(), type: 'income', amount, accountId: accId, categoryId: sysCat('income', 'debt').id, date: data.startDate, time: nowHM(), note: '', createdAt: new Date().toISOString() }; S.transactions.push(tx); nd.txId = tx.id; }
          V.debts.push(nd);
        }
        await persistVault(); close(); toast('Hutang disimpan', 'good');
      };
    },
  });
}

function openPayForm(d) {
  openSheet({
    title: 'Bayar: ' + (d.name || d.creditor),
    body: `<div class="muted small" style="margin-bottom:10px">Sisa hutang ${rp(remaining(d))}</div>
      <div class="field"><label>Jumlah bayar</label><div class="money-wrap big"><input class="inp big" id="p-amt" inputmode="numeric" data-money value="${Math.min(d.installment || remaining(d), remaining(d))}"></div>
        <div class="chips" style="margin-top:8px">${d.installment ? `<button type="button" class="chip" data-v="${Math.min(d.installment, remaining(d))}">Cicilan</button>` : ''}<button type="button" class="chip" data-v="${remaining(d)}">Lunasi semua</button></div></div>
      <div class="field"><label>Tanggal</label><input class="inp" type="date" id="p-date" value="${today()}"></div>
      <div class="field"><label>Bayar dari kas</label>${accChips('p-acc', S.accounts.find((a) => !a.archived)?.id)}<p class="hint">Jika dari kas, saldo berkurang dan tercatat sebagai “Pembayaran Cicilan” tanpa detail.</p></div>
      <div class="field"><label>Catatan (rahasia)</label><input class="inp" id="p-note"></div>
      <div class="sheet-actions"><button class="btn primary block" id="p-save">${icon('check', 18)} Simpan Pembayaran</button></div>`,
    onMount: (el, close) => {
      bindMoney(el); bindChips(el, 'p-acc');
      $$('[data-v]', el).forEach((b) => (b.onclick = () => { $('#p-amt', el).value = Number(b.dataset.v).toLocaleString('id-ID'); }));
      $('#p-save', el).onclick = async () => {
        const amount = moneyVal($('#p-amt', el));
        if (amount <= 0) return toast('Jumlah tidak valid', 'bad');
        if (amount > remaining(d)) return toast('Melebihi sisa hutang', 'bad');
        const date = $('#p-date', el).value || today();
        const accId = $('#p-acc .chip.on', el)?.dataset.id;
        const p = { id: uid(), debtId: d.id, amount, date, note: $('#p-note', el).value.trim() };
        if (accId) { const tx = { id: uid(), type: 'expense', amount, accountId: accId, categoryId: sysCat('expense', 'debt').id, date, time: nowHM(), note: '', createdAt: new Date().toISOString() }; S.transactions.push(tx); p.txId = tx.id; }
        V.payments.push(p);
        await persistVault(); close();
        if (remaining(d) <= 0) { confetti(); toast('Alhamdulillah, hutang LUNAS! 🎉', 'good'); } else toast('Pembayaran dicatat', 'good');
      };
    },
  });
}

function vaultSettings() {
  openSheet({
    title: 'Pengaturan Brankas',
    body: `<div class="choice-list"><button class="choice" data-a="pin">${icon('lock', 20)} Ganti PIN</button><button class="choice" data-a="sc">${icon('eye', 20)} ${S.settings.vaultShortcut ? 'Sembunyikan' : 'Tampilkan'} pintasan Brankas di tab Keuangan</button>
      <button class="choice danger" data-a="reset">${icon('trash', 20)} Hapus semua data brankas</button></div>
      <p class="hint">Cara rahasia membuka brankas: tekan lama (±1 detik) judul “Keuangan” di bagian atas layar Keuangan.</p>`,
    onMount: (el, close) => {
      $('[data-a="sc"]', el).onclick = () => { S.settings.vaultShortcut = !S.settings.vaultShortcut; save(); close(); };
      $('[data-a="pin"]', el).onclick = () => { close(); pinPad({ title: 'PIN Baru', subtitle: 'Masukkan PIN 6 digit baru', onSubmit: async (v, c) => { PIN = v; S.vaultPinHash = await sha256('afnan-vault:' + v); await persistVault(); c(); toast('PIN diganti', 'good'); return true; } }); };
      $('[data-a="reset"]', el).onclick = async () => {
        close();
        if (!(await confirmBox('Semua data hutang & pembayaran akan dihapus permanen. Lanjutkan?', { ok: 'Hapus permanen', danger: true }))) return;
        S.vault = null; S.vaultPinHash = null; S.vaultReminders = []; lockVault(); save(); location.hash = '#/finance';
      };
    },
  });
}

// Lupa PIN — dipanggil dari Pengaturan
export async function resetVaultForgot() {
  if (!(await confirmBox('Lupa PIN? Data brankas terenkripsi tidak bisa dipulihkan tanpa PIN. Hapus data brankas dan buat PIN baru?', { ok: 'Hapus & reset', danger: true }))) return;
  S.vault = null; S.vaultPinHash = null; S.vaultReminders = []; lockVault(); save(); toast('Brankas direset');
}
