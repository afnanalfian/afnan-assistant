// ===== Modul Keuangan: transaksi, kas, anggaran (ranggar), goals, kategori =====
import { S, save, cat, acc, goal, sysCat, accountBalance, totalCash, goalSaved, totalGoals, monthTotals, spentByCat, txInMonth } from '../state.js';
import { icon } from '../icons.js';
import { esc, uid, today, nowHM, monthKey, monthOf, addMonths, monthLabel, daysInMonth, parseYmd, fmtDate, relDay, rp, rpShort, num, pct, sum, groupBy, pad, diffDays } from '../utils.js';
import { openSheet, $, $$, bindSeg, seg, toast, confirmBox, choose, empty, bindMoney, moneyVal, hydrate, slotCard, photoPicker, pickFile, confetti, forgetImg } from '../ui.js';
import { blobSet, blobDel } from '../db.js';
import { compressImage } from '../utils.js';
import { donut, bars, hbars, ring, PALETTE, OTHER } from '../charts.js';

let mk = monthKey();
let txFilter = { q: '', type: 'all' };
const TABS = [['sum', 'Ringkasan'], ['tx', 'Transaksi'], ['budget', 'Anggaran'], ['goals', 'Goals'], ['acc', 'Kas'], ['cat', 'Kategori']];
const ACC_TYPES = { cash: 'Tunai', bank: 'Bank', ewallet: 'E-Wallet', other: 'Lainnya' };
const rerender = () => window.dispatchEvent(new Event('rerender'));
const H = (v) => `<span class="amt-h">${v}</span>`;

const monthNav = () => `<div class="period-nav"><button class="icon-btn" data-mnav="-1">${icon('left')}</button>
  <div class="pl">${monthLabel(mk)}<small>${mk === monthKey() ? 'Bulan berjalan' : ''}</small></div>
  <button class="icon-btn" data-mnav="1">${icon('right')}</button></div>`;

export function render(params) {
  const t = params.t || 'sum';
  if (params.m) mk = params.m;
  let body = '';
  if (t === 'sum') body = summary();
  else if (t === 'tx') body = txList();
  else if (t === 'budget') body = budgetView();
  else if (t === 'goals') body = goalsView();
  else if (t === 'acc') body = accountsView();
  else if (t === 'cat') body = categoriesView();
  const html = `<div class="tabs">${TABS.map(([k, l]) => `<a href="#/finance?t=${k}" class="${k === t ? 'on' : ''}">${l}</a>`).join('')}${S.settings.vaultShortcut ? `<a href="#/vault">${icon('lock', 14)} Brankas</a>` : ''}</div>${body}`;
  return {
    title: 'Keuangan', sub: '', html,
    titleLongPress: () => { location.hash = '#/vault'; },
    fab: t === 'goals' ? () => openGoalForm() : t === 'acc' ? () => openAccountForm() : t === 'cat' ? () => openCategoryForm() : t === 'budget' ? () => openBudgetForm() : () => openTxForm({}),
    mount(el) {
      $$('[data-mnav]', el).forEach((b) => (b.onclick = () => { mk = addMonths(mk, +b.dataset.mnav); rerender(); }));
      bindTxRows(el);
      // transaksi: cari & filter
      const q = $('#tx-q', el);
      if (q) { q.oninput = () => { txFilter.q = q.value; renderTxBody(el); }; }
      $$('[data-tf]', el).forEach((b) => (b.onclick = () => { txFilter.type = b.dataset.tf; rerender(); }));
      $$('[data-acc]', el).forEach((r) => (r.onclick = () => openAccountDetail(acc(r.dataset.acc))));
      $$('[data-cat]', el).forEach((r) => (r.onclick = () => openCategoryForm(cat(r.dataset.cat))));
      $$('[data-newcat]', el).forEach((b) => (b.onclick = () => openCategoryForm(null, b.dataset.newcat)));
      $$('[data-goal]', el).forEach((r) => (r.onclick = () => openGoalDetail(goal(r.dataset.goal))));
      $$('[data-goal-save]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openTxForm({ type: 'expense', categoryId: sysCat('expense', 'goal').id, goalId: b.dataset.goalSave }); }));
      $('#btn-budget', el)?.addEventListener('click', () => openBudgetForm());
      $('#btn-transfer', el)?.addEventListener('click', () => openTxForm({ type: 'transfer' }));
      $('#btn-csv', el)?.addEventListener('click', () => import('./settings.js').then((m) => m.exportCSV()));
      $$('[data-budget-cat]', el).forEach((r) => (r.onclick = () => { txFilter = { q: '', type: 'all', cat: r.dataset.budgetCat }; location.hash = '#/finance?t=tx'; }));
      hydrate(el);
    },
  };
}

// ================= RINGKASAN =================
function summary() {
  const T = monthTotals(mk), P = monthTotals(addMonths(mk, -1));
  const cash = totalCash(), saved = totalGoals();
  const accs = S.accounts.filter((a) => !a.archived).map((a, i) => ({ a, b: accountBalance(a.id) }));
  const accDonut = accs.filter((x) => x.b > 0).map((x, i) => ({ label: x.a.name, value: x.b, color: PALETTE[i % PALETTE.length], tip: `${x.a.name}: ${rp(x.b)}` }));
  const byCat = spentByCat(mk);
  const expCats = Object.entries(byCat).map(([id, v]) => ({ c: cat(id), v })).filter((x) => x.c && !x.c.system).sort((a, b) => b.v - a.v);
  const top = expCats.slice(0, 6), rest = expCats.slice(6);
  const expDonut = top.map((x, i) => ({ label: x.c.name, value: x.v, color: PALETTE[i], tip: `${x.c.name}: ${rp(x.v)} (${pct(x.v, T.expense)}%)` }));
  if (rest.length) expDonut.push({ label: 'Lainnya', value: sum(rest, (x) => x.v), color: OTHER, tip: `Lainnya: ${rp(sum(rest, (x) => x.v))}` });
  const incByCat = {};
  for (const t of txInMonth(mk)) if (t.type === 'income' && !cat(t.categoryId)?.system) incByCat[t.categoryId] = (incByCat[t.categoryId] || 0) + t.amount;
  const incList = Object.entries(incByCat).map(([id, v]) => ({ c: cat(id), v })).filter((x) => x.c).sort((a, b) => b.v - a.v);
  // pengeluaran harian
  const nd = daysInMonth(mk);
  const daily = Array(nd).fill(0);
  for (const t of txInMonth(mk)) if (t.type === 'expense' && !cat(t.categoryId)?.system) daily[parseYmd(t.date).getDate() - 1] += t.amount;
  const dayCount = mk === monthKey() ? new Date().getDate() : nd;
  const avgDaily = T.expense / Math.max(1, dayCount);
  const pAvg = P.expense / daysInMonth(addMonths(mk, -1));
  const chg = pAvg && T.expense ? Math.round(((avgDaily - pAvg) / pAvg) * 100) : null;
  const budget = S.budgets[mk] || {};
  const bTotal = sum(Object.values(budget));
  const bUsed = sum(Object.keys(budget), (id) => byCat[id] || 0);
  const active = S.goals.filter((g) => !g.completedAt);

  return `${monthNav()}
  <div class="hero" id="fin-hero">
    <button class="icon-btn eye" data-eye>${icon(S.settings.hideAmounts ? 'eyeOff' : 'eye', 20)}</button>
    <div class="h-sm">Total saldo kas</div><div class="h-big">${H(rp(cash))}</div>
    <div class="h-row"><div class="h-chip"><span>Pemasukan</span><b>${H(rpShort(T.income))}</b></div><div class="h-chip"><span>Pengeluaran</span><b>${H(rpShort(T.expense))}</b></div><div class="h-chip"><span>Ditabung</span><b>${H(rpShort(T.saving))}</b></div></div>
  </div>
  <div class="grid2" style="margin-bottom:12px">
    <div class="stat"><div class="s-l">Arus bersih</div><div class="s-v ${T.net >= 0 ? 'inc' : 'exp'}">${H(rp(T.net, { sign: true }))}</div><div class="s-s">${monthLabel(mk, true)}</div></div>
    <div class="stat"><div class="s-l">Rata-rata harian</div><div class="s-v">${H(rpShort(avgDaily))}</div><div class="s-s">${chg == null ? 'pengeluaran' : `${chg > 0 ? '▲' : '▼'} ${Math.abs(chg)}% vs bulan lalu`}</div></div>
    <div class="stat"><div class="s-l">Tabungan goals</div><div class="s-v">${H(rpShort(saved))}</div><div class="s-s">${active.length} goal aktif</div></div>
    <div class="stat"><div class="s-l">Anggaran terpakai</div><div class="s-v ${bTotal && bUsed > bTotal ? 'exp' : ''}">${bTotal ? pct(bUsed, bTotal) + '%' : '–'}</div><div class="s-s">${bTotal ? `${rpShort(bUsed)} / ${rpShort(bTotal)}` : 'belum diatur'}</div></div>
  </div>
  <div class="grid-md-2">
  <div class="card"><div class="card-h"><h3>Distribusi Kas</h3><a class="link" href="#/finance?t=acc">Kelola</a></div>
    ${accDonut.length ? `<div class="donut-row">${donut(accDonut, { size: 140, thickness: 18, top: rpShort(cash), sub: 'total' })}
      <div class="donut-leg">${accs.map((x, i) => `<div class="dl"><i class="dot" style="background:${x.b > 0 ? PALETTE[accDonut.findIndex((d) => d.label === x.a.name) % PALETTE.length] : 'var(--line)'}"></i><span>${esc(x.a.emoji || '')} ${esc(x.a.name)}</span><b class="${x.b < 0 ? 'exp' : ''}">${H(rpShort(x.b))}</b></div>`).join('')}</div></div>`
      : empty('wallet', 'Saldo kas masih kosong', 'Atur saldo awal di tab Kas.')}</div>
  <div class="card"><div class="card-h"><h3>Karakteristik Pengeluaran</h3><span class="pill">${monthLabel(mk, true)}</span></div>
    ${expDonut.length ? `<div class="donut-row">${donut(expDonut, { size: 140, thickness: 18, top: rpShort(T.expense), sub: 'keluar' })}
      <div class="donut-leg">${expDonut.map((d) => `<div class="dl"><i class="dot" style="background:${d.color}"></i><span>${esc(d.label)}</span><b>${pct(d.value, T.expense)}%</b></div>`).join('')}</div></div>`
      : empty('pie', 'Belum ada pengeluaran bulan ini')}</div>
  </div>
  <div class="card"><div class="card-h"><h3>Pengeluaran Harian</h3><span class="pill">rata-rata ${rpShort(avgDaily)}</span></div>
    ${bars({ labels: daily.map((_, i) => String(i + 1)), series: [{ name: 'Pengeluaran', color: '#eb6834', values: daily }], height: 150 })}</div>
  <div class="card"><div class="card-h"><h3>Sumber Pemasukan</h3><span class="pill good">${rpShort(T.income)}</span></div>
    ${incList.length ? hbars(incList.map((x, i) => ({ label: x.c.name, emoji: x.c.emoji, value: x.v, color: PALETTE[i % PALETTE.length], right: rp(x.v) + ` · ${pct(x.v, T.income)}%` }))) : empty('arrowDown', 'Belum ada pemasukan bulan ini')}</div>
  ${active.length ? `<div class="card"><div class="card-h"><h3>Progres Goals</h3><a class="link" href="#/finance?t=goals">Lihat</a></div>${hbars(active.slice(0, 4).map((g) => { const s = goalSaved(g.id); return { label: g.name, emoji: g.emoji, value: s, max: g.target, color: 'var(--accent)', right: `${pct(s, g.target)}%`, sub: `${rp(s)} dari ${rp(g.target)}` }; }))}</div>` : ''}
  <div class="card"><div class="card-h"><h3>Transaksi Terakhir</h3><a class="link" href="#/finance?t=tx">Semua</a></div>
    ${recentTx(6)}</div>`;
}

export function recentTx(n = 5) {
  const list = [...S.transactions].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, n);
  return list.length ? `<div class="list">${list.map((t) => txRow(t, true)).join('')}</div>` : empty('wallet', 'Belum ada transaksi', 'Ketuk + untuk mencatat pemasukan atau pengeluaran.');
}

// ================= TRANSAKSI =================
export function txRow(t, showDate = false) {
  const c = cat(t.categoryId), a = acc(t.accountId), b = acc(t.toAccountId), g = goal(t.goalId);
  let title, sub, amt, cls, emo, bg;
  if (t.type === 'transfer') { title = `Transfer ke ${b?.name || '?'}`; sub = `${a?.name || '?'} → ${b?.name || '?'}`; amt = rp(t.amount); cls = ''; emo = '🔁'; bg = 'var(--card2)'; }
  else if (t.type === 'adjust') { title = 'Penyesuaian saldo'; sub = a?.name || ''; amt = rp(t.amount, { sign: true }); cls = t.amount >= 0 ? 'inc' : 'exp'; emo = '⚖️'; bg = 'var(--card2)'; }
  else {
    title = c?.system === 'goal' ? `${t.type === 'expense' ? 'Tabung' : 'Tarik'}: ${g?.name || 'Goal'}` : c?.system === 'debt' ? c.name : (t.note || c?.name || '—');
    sub = [c?.system ? '' : c?.name, a?.name].filter(Boolean).join(' · ');
    amt = (t.type === 'income' ? '+' : '-') + rp(t.amount); cls = t.type === 'income' ? 'inc' : 'exp'; emo = c?.emoji || '•'; bg = (c?.color || '#888') + '1f';
  }
  return `<div class="li tap" data-tx="${t.id}"><div class="ava" style="background:${bg}">${emo}</div>
    <div class="main"><div class="t1">${esc(title)}</div><div class="t2">${showDate ? relDay(t.date) + ' · ' : ''}${t.time || ''}${sub ? ' · ' + esc(sub) : ''}</div></div>
    <div class="end">${t.receipt ? `<span class="faint">${icon('image', 15)}</span> ` : ''}<span class="amt ${cls}">${amt}</span></div></div>`;
}

function filteredTx() {
  const q = txFilter.q.trim().toLowerCase();
  return txInMonth(mk).filter((t) => {
    if (txFilter.type !== 'all' && t.type !== txFilter.type) return false;
    if (txFilter.cat && t.categoryId !== txFilter.cat) return false;
    if (q) { const c = cat(t.categoryId), a = acc(t.accountId); const hay = [t.note, c?.name, a?.name, goal(t.goalId)?.name, String(t.amount)].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  }).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
function txBodyHtml() {
  const list = filteredTx();
  if (!list.length) return empty('search', 'Tidak ada transaksi', txFilter.q || txFilter.type !== 'all' || txFilter.cat ? 'Coba ubah pencarian/filter.' : 'Belum ada transaksi di bulan ini.');
  const g = groupBy(list, (t) => t.date);
  return Object.keys(g).sort().reverse().map((d) => {
    const inc = sum(g[d].filter((t) => t.type === 'income'), (t) => t.amount), exp = sum(g[d].filter((t) => t.type === 'expense'), (t) => t.amount);
    return `<div class="day-h"><span>${relDay(d)}</span><span>${inc ? `<span class="inc">+${rpShort(inc)}</span> ` : ''}${exp ? `<span class="exp">-${rpShort(exp)}</span>` : ''}</span></div>${g[d].map((t) => txRow(t)).join('')}`;
  }).join('');
}
function renderTxBody(el) { const b = $('#tx-body', el); b.innerHTML = txBodyHtml(); bindTxRows(b); }
function txList() {
  const T = monthTotals(mk);
  const cf = txFilter.cat ? cat(txFilter.cat) : null;
  return `${monthNav()}
    <div class="grid3" style="margin-bottom:12px"><div class="stat"><div class="s-l">Masuk</div><div class="s-v inc" style="font-size:15px">${rpShort(T.incomeAll)}</div></div>
      <div class="stat"><div class="s-l">Keluar</div><div class="s-v exp" style="font-size:15px">${rpShort(T.expenseAll)}</div></div>
      <div class="stat"><div class="s-l">Selisih</div><div class="s-v" style="font-size:15px">${rpShort(T.net)}</div></div></div>
    <div class="search">${icon('search', 18)}<input id="tx-q" placeholder="Cari keterangan, kategori, nominal…" value="${esc(txFilter.q)}"></div>
    <div class="chips" style="margin-bottom:10px">${[['all', 'Semua'], ['expense', 'Pengeluaran'], ['income', 'Pemasukan'], ['transfer', 'Transfer']].map(([v, l]) => `<button class="chip ${txFilter.type === v ? 'on' : ''}" data-tf="${v}">${l}</button>`).join('')}
      ${cf ? `<button class="chip on" data-clearcat>${cf.emoji} ${esc(cf.name)} ✕</button>` : ''}
      <button class="chip" id="btn-csv">${icon('download', 15)} CSV</button></div>
    <div class="card" style="padding-top:4px"><div class="list" id="tx-body">${txBodyHtml()}</div></div>`;
}
function bindTxRows(el) {
  $$('[data-tx]', el).forEach((r) => (r.onclick = () => openTxDetail(S.transactions.find((t) => t.id === r.dataset.tx))));
  $('[data-clearcat]', el)?.addEventListener('click', () => { delete txFilter.cat; rerender(); });
  $('[data-eye]', el)?.addEventListener('click', () => { S.settings.hideAmounts = !S.settings.hideAmounts; document.body.classList.toggle('blur-amt', S.settings.hideAmounts); save(); });
}

function openTxDetail(t) {
  if (!t) return;
  const c = cat(t.categoryId), a = acc(t.accountId), b = acc(t.toAccountId), g = goal(t.goalId);
  const typeL = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer', adjust: 'Penyesuaian' }[t.type];
  openSheet({
    title: 'Detail Transaksi',
    body: `<div class="center" style="margin:4px 0 14px"><div class="pill">${typeL}</div>
        <div style="font-size:30px;font-weight:800;margin-top:6px" class="${t.type === 'income' ? 'inc' : t.type === 'expense' ? 'exp' : ''}">${rp(t.amount)}</div>
        <div class="muted">${fmtDate(t.date, { day: true, long: true })} · ${t.time || ''}</div></div>
      <div class="list">
        ${c ? `<div class="li"><div class="ava">${c.emoji}</div><div class="main"><div class="t2">Kategori</div><div class="t1">${esc(c.name)}${g ? ' → ' + esc(g.name) : ''}</div></div></div>` : ''}
        ${a ? `<div class="li"><div class="ava">${a.emoji || '🏦'}</div><div class="main"><div class="t2">${t.type === 'transfer' ? 'Dari' : 'Kas'}</div><div class="t1">${esc(a.name)}</div></div></div>` : ''}
        ${b ? `<div class="li"><div class="ava">${b.emoji || '🏦'}</div><div class="main"><div class="t2">Ke</div><div class="t1">${esc(b.name)}${t.fee ? ` · biaya ${rp(t.fee)}` : ''}</div></div></div>` : ''}
        ${t.note ? `<div class="li">${icon('file')}<div class="main"><div class="t2">Keterangan</div><div class="t1" style="white-space:pre-wrap">${esc(t.note)}</div></div></div>` : ''}
      </div>
      ${t.receipt ? `<div class="field" style="margin-top:10px"><label>Foto bukti</label><img class="receipt-prev" data-img="${t.receipt}" alt="Bukti"></div>` : ''}
      <div class="sheet-actions"><button class="btn ghost" data-a="del">${icon('trash', 18)}</button>
        ${t.type !== 'adjust' ? `<button class="btn ghost grow" data-a="dup">${icon('copy', 18)} Duplikat</button><button class="btn primary grow" data-a="edit">${icon('edit', 18)} Ubah</button>` : ''}</div>`,
    onMount: (el, close) => {
      hydrate(el);
      $('[data-a="edit"]', el)?.addEventListener('click', () => { close(); openTxForm({ tx: t }); });
      $('[data-a="dup"]', el)?.addEventListener('click', () => { close(); openTxForm({ ...t, tx: null, receipt: null, date: today(), time: nowHM() }); });
      $('[data-a="del"]', el).onclick = async () => {
        if (!(await confirmBox('Hapus transaksi ini? Saldo kas akan disesuaikan.', { ok: 'Hapus', danger: true }))) return;
        S.transactions = S.transactions.filter((x) => x !== t);
        if (t.receipt) { blobDel(t.receipt); forgetImg(t.receipt); }
        save(); close(); toast('Transaksi dihapus');
      };
    },
  });
}

// ---------- Form transaksi ----------
export function openTxForm(o = {}) {
  const t = o.tx;
  let type = t?.type || o.type || 'expense';
  let state = {
    amount: t?.amount || o.amount || 0, categoryId: t?.categoryId || o.categoryId || null, goalId: t?.goalId || o.goalId || null,
    accountId: t?.accountId || o.accountId || S.accounts.find((a) => !a.archived)?.id, toAccountId: t?.toAccountId || o.toAccountId || null,
    fee: t?.fee || 0, date: t?.date || o.date || today(), time: t?.time || o.time || nowHM(), note: t?.note ?? o.note ?? '', receipt: t?.receipt || null, newReceipt: null,
  };
  const accs = S.accounts.filter((a) => !a.archived || a.id === state.accountId);
  openSheet({
    title: t ? 'Ubah Transaksi' : 'Catat Transaksi', full: true,
    body: `<div id="txf-type">${seg('type', [['expense', 'Pengeluaran'], ['income', 'Pemasukan'], ['transfer', 'Transfer']], type).replace('class="seg"', 'class="seg type"')}</div>
      <div id="txf-slot" style="margin-top:12px"></div>
      <div class="field"><label>Nominal</label><div class="money-wrap big"><input class="inp big" id="txf-amt" inputmode="numeric" data-money value="${state.amount || ''}" placeholder="0"></div>
        <div class="chips" style="margin-top:8px" id="txf-quick">${[10000, 20000, 50000, 100000, 500000].map((v) => `<button type="button" class="chip" data-q="${v}">+${rpShort(v)}</button>`).join('')}</div></div>
      <div id="txf-budget"></div>
      <div class="field" id="txf-cat-w"><label>Kategori</label><div class="chips" id="txf-cat"></div></div>
      <div class="field" id="txf-goal-w" style="display:none"><label>Pilih goal (sub-kategori)</label><div class="chips" id="txf-goal"></div></div>
      <div class="field"><label id="txf-acc-l">Kas</label><div class="chips" id="txf-acc">${accs.map((a) => `<button type="button" class="chip ${a.id === state.accountId ? 'on' : ''}" data-id="${a.id}">${a.emoji || ''} ${esc(a.name)} <span class="faint small">${rpShort(accountBalance(a.id))}</span></button>`).join('')}</div></div>
      <div class="field" id="txf-to-w" style="display:none"><label>Ke kas</label><div class="chips" id="txf-to">${accs.map((a) => `<button type="button" class="chip ${a.id === state.toAccountId ? 'on' : ''}" data-id="${a.id}">${a.emoji || ''} ${esc(a.name)}</button>`).join('')}</div>
        <div class="field" style="margin-top:10px"><label>Biaya admin (opsional)</label><div class="money-wrap"><input class="inp" id="txf-fee" inputmode="numeric" data-money value="${state.fee || ''}"></div></div></div>
      <div class="grid2"><div class="field"><label>Tanggal</label><input class="inp" type="date" id="txf-date" value="${state.date}"></div><div class="field"><label>Jam</label><input class="inp" type="time" id="txf-time" value="${state.time}"></div></div>
      <div class="field"><label>Keterangan</label><input class="inp" id="txf-note" value="${esc(state.note)}" placeholder="mis. Makan siang di warung"></div>
      <div class="field"><label>Foto bukti (opsional)</label><div id="txf-rc"></div></div>
      <div class="sheet-actions"><button class="btn primary block" id="txf-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindMoney(el);
      const amtIn = $('#txf-amt', el);
      const paintSlot = () => {
        const c = cat(state.categoryId);
        let html = '';
        if (type === 'expense' && c?.photoId && !c.system) html = `<div class="slot-card bad ph-hide-empty"><img data-img="ph:${c.photoId}" alt=""><div class="slot-cap">${esc(c.photoCaption || S.settings.photoSlots.expense.caption)}</div></div>`;
        else if (type === 'expense') html = slotCard('expense', 'bad');
        else if (type === 'income') html = slotCard('income', 'good');
        $('#txf-slot', el).innerHTML = html; hydrate($('#txf-slot', el));
      };
      const paintBudget = () => {
        const box = $('#txf-budget', el); box.innerHTML = '';
        $('#txf-slot', el).style.display = '';
        if (type !== 'expense' || !state.categoryId) return;
        const m = monthOf($('#txf-date', el).value || today());
        const b = S.budgets[m]?.[state.categoryId];
        if (!b) return;
        const spent = sum(S.transactions.filter((x) => x !== t && x.type === 'expense' && x.categoryId === state.categoryId && monthOf(x.date) === m), (x) => x.amount);
        const after = spent + moneyVal(amtIn), left = b - after, p = pct(after, b);
        const bad = after > b, warn = !bad && p >= 80;
        const sl = S.settings.photoSlots.budget;
        if ((bad || warn) && sl.photoId) $('#txf-slot', el).style.display = 'none';
        box.innerHTML = `${(bad || warn) && sl.photoId ? `<div class="slot-card bad ph-hide-empty"><img data-img="ph:${sl.photoId}" alt=""><div class="slot-cap">${esc(sl.caption)}</div></div>` : ''}
          <div class="warn-box" style="${bad ? 'background:var(--bad-soft)' : !warn ? 'background:var(--good-soft)' : ''}">${icon(bad ? 'alert' : 'pie', 18)}<div style="flex:1">
            <b>${bad ? 'Melebihi anggaran!' : warn ? 'Anggaran hampir habis' : 'Sisa anggaran aman'}</b> — ${esc(cat(state.categoryId).name)} ${p}% terpakai.
            <div class="small muted">${bad ? `Lebih ${rp(-left)} dari anggaran ${rp(b)}` : `Sisa ${rp(left)} dari ${rp(b)}`}</div>
            <div class="prog" style="margin-top:6px"><div style="width:${Math.min(100, p)}%;background:${bad ? 'var(--exp)' : warn ? 'var(--warn)' : 'var(--accent)'}"></div></div></div></div>`;
        hydrate(box);
      };
      const paintCats = () => {
        const kind = type === 'income' ? 'income' : 'expense';
        const list = S.categories.filter((c) => c.kind === kind && !c.archived && (c.system !== 'debt'));
        if (!list.some((c) => c.id === state.categoryId)) state.categoryId = null;
        $('#txf-cat', el).innerHTML = list.map((c) => `<button type="button" class="chip ${c.id === state.categoryId ? 'on' : ''}" data-id="${c.id}"><span class="em">${c.emoji}</span>${esc(c.name)}</button>`).join('');
        $$('#txf-cat .chip', el).forEach((b) => (b.onclick = () => { state.categoryId = b.dataset.id; paintCats(); paintSlot(); paintBudget(); }));
        const c = cat(state.categoryId);
        const gw = $('#txf-goal-w', el);
        if (c?.system === 'goal') {
          const goals = S.goals.filter((g) => !g.completedAt || g.id === state.goalId || (type === 'income' && goalSaved(g.id) > 0));
          gw.style.display = '';
          $('#txf-goal', el).innerHTML = goals.length ? goals.map((g) => `<button type="button" class="chip ${g.id === state.goalId ? 'on' : ''}" data-id="${g.id}">${g.emoji} ${esc(g.name)} <span class="faint small">${pct(goalSaved(g.id), g.target)}%</span></button>`).join('') : '<span class="muted small">Belum ada goal aktif — buat di tab Goals.</span>';
          $$('#txf-goal .chip', el).forEach((b) => (b.onclick = () => { state.goalId = b.dataset.id; paintCats(); }));
        } else { gw.style.display = 'none'; state.goalId = null; }
      };
      const paintType = () => {
        $('#txf-cat-w', el).style.display = type === 'transfer' ? 'none' : '';
        $('#txf-to-w', el).style.display = type === 'transfer' ? '' : 'none';
        $('#txf-acc-l', el).textContent = type === 'transfer' ? 'Dari kas' : type === 'income' ? 'Masuk ke kas' : 'Bayar dari kas';
        paintCats(); paintSlot(); paintBudget();
      };
      const paintRc = () => {
        const k = state.newReceipt || state.receipt;
        const w = $('#txf-rc', el);
        w.innerHTML = k ? `<img class="receipt-prev" id="rc-img" ${state.newReceipt ? `src="${state.newReceipt}"` : `data-img="${k}"`}><div class="row gap" style="margin-top:8px"><button type="button" class="btn sm ghost" id="rc-del">${icon('trash', 15)} Hapus foto</button></div>`
          : `<div class="row gap"><button type="button" class="btn ghost grow" id="rc-cam">${icon('camera', 18)} Kamera</button><button type="button" class="btn ghost grow" id="rc-gal">${icon('image', 18)} Galeri</button></div>`;
        if (!state.newReceipt) hydrate(w);
        const add = async (cap) => { const f = await pickFile('image/*', cap); if (!f) return; state.newReceipt = await compressImage(f, 1280, 0.72); paintRc(); };
        $('#rc-cam', w)?.addEventListener('click', () => add(true));
        $('#rc-gal', w)?.addEventListener('click', () => add(false));
        $('#rc-del', w)?.addEventListener('click', () => { state.newReceipt = null; state.receipt = null; paintRc(); });
      };
      bindSeg($('#txf-type', el), (v) => { type = v; paintType(); });
      $$('#txf-acc .chip', el).forEach((b) => (b.onclick = () => { state.accountId = b.dataset.id; $$('#txf-acc .chip', el).forEach((x) => x.classList.toggle('on', x === b)); }));
      $$('#txf-to .chip', el).forEach((b) => (b.onclick = () => { state.toAccountId = b.dataset.id; $$('#txf-to .chip', el).forEach((x) => x.classList.toggle('on', x === b)); }));
      $$('#txf-quick .chip', el).forEach((b) => (b.onclick = () => { amtIn.value = num(moneyVal(amtIn) + +b.dataset.q); paintBudget(); }));
      amtIn.addEventListener('input', paintBudget);
      $('#txf-date', el).onchange = paintBudget;
      paintType(); paintRc();
      if (!t && !o.amount) setTimeout(() => amtIn.focus(), 300);

      $('#txf-save', el).onclick = async () => {
        const amount = moneyVal(amtIn);
        if (amount <= 0) return toast('Nominal harus lebih dari 0', 'bad');
        if (!state.accountId) return toast('Pilih kas', 'bad');
        if (type !== 'transfer' && !state.categoryId) return toast('Pilih kategori', 'bad');
        if (type === 'transfer' && (!state.toAccountId || state.toAccountId === state.accountId)) return toast('Pilih kas tujuan yang berbeda', 'bad');
        const c = cat(state.categoryId);
        if (type !== 'transfer' && c?.system === 'goal' && !state.goalId) return toast('Pilih goal', 'bad');
        if (type === 'income' && c?.system === 'goal' && amount > goalSaved(state.goalId) + (t?.goalId === state.goalId && t?.type === 'income' ? t.amount : 0)) return toast('Penarikan melebihi saldo goal', 'bad');
        let receipt = state.receipt;
        if (state.newReceipt) { receipt = 'rc:' + uid(); await blobSet(receipt, state.newReceipt); }
        if (t?.receipt && t.receipt !== receipt) { blobDel(t.receipt); forgetImg(t.receipt); }
        const data = {
          type, amount, accountId: state.accountId, toAccountId: type === 'transfer' ? state.toAccountId : null, fee: type === 'transfer' ? moneyVal($('#txf-fee', el)) : 0,
          categoryId: type === 'transfer' ? null : state.categoryId, goalId: c?.system === 'goal' ? state.goalId : null,
          date: $('#txf-date', el).value || today(), time: $('#txf-time', el).value || nowHM(), note: $('#txf-note', el).value.trim(), receipt,
        };
        const wasDone = data.goalId ? goal(data.goalId)?.completedAt : null;
        if (t) Object.assign(t, data); else S.transactions.push({ id: uid(), ...data, createdAt: new Date().toISOString() });
        checkGoals();
        save(); close();
        toast(t ? 'Transaksi diperbarui' : type === 'expense' ? 'Pengeluaran dicatat' : type === 'income' ? 'Pemasukan dicatat' : 'Transfer dicatat', 'good');
        if (data.goalId && !wasDone && goal(data.goalId)?.completedAt) celebrateGoal(goal(data.goalId));
      };
    },
  });
}

// ================= ANGGARAN (RANGGAR) =================
function budgetView() {
  const b = S.budgets[mk] || {};
  const spent = spentByCat(mk);
  const ids = Object.keys(b).filter((id) => cat(id));
  const total = sum(ids, (id) => b[id]), used = sum(ids, (id) => spent[id] || 0);
  const nd = daysInMonth(mk), dayNow = mk === monthKey() ? new Date().getDate() : mk < monthKey() ? nd : 0;
  const proj = dayNow ? (used / dayNow) * nd : 0;
  const unbudgeted = Object.entries(spent).filter(([id]) => !b[id] && cat(id)).map(([id, v]) => ({ c: cat(id), v }));
  const p = pct(used, total);
  const sl = S.settings.photoSlots.budget;
  const rows = ids.map((id) => ({ c: cat(id), b: b[id], s: spent[id] || 0 })).sort((x, y) => y.s / y.b - x.s / x.b);
  return `${monthNav()}
  ${!ids.length ? `<div class="card">${empty('pie', 'Belum ada rancangan anggaran', `Buat alokasi anggaran untuk ${monthLabel(mk)} agar realisasi pengeluaran bisa dipantau.`)}<button class="btn primary block" id="btn-budget">${icon('plus', 18)} Buat Anggaran</button></div>` : `
  ${p >= 80 && sl.photoId ? `<div class="slot-card bad ph-hide-empty"><img data-img="ph:${sl.photoId}" alt=""><div class="slot-cap">${esc(sl.caption)}</div></div>` : ''}
  <div class="card"><div class="score">${ring(p, { size: 86, color: p > 100 ? 'var(--exp)' : p >= 80 ? 'var(--warn)' : 'var(--accent)' })}
    <div class="grow"><div class="muted small">Realisasi anggaran</div><div style="font-size:19px;font-weight:800">${rp(used)}</div><div class="muted small">dari ${rp(total)} · sisa <b class="${total - used < 0 ? 'exp' : 'inc'}">${rp(total - used)}</b></div>
    ${dayNow && mk === monthKey() ? `<div class="small" style="margin-top:4px">📈 Proyeksi akhir bulan: <b class="${proj > total ? 'exp' : ''}">${rp(proj)}</b></div>` : ''}</div></div>
    <button class="btn ghost block sm" style="margin-top:12px" id="btn-budget">${icon('edit', 16)} Atur anggaran</button></div>
  <div class="card"><div class="card-h"><h3>Per Kategori</h3><span class="pill">${ids.length} pos</span></div>
    ${hbars(rows.map((r) => { const q = pct(r.s, r.b); return { label: r.c.name, emoji: r.c.emoji, value: r.s, max: r.b, color: q > 100 ? 'var(--exp)' : q >= 80 ? 'var(--warn)' : 'var(--accent)', right: `${q}%`, sub: `${rp(r.s)} / ${rp(r.b)} · ${r.b - r.s >= 0 ? 'sisa ' + rp(r.b - r.s) : '<b class="exp">lebih ' + rp(r.s - r.b) + '</b>'}` }; }))}
  </div>`}
  ${unbudgeted.length ? `<div class="card"><div class="card-h"><h3>Di luar anggaran</h3></div><div class="list">${unbudgeted.map((x) => `<div class="li"><div class="ava">${x.c.emoji}</div><div class="main"><div class="t1">${esc(x.c.name)}</div><div class="t2">Belum dialokasikan</div></div><div class="end amt exp">${rp(x.v)}</div></div>`).join('')}</div></div>` : ''}`;
}

function openBudgetForm() {
  const cur = { ...(S.budgets[mk] || {}) };
  const prevMk = addMonths(mk, -1), prev = S.budgets[prevMk] || {};
  const cats = S.categories.filter((c) => c.kind === 'expense' && !c.archived);
  const avg3 = (id) => Math.round(sum([1, 2, 3], (k) => spentByCat(addMonths(mk, -k))[id] || 0) / 3 / 1000) * 1000;
  openSheet({
    title: `Anggaran ${monthLabel(mk)}`, full: true,
    body: `<div class="row gap" style="margin-bottom:12px">${Object.keys(prev).length ? `<button class="btn sm ghost grow" id="bf-copy">${icon('copy', 15)} Salin ${monthLabel(prevMk, true)}</button>` : ''}<button class="btn sm ghost grow" id="bf-avg">${icon('chart', 15)} Isi rata-rata 3 bln</button></div>
      <div class="stat" style="margin-bottom:12px"><div class="s-l">Total anggaran</div><div class="s-v" id="bf-total">${rp(sum(Object.values(cur)))}</div></div>
      ${cats.map((c) => `<div class="field"><label>${c.emoji} ${esc(c.name)} <span class="faint">${avg3(c.id) ? '· rata-rata ' + rpShort(avg3(c.id)) : ''}</span></label><div class="money-wrap"><input class="inp" inputmode="numeric" data-money data-bc="${c.id}" value="${cur[c.id] || ''}" placeholder="0"></div></div>`).join('')}
      <div class="sheet-actions"><button class="btn primary block" id="bf-save">${icon('check', 18)} Simpan Anggaran</button></div>`,
    onMount: (el, close) => {
      bindMoney(el);
      const tot = () => ($('#bf-total', el).textContent = rp(sum($$('[data-bc]', el), (i) => moneyVal(i))));
      $$('[data-bc]', el).forEach((i) => i.addEventListener('input', tot));
      const fill = (f) => { $$('[data-bc]', el).forEach((i) => { const v = f(i.dataset.bc); i.value = v ? num(v) : ''; }); tot(); };
      $('#bf-copy', el)?.addEventListener('click', () => fill((id) => prev[id]));
      $('#bf-avg', el).onclick = () => fill(avg3);
      $('#bf-save', el).onclick = () => {
        const b = {}; $$('[data-bc]', el).forEach((i) => { const v = moneyVal(i); if (v > 0) b[i.dataset.bc] = v; });
        if (Object.keys(b).length) S.budgets[mk] = b; else delete S.budgets[mk];
        save(); close(); toast('Anggaran disimpan', 'good');
      };
    },
  });
}

// ================= GOALS =================
const MOTIV = [
  [100, '🎉 Alhamdulillah, target tercapai!'], [90, '🔥 Tinggal sedikit lagi, jangan kendor!'], [75, '💪 Sudah tiga perempat jalan!'],
  [50, '🚀 Setengah perjalanan, terus konsisten!'], [25, '🌱 Awal yang bagus, pertahankan!'], [1, '👣 Langkah pertama sudah diambil!'], [0, '✨ Mulai menabung hari ini, sedikit demi sedikit.'],
];
export const motivation = (p) => MOTIV.find(([t]) => p >= t)[1];

export function checkGoals() {
  for (const g of S.goals) {
    const s = goalSaved(g.id);
    if (!g.completedAt && s >= g.target) g.completedAt = today();
    else if (g.completedAt && s < g.target) g.completedAt = null;
  }
}

function celebrateGoal(g) {
  confetti();
  const sl = S.settings.photoSlots.goal;
  openSheet({
    title: 'Goal Tercapai! 🎉',
    body: `<div class="center">${g.photoId ? `<img data-img="ph:${g.photoId}" style="width:120px;height:120px;border-radius:24px;object-fit:cover">` : `<div style="font-size:64px">${g.emoji}</div>`}
      <h2 style="margin:10px 0 4px">${esc(g.name)}</h2><div class="muted">Target ${rp(g.target)} sudah terkumpul.</div>
      ${sl.photoId ? `<div class="slot-card good" style="margin-top:14px;text-align:left"><img data-img="ph:${sl.photoId}"><div class="slot-cap">${esc(sl.caption)}</div></div>` : `<p style="font-weight:650">${esc(sl.caption)}</p>`}
      <p class="hint">Goal ini tetap tersimpan di daftar “Tercapai” dan tidak muncul lagi sebagai sub-kategori tabungan.</p>
      <button class="btn primary block" data-x>Mantap!</button></div>`,
    onMount: (el, close) => { hydrate(el); $('[data-x]', el).onclick = close; },
  });
}

function goalCard(g) {
  const s = goalSaved(g.id), p = pct(s, g.target), left = Math.max(0, g.target - s);
  let plan = '';
  if (!g.completedAt && g.deadline) {
    const days = diffDays(today(), g.deadline);
    const months = Math.max(1, Math.ceil(days / 30));
    plan = days < 0 ? `<span class="pill bad">Lewat tenggat ${fmtDate(g.deadline)}</span>` : `<span class="pill">🗓️ ${fmtDate(g.deadline)} · ±${rpShort(left / months)}/bln</span>`;
  }
  return `<div class="card ${g.completedAt ? 'goal-done' : ''}" data-goal="${g.id}">
    <div class="goal">${g.photoId ? `<img class="gimg" data-img="ph:${g.photoId}" alt="">` : `<div class="gimg">${g.emoji}</div>`}
      <div class="grow" style="min-width:0"><div style="font-weight:750;font-size:16px">${esc(g.name)}</div>
        <div class="muted small">${rp(s)} / ${rp(g.target)}</div>
        <div class="prog" style="margin:8px 0 6px"><div style="width:${Math.min(100, p)}%;background:${g.completedAt ? 'var(--inc)' : 'var(--accent)'}"></div></div>
        <div class="row between small"><b>${p}%</b><span class="muted">${g.completedAt ? 'Tercapai ' + fmtDate(g.completedAt) : 'kurang ' + rp(left)}</span></div></div></div>
    ${!g.completedAt ? `<div class="row between gap" style="margin-top:10px"><div class="small" style="font-weight:600">${motivation(p)}</div><button class="btn sm accent" data-goal-save="${g.id}">${icon('plus', 15)} Tabung</button></div>${plan ? `<div style="margin-top:8px">${plan}</div>` : ''}` : ''}
  </div>`;
}

function goalsView() {
  const active = S.goals.filter((g) => !g.completedAt), done = S.goals.filter((g) => g.completedAt);
  const tot = totalGoals(), target = sum(active, (g) => g.target);
  return `${S.goals.length ? `<div class="hero"><div class="h-sm">Total tabungan di goals</div><div class="h-big">${H(rp(tot))}</div>
      <div class="h-row"><div class="h-chip"><span>Goal aktif</span><b>${active.length}</b></div><div class="h-chip"><span>Tercapai</span><b>${done.length}</b></div><div class="h-chip"><span>Sisa target</span><b>${H(rpShort(Math.max(0, target - sum(active, (g) => goalSaved(g.id)))))}</b></div></div></div>` : ''}
    ${active.length ? active.map(goalCard).join('') : `<div class="card">${empty('target', 'Belum ada goal aktif', 'Contoh: “MOBIL” target Rp145.000.000. Ketuk + untuk membuat goal.')}</div>`}
    ${done.length ? `<div class="sec-t">🏆 Tercapai</div>${done.map(goalCard).join('')}` : ''}
    <p class="hint">Menabung ke goal dicatat sebagai pengeluaran kategori “Tabungan Goals” (sub-kategori = nama goal), sehingga saldo kas berkurang dan uangnya “dikunci” di goal.</p>`;
}

function openGoalDetail(g) {
  if (!g) return;
  const s = goalSaved(g.id), list = S.transactions.filter((t) => t.goalId === g.id).sort((a, b) => b.date.localeCompare(a.date));
  openSheet({
    title: g.name,
    body: `<div class="center" style="margin-bottom:12px">${g.photoId ? `<img data-img="ph:${g.photoId}" style="width:110px;height:110px;border-radius:22px;object-fit:cover">` : `<div style="font-size:56px">${g.emoji}</div>`}
      <div style="margin:10px auto 0;display:flex;justify-content:center">${ring(pct(s, g.target), { size: 96, color: g.completedAt ? 'var(--inc)' : 'var(--accent)' })}</div>
      <div style="font-weight:800;font-size:20px;margin-top:6px">${rp(s)}</div><div class="muted">dari ${rp(g.target)}</div>
      <div style="margin-top:6px;font-weight:600">${motivation(pct(s, g.target))}</div></div>
      ${g.note ? `<p class="muted" style="white-space:pre-wrap">${esc(g.note)}</p>` : ''}
      <div class="card flat"><div class="card-h"><h3>Riwayat setoran</h3><span class="pill">${list.length}×</span></div>${list.length ? `<div class="list">${list.map((t) => txRow(t, true)).join('')}</div>` : '<div class="muted small">Belum ada setoran.</div>'}</div>
      <div class="sheet-actions"><button class="btn ghost" data-a="del">${icon('trash', 18)}</button><button class="btn ghost grow" data-a="edit">${icon('edit', 18)} Ubah</button>
        ${s > 0 ? `<button class="btn ghost grow" data-a="wd">Tarik</button>` : ''}${!g.completedAt ? `<button class="btn accent grow" data-a="save">Tabung</button>` : ''}</div>`,
    onMount: (el, close) => {
      hydrate(el);
      $('[data-a="edit"]', el).onclick = () => { close(); openGoalForm(g); };
      $('[data-a="save"]', el)?.addEventListener('click', () => { close(); openTxForm({ type: 'expense', categoryId: sysCat('expense', 'goal').id, goalId: g.id }); });
      $('[data-a="wd"]', el)?.addEventListener('click', () => { close(); openTxForm({ type: 'income', categoryId: sysCat('income', 'goal').id, goalId: g.id, note: 'Pencairan ' + g.name }); });
      $('[data-a="del"]', el).onclick = async () => {
        if (list.length) return toast('Goal memiliki riwayat setoran. Tarik/hapus transaksinya dulu.', 'bad');
        if (!(await confirmBox('Hapus goal ini?', { ok: 'Hapus', danger: true }))) return;
        S.goals = S.goals.filter((x) => x !== g); save(); close();
      };
      bindTxRows(el);
    },
  });
}

export function openGoalForm(g = null) {
  const x = g ? { ...g } : { name: '', emoji: '🎯', target: 0, deadline: '', photoId: null, note: '' };
  openSheet({
    title: g ? 'Ubah Goal' : 'Goal Baru', full: true,
    body: `<div class="field"><label>Nama goal</label><input class="inp" id="g-name" value="${esc(x.name)}" placeholder="mis. MOBIL"></div>
      <div class="field"><label>Target nominal</label><div class="money-wrap big"><input class="inp big" id="g-target" inputmode="numeric" data-money value="${x.target || ''}" placeholder="145.000.000"></div></div>
      <div class="field"><label>Target tercapai pada (opsional)</label><input class="inp" type="date" id="g-dead" value="${x.deadline || ''}"></div>
      <div class="field"><label>Ikon</label><div class="emoji-row" id="g-emo">${['🎯', '🚗', '🏠', '🕋', '💍', '🎓', '📱', '💻', '🏍️', '✈️', '👶', '🛡️', '💰', '🏖️'].map((e) => `<button type="button" class="${e === x.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Foto penyemangat (opsional)</label><button type="button" class="ph-pick" id="g-ph"></button></div>
      <div class="field"><label>Catatan (opsional)</label><textarea class="inp" id="g-note">${esc(x.note)}</textarea></div>
      <div class="sheet-actions"><button class="btn primary block" id="g-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindMoney(el);
      const paintPh = () => { $('#g-ph', el).innerHTML = x.photoId ? `<img data-img="ph:${x.photoId}"><span>Ganti foto</span>` : `<span class="ph0">${icon('image', 20)}</span><span class="muted">Pilih foto mobil impian, dll.</span>`; hydrate(el); };
      paintPh();
      $('#g-ph', el).onclick = async () => { const id = await photoPicker({ current: x.photoId }); if (id !== undefined) { x.photoId = id; paintPh(); } };
      $$('#g-emo button', el).forEach((b) => (b.onclick = () => $$('#g-emo button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $('#g-save', el).onclick = () => {
        const name = $('#g-name', el).value.trim(), target = moneyVal($('#g-target', el));
        if (!name || target <= 0) return toast('Nama dan target wajib diisi', 'bad');
        const data = { name, target, deadline: $('#g-dead', el).value || '', emoji: $('#g-emo button.on', el)?.textContent || '🎯', photoId: x.photoId, note: $('#g-note', el).value.trim() };
        if (g) Object.assign(g, data); else S.goals.push({ id: uid(), ...data, createdAt: today(), completedAt: null });
        checkGoals(); save(); close(); toast('Goal disimpan', 'good');
      };
    },
  });
}

// ================= KAS =================
function accountsView() {
  const list = S.accounts.filter((a) => !a.archived), arch = S.accounts.filter((a) => a.archived);
  const byType = groupBy(list, (a) => a.type);
  return `<div class="hero"><button class="icon-btn eye" data-eye>${icon(S.settings.hideAmounts ? 'eyeOff' : 'eye', 20)}</button><div class="h-sm">Total saldo ${list.length} kas</div><div class="h-big">${H(rp(totalCash()))}</div>
    <div class="h-row">${Object.entries(byType).map(([t, l]) => `<div class="h-chip"><span>${ACC_TYPES[t] || t}</span><b>${H(rpShort(sum(l, (a) => accountBalance(a.id))))}</b></div>`).join('')}</div></div>
    <div class="row gap" style="margin-bottom:12px"><button class="btn ghost grow" id="btn-transfer">${icon('transfer', 18)} Transfer antar kas</button></div>
    <div class="card"><div class="list">${list.map((a) => accRow(a)).join('') || empty('wallet', 'Belum ada kas')}</div></div>
    ${arch.length ? `<div class="sec-t">Diarsipkan</div><div class="card"><div class="list">${arch.map((a) => accRow(a)).join('')}</div></div>` : ''}
    <p class="hint">Kas = tempat uang berada (Tunai, BRI, BSI, GoPay, dll). Ketuk kas untuk mengubah, menyesuaikan saldo, atau melihat mutasi.</p>`;
}
const accRow = (a) => { const b = accountBalance(a.id); return `<div class="li tap" data-acc="${a.id}"><div class="ava" style="background:${a.color}22">${a.emoji || '🏦'}</div><div class="main"><div class="t1">${esc(a.name)}</div><div class="t2">${ACC_TYPES[a.type] || ''}</div></div><div class="end amt ${b < 0 ? 'exp' : ''}">${H(rp(b))}</div></div>`; };

function openAccountDetail(a) {
  if (!a) return;
  const list = S.transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time)).slice(0, 30);
  openSheet({
    title: a.name,
    body: `<div class="center" style="margin-bottom:12px"><div style="font-size:40px">${a.emoji || '🏦'}</div><div class="muted">${ACC_TYPES[a.type]}</div><div style="font-size:26px;font-weight:800">${rp(accountBalance(a.id))}</div></div>
      <div class="row gap" style="margin-bottom:12px"><button class="btn ghost grow sm" data-a="adj">⚖️ Sesuaikan saldo</button><button class="btn ghost grow sm" data-a="edit">${icon('edit', 15)} Ubah</button><button class="btn ghost sm" data-a="arc">${a.archived ? 'Aktifkan' : 'Arsip'}</button></div>
      <div class="card flat"><div class="card-h"><h3>Mutasi terakhir</h3></div>${list.length ? `<div class="list">${list.map((t) => txRow(t, true)).join('')}</div>` : '<div class="muted small">Belum ada mutasi.</div>'}</div>`,
    onMount: (el, close) => {
      bindTxRows(el);
      $('[data-a="edit"]', el).onclick = () => { close(); openAccountForm(a); };
      $('[data-a="arc"]', el).onclick = () => { a.archived = !a.archived; save(); close(); };
      $('[data-a="adj"]', el).onclick = () => {
        close();
        openSheet({
          title: 'Sesuaikan Saldo ' + a.name,
          body: `<p class="muted small">Masukkan saldo sebenarnya saat ini (mis. sesuai m-banking). Selisihnya dicatat sebagai penyesuaian dan tidak dihitung sebagai pemasukan/pengeluaran.</p>
            <div class="field"><label>Saldo sebenarnya</label><div class="money-wrap big"><input class="inp big" id="adj" inputmode="numeric" data-money value="${Math.max(0, accountBalance(a.id))}"></div></div>
            <button class="btn primary block" id="adj-s">Simpan</button>`,
          onMount: (e2, c2) => {
            bindMoney(e2);
            $('#adj-s', e2).onclick = () => {
              const diff = moneyVal($('#adj', e2)) - accountBalance(a.id);
              if (diff) S.transactions.push({ id: uid(), type: 'adjust', amount: diff, accountId: a.id, date: today(), time: nowHM(), note: 'Penyesuaian saldo', createdAt: new Date().toISOString() });
              save(); c2(); toast('Saldo disesuaikan', 'good');
            };
          },
        });
      };
    },
  });
}

function openAccountForm(a = null) {
  const x = a ? { ...a } : { name: '', type: 'bank', emoji: '🏦', color: PALETTE[S.accounts.length % 8], initial: 0 };
  openSheet({
    title: a ? 'Ubah Kas' : 'Kas Baru',
    body: `<div class="field"><label>Nama kas</label><input class="inp" id="a-name" value="${esc(x.name)}" placeholder="mis. BRI, Dana, Mandiri"></div>
      <div class="field"><label>Jenis</label>${seg('type', Object.entries(ACC_TYPES), x.type)}</div>
      <div class="field"><label>Ikon</label><div class="emoji-row" id="a-emo">${['💵', '🏦', '📱', '💳', '🪙', '🐷', '👛', '🏧'].map((e) => `<button type="button" class="${e === x.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Warna</label><div class="color-row" id="a-col">${PALETTE.map((c) => `<button type="button" style="background:${c}" data-c="${c}" class="${c === x.color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="field"><label>Saldo awal</label><div class="money-wrap"><input class="inp" id="a-init" inputmode="numeric" data-money value="${x.initial || ''}"></div><p class="hint">Saldo sebelum mulai mencatat di aplikasi.</p></div>
      <div class="sheet-actions">${a ? `<button class="btn ghost" id="a-del">${icon('trash', 18)}</button>` : ''}<button class="btn primary grow" id="a-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindMoney(el); bindSeg(el);
      $$('#a-emo button', el).forEach((b) => (b.onclick = () => $$('#a-emo button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $$('#a-col button', el).forEach((b) => (b.onclick = () => $$('#a-col button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $('#a-del', el)?.addEventListener('click', async () => {
        if (S.transactions.some((t) => t.accountId === a.id || t.toAccountId === a.id)) return toast('Kas memiliki transaksi — arsipkan saja.', 'bad');
        if (await confirmBox('Hapus kas ini?', { ok: 'Hapus', danger: true })) { S.accounts = S.accounts.filter((y) => y !== a); save(); close(); }
      });
      $('#a-save', el).onclick = () => {
        const name = $('#a-name', el).value.trim(); if (!name) return toast('Nama wajib diisi', 'bad');
        const data = { name, type: $('.seg', el).dataset.value, emoji: $('#a-emo button.on', el)?.textContent || '🏦', color: $('#a-col button.on', el)?.dataset.c || PALETTE[0], initial: moneyVal($('#a-init', el)) };
        if (a) Object.assign(a, data); else S.accounts.push({ id: uid(), ...data, archived: false });
        save(); close(); toast('Kas disimpan', 'good');
      };
    },
  });
}

// ================= KATEGORI =================
function categoriesView() {
  const part = (kind, title) => {
    const l = S.categories.filter((c) => c.kind === kind && !c.system);
    return `<div class="card"><div class="card-h"><h3>${title}</h3><button class="link" data-newcat="${kind}">+ Tambah</button></div><div class="list">${l.map((c) => `<div class="li tap" data-cat="${c.id}" style="${c.archived ? 'opacity:.5' : ''}"><div class="ava" style="background:${c.color}22">${c.emoji}</div><div class="main"><div class="t1">${esc(c.name)}</div><div class="t2">${c.archived ? 'Diarsipkan' : c.photoId ? '📷 punya foto pengingat' : ''}</div></div>${icon('right', 18, 'faint')}</div>`).join('')}</div></div>`;
  };
  return part('expense', 'Kategori Pengeluaran') + part('income', 'Kategori Pemasukan') + `<p class="hint">Kategori sistem “Tabungan Goals”, “Pencairan Goal”, “Pembayaran Cicilan”, dan “Dana Pinjaman” dikelola otomatis.</p>`;
}

function openCategoryForm(c = null, kind = 'expense') {
  const x = c ? { ...c } : { name: '', kind, emoji: kind === 'income' ? '💵' : '📦', color: PALETTE[S.categories.length % 8], photoId: null, photoCaption: '' };
  if (x.system) return toast('Kategori sistem tidak dapat diubah');
  openSheet({
    title: c ? 'Ubah Kategori' : 'Kategori Baru',
    body: `<div class="field"><label>Nama</label><input class="inp" id="c-name" value="${esc(x.name)}"></div>
      <div class="field"><label>Jenis</label>${seg('kind', [['expense', 'Pengeluaran'], ['income', 'Pemasukan']], x.kind)}</div>
      <div class="field"><label>Ikon</label><div class="emoji-row" id="c-emo">${['🍽️', '☕', '🚗', '⛽', '🛒', '💡', '📶', '💊', '📚', '🎬', '🤲', '👨‍👩‍👧', '👕', '🏠', '🎮', '🧴', '🐈', '🎁', '💼', '🏅', '💵', '🏪', '📦', '➕'].map((e) => `<button type="button" class="${e === x.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Warna</label><div class="color-row" id="c-col">${PALETTE.map((cc) => `<button type="button" style="background:${cc}" data-c="${cc}" class="${cc === x.color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="field"><label>Foto pengingat khusus kategori ini (opsional)</label><button type="button" class="ph-pick" id="c-ph"></button>
        <input class="inp" id="c-cap" style="margin-top:8px" value="${esc(x.photoCaption || '')}" placeholder="Pesan, mis. “Jangan jajan terus, istri ngamuk!”"></div>
      <div class="sheet-actions">${c ? `<button class="btn ghost" id="c-arc">${c.archived ? 'Aktifkan' : 'Arsip'}</button>` : ''}<button class="btn primary grow" id="c-save">${icon('check', 18)} Simpan</button></div>`,
    onMount: (el, close) => {
      bindSeg(el);
      const paintPh = () => { $('#c-ph', el).innerHTML = x.photoId ? `<img data-img="ph:${x.photoId}"><span>Ganti foto</span>` : `<span class="ph0">${icon('image', 20)}</span><span class="muted">Muncul saat memilih kategori ini</span>`; hydrate(el); };
      paintPh();
      $('#c-ph', el).onclick = async () => { const id = await photoPicker({ current: x.photoId }); if (id !== undefined) { x.photoId = id; paintPh(); } };
      $$('#c-emo button', el).forEach((b) => (b.onclick = () => $$('#c-emo button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $$('#c-col button', el).forEach((b) => (b.onclick = () => $$('#c-col button', el).forEach((y) => y.classList.toggle('on', y === b))));
      $('#c-arc', el)?.addEventListener('click', () => { c.archived = !c.archived; save(); close(); });
      $('#c-save', el).onclick = () => {
        const name = $('#c-name', el).value.trim(); if (!name) return toast('Nama wajib diisi', 'bad');
        const data = { name, kind: $('.seg', el).dataset.value, emoji: $('#c-emo button.on', el)?.textContent || '📦', color: $('#c-col button.on', el)?.dataset.c || PALETTE[0], photoId: x.photoId, photoCaption: $('#c-cap', el).value.trim() };
        if (c) Object.assign(c, data); else S.categories.push({ id: uid(), ...data });
        save(); close(); toast('Kategori disimpan', 'good');
      };
    },
  });
}
