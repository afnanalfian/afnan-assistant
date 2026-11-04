// ===== Dashboard Evaluasi: habit, planner, keuangan =====
import { S, cat, monthTotals, spentByCat, totalCash, totalGoals, accountBalance } from '../state.js';
import { icon } from '../icons.js';
import { esc, today, addDays, monthKey, addMonths, monthLabel, daysInMonth, pad, parseYmd, weekStart, rp, rpShort, pct, sum, HR, BLN, fmtDate, monthOf } from '../utils.js';
import { $, $$, bindSeg, seg, empty } from '../ui.js';
import { ring, bars, line, hbars, donut, legend, PALETTE, OTHER, seq } from '../charts.js';
import { agenda, eventCat, habitStats, periodKey, isDone, activeOn, streak, bestStreak, PERIOD_LABEL, unitLabel } from '../logic.js';
import { vaultSummary } from './vault.js';

let range = '1m';
let endMk = monthKey();
const rerender = () => window.dispatchEvent(new Event('rerender'));
const c4 = (v) => Math.max(4, Math.ceil(v / 4) * 4);
const nMonths = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
const grade = (s) => (s == null ? ['–', 'var(--faint)', 'Belum ada data'] : s >= 85 ? ['A', 'var(--inc)', 'Sangat baik'] : s >= 70 ? ['B', '#2a78d6', 'Baik'] : s >= 55 ? ['C', 'var(--warn)', 'Cukup'] : ['D', 'var(--exp)', 'Perlu perbaikan']);

export function render() {
  const n = nMonths[range];
  const startMk = addMonths(endMk, -(n - 1));
  const from = startMk + '-01';
  const toFull = `${endMk}-${pad(daysInMonth(endMk))}`;
  const to = toFull > today() ? today() : toFull;
  const ctx = { from, to, startMk, n };
  const H = habitEval(ctx), P = plannerEval(ctx), F = financeEval(ctx);
  const scores = [H.score, P.score, F.score].filter((x) => x != null);
  const overall = scores.length ? Math.round(sum(scores) / scores.length) : null;
  const [g, gc, gl] = grade(overall);
  const insights = [...H.insights, ...P.insights, ...F.insights];

  const html = `<div class="row gap" style="margin-bottom:10px">${seg('range', [['1m', '1 Bln'], ['3m', '3 Bln'], ['6m', '6 Bln'], ['12m', '1 Thn']], range)}</div>
    <div class="period-nav"><button class="icon-btn" data-mnav="-1">${icon('left')}</button><div class="pl">${n === 1 ? monthLabel(endMk) : `${monthLabel(startMk, true)} – ${monthLabel(endMk, true)}`}<small>${fmtDate(from)} s.d. ${fmtDate(to)}</small></div>
      <button class="icon-btn" data-mnav="1" ${endMk >= monthKey() ? 'disabled style="opacity:.3"' : ''}>${icon('right')}</button></div>
    <div class="card"><div class="score"><div style="width:76px;height:76px;border-radius:22px;display:grid;place-items:center;font-size:38px;font-weight:900;color:#fff;background:${gc};flex:none">${g}</div>
      <div><div class="muted small">Skor evaluasi keseluruhan</div><div style="font-size:26px;font-weight:850">${overall ?? '–'}<span class="muted" style="font-size:15px">/100</span></div><div class="grade" style="color:${gc}">${gl}</div></div></div>
      <div class="grid3" style="margin-top:14px">
        ${[['Habit', H.score, '#1baf7a'], ['Planner', P.score, '#2a78d6'], ['Keuangan', F.score, '#eb6834']].map(([l, s, c]) => `<div class="center">${ring(s ?? 0, { size: 70, color: c, label: s == null ? '–' : String(s) })}<div class="small" style="font-weight:650;margin-top:4px">${l}</div><div class="faint" style="font-size:11px">${grade(s)[2]}</div></div>`).join('')}
      </div></div>
    ${insights.length ? `<div class="card"><div class="card-h"><h3>💡 Catatan & Saran</h3></div>${insights.slice(0, 8).map(([e, t]) => `<div class="insight"><div class="ii">${e}</div><div>${t}</div></div>`).join('')}</div>` : ''}
    <div class="sec-t">✅ Habit</div>${H.html}
    <div class="sec-t">📅 Planner</div>${P.html}
    <div class="sec-t">💰 Keuangan</div>${F.html}`;
  return {
    title: 'Evaluasi', sub: 'Gambaran kinerja pribadimu', html,
    mount(el) {
      bindSeg(el, (v) => { range = v; rerender(); });
      $$('[data-mnav]', el).forEach((b) => (b.onclick = () => { const x = addMonths(endMk, +b.dataset.mnav); if (x <= monthKey()) { endMk = x; rerender(); } }));
    },
  };
}

// ---------- buckets waktu ----------
function buckets(ctx) {
  // jika rentang 1 bulan → per minggu; selainnya → per bulan
  if (ctx.n === 1) {
    const out = []; let s = weekStart(ctx.from);
    while (s <= ctx.to) { const e = addDays(s, 6); out.push({ label: `${parseYmd(s < ctx.from ? ctx.from : s).getDate()}/${parseYmd(s < ctx.from ? ctx.from : s).getMonth() + 1}`, from: s < ctx.from ? ctx.from : s, to: e > ctx.to ? ctx.to : e }); s = addDays(s, 7); }
    return out;
  }
  return Array.from({ length: ctx.n }, (_, i) => { const m = addMonths(ctx.startMk, i); const e = `${m}-${pad(daysInMonth(m))}`; return { label: BLN[+m.slice(5) - 1], from: m + '-01', to: e > ctx.to ? ctx.to : e, mk: m }; }).filter((b) => b.from <= ctx.to);
}

// ================= HABIT =================
function habitEval(ctx) {
  const hs = S.habits.filter((h) => !h.archived || Object.keys(S.habitLogs[h.id] || {}).length);
  if (!hs.length) return { score: null, insights: [], html: `<div class="card">${empty('checkCircle', 'Belum ada habit', 'Tambahkan habit untuk melihat evaluasi.')}</div>` };
  const per = hs.map((h) => ({ h, ...habitStats(h, ctx.from, ctx.to), st: streak(h), best: bestStreak(h) })).filter((x) => x.expected > 0);
  const totDone = sum(per, (x) => x.done), totExp = sum(per, (x) => x.expected);
  const score = totExp ? Math.round((totDone / totExp) * 100) : null;
  const byP = ['daily', 'weekly', 'monthly'].map((p) => { const l = per.filter((x) => x.h.period === p); const e = sum(l, (x) => x.expected); return { p, rate: e ? Math.round((sum(l, (x) => x.done) / e) * 100) : null, n: l.length }; });
  // tren per bucket
  const bk = buckets(ctx);
  const trend = bk.map((b) => { let d = 0, e = 0; for (const h of hs) { const s = habitStats(h, b.from, b.to); d += s.done; e += s.expected; } return e ? Math.round((d / e) * 100) : null; });
  // heatmap harian (habit harian)
  const daily = hs.filter((h) => h.period === 'daily');
  let heat = '';
  if (daily.length) {
    const start = weekStart(ctx.n === 1 ? ctx.from : addDays(ctx.to, -7 * 12 + 1));
    const lead = HR.slice(1).concat(HR[0]).map((x) => `<div class="center faint small">${x}</div>`).join('');
    let cells = '';
    for (let d = start; d <= addDays(weekStart(ctx.to), 6); d = addDays(d, 1)) {
      const act = daily.filter((h) => activeOn(h, d) && (h.createdAt || '').slice(0, 10) <= d);
      const done = act.filter((h) => isDone(h, d)).length;
      const r = act.length && d <= today() ? done / act.length : 0;
      cells += `<div class="hc ${r > 0 ? 'on' : ''} ${d > today() || !act.length ? 'off' : ''}" style="background:${d > today() || !act.length ? 'var(--line)' : seq(r)}" data-tip="${fmtDate(d, { day: true })}: ${done}/${act.length} habit">${parseYmd(d).getDate()}</div>`;
    }
    heat = `<div class="card"><div class="card-h"><h3>Peta Konsistensi Harian</h3><span class="pill">habit harian</span></div><div class="heat">${lead}${cells}</div>
      <div class="legend"><span class="lg">Sedikit</span>${[0.15, 0.4, 0.65, 0.9, 1].map((t) => `<span class="lg"><i style="background:${seq(t)}"></i></span>`).join('')}<span class="lg">Penuh</span></div></div>`;
  }
  const sorted = [...per].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const insights = [];
  if (score != null) {
    if (sorted[0]?.rate >= 80) insights.push(['🏆', `Habit paling konsisten: <b>${esc(sorted[0].h.emoji + ' ' + sorted[0].h.name)}</b> (${sorted[0].rate}%).`]);
    const weak = sorted.filter((x) => x.rate != null && x.rate < 50);
    if (weak.length) insights.push(['🎯', `Perlu perhatian: <b>${weak.slice(0, 2).map((x) => esc(x.h.name)).join(', ')}</b> di bawah 50%. Coba kecilkan targetnya atau pasang di waktu yang sama setiap hari.`]);
    const tr = trend.filter((x) => x != null);
    if (tr.length >= 2 && tr[tr.length - 1] - tr[0] >= 10) insights.push(['📈', `Konsistensi habit meningkat ${tr[tr.length - 1] - tr[0]} poin. Pertahankan!`]);
    if (tr.length >= 2 && tr[0] - tr[tr.length - 1] >= 10) insights.push(['📉', `Konsistensi habit turun ${tr[0] - tr[tr.length - 1]} poin dibanding awal periode.`]);
  }
  const html = `<div class="grid3" style="margin-bottom:12px">${byP.map((x) => `<div class="stat"><div class="s-l">${PERIOD_LABEL[x.p]}</div><div class="s-v">${x.rate ?? '–'}${x.rate != null ? '%' : ''}</div><div class="s-s">${x.n} habit</div></div>`).join('')}</div>
    <div class="card"><div class="card-h"><h3>Tren Ketercapaian</h3><span class="pill">${ctx.n === 1 ? 'per minggu' : 'per bulan'}</span></div>${line({ labels: bk.map((b) => b.label), series: [{ name: 'Ketercapaian', color: '#1baf7a', values: trend, area: true }], maxV: 100 })}</div>
    ${heat}
    <div class="card"><div class="card-h"><h3>Per Habit</h3><span class="pill">${totDone}/${totExp} terpenuhi</span></div>
      ${hbars(sorted.map((x) => ({ label: x.h.name, emoji: x.h.emoji, value: x.rate ?? 0, max: 100, color: (x.rate ?? 0) >= 80 ? 'var(--inc)' : (x.rate ?? 0) >= 50 ? 'var(--warn)' : 'var(--exp)', right: `${x.rate ?? 0}% · ${x.done}/${x.expected}`, sub: `${PERIOD_LABEL[x.h.period]} · 🔥 streak ${x.st} · terbaik ${x.best} ${unitLabel(x.h.period)}` })))}</div>`;
  return { score, insights, html };
}

// ================= PLANNER =================
function plannerEval(ctx) {
  const occ = agenda(ctx.from, ctx.to).filter((o) => o.status !== 'upcoming');
  if (!occ.length) return { score: null, insights: [], html: `<div class="card">${empty('calendar', 'Belum ada kegiatan di periode ini')}</div>` };
  const done = occ.filter((o) => o.status === 'done'), missed = occ.filter((o) => o.status === 'missed');
  const score = Math.round((done.length / occ.length) * 100);
  const upcoming = agenda(today(), addDays(today(), 7)).filter((o) => o.status === 'upcoming').length;
  const bk = buckets(ctx);
  const doneS = bk.map((b) => occ.filter((o) => o.date >= b.from && o.date <= b.to && o.status === 'done').length);
  const missS = bk.map((b) => occ.filter((o) => o.date >= b.from && o.date <= b.to && o.status === 'missed').length);
  const byCat = {};
  for (const o of occ) { const c = eventCat(o.ev.catId); (byCat[c.id] ||= { c, d: 0, m: 0 }); o.status === 'done' ? byCat[c.id].d++ : byCat[c.id].m++; }
  const catRows = Object.values(byCat).sort((a, b) => b.d + b.m - (a.d + a.m));
  const wdMiss = Array(7).fill(0), wdTot = Array(7).fill(0);
  for (const o of occ) { const w = (parseYmd(o.date).getDay() + 6) % 7; wdTot[w]++; if (o.status === 'missed') wdMiss[w]++; }
  const hiPrioMiss = missed.filter((o) => o.ev.priority === 'high').length;
  const insights = [];
  if (missed.length) {
    const worst = wdMiss.indexOf(Math.max(...wdMiss));
    insights.push(['⏰', `${missed.length} kegiatan terlewat (${100 - score}%). Hari paling sering terlewat: <b>${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][worst]}</b>.`]);
  } else insights.push(['🌟', 'Tidak ada kegiatan terlewat di periode ini. Disiplin yang luar biasa!']);
  if (hiPrioMiss) insights.push(['❗', `${hiPrioMiss} kegiatan prioritas tinggi terlewat — pasang pengingat lebih awal (mis. 1 jam / 1 hari sebelum).`]);
  const html = `<div class="grid3" style="margin-bottom:12px"><div class="stat"><div class="s-l">Selesai</div><div class="s-v inc">${done.length}</div><div class="s-s">${score}% tuntas</div></div>
      <div class="stat"><div class="s-l">Terlewat</div><div class="s-v exp">${missed.length}</div><div class="s-s">${100 - score}%</div></div>
      <div class="stat"><div class="s-l">7 hari ke depan</div><div class="s-v">${upcoming}</div><div class="s-s">kegiatan</div></div></div>
    <div class="card"><div class="card-h"><h3>Selesai vs Terlewat</h3><span class="pill">${ctx.n === 1 ? 'per minggu' : 'per bulan'}</span></div>
      ${bars({ labels: bk.map((b) => b.label), series: [{ name: 'Selesai', color: '#2a78d6', values: doneS }, { name: 'Terlewat', color: '#eb6834', values: missS }], stacked: true, maxV: c4(Math.max(...doneS.map((x, i) => x + missS[i]))), fmt: (v) => String(Math.round(v)), height: 160 })}</div>
    <div class="card"><div class="card-h"><h3>Per Kategori</h3></div>${hbars(catRows.map((r) => ({ label: r.c.name, color: r.c.color, value: r.d, max: r.d + r.m, right: `${pct(r.d, r.d + r.m)}% · ${r.d}/${r.d + r.m}`, sub: r.m ? `${r.m} terlewat` : 'semua tuntas' })))}</div>
    <div class="card"><div class="card-h"><h3>Pola Hari Terlewat</h3></div>${bars({ labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], series: [{ name: 'Terlewat', color: '#eb6834', values: wdMiss }], maxV: c4(Math.max(...wdMiss)), fmt: (v) => String(Math.round(v)), height: 140 })}</div>`;
  return { score, insights, html };
}

// ================= KEUANGAN =================
function financeEval(ctx) {
  if (!S.transactions.length) return { score: null, insights: [], html: `<div class="card">${empty('wallet', 'Belum ada transaksi')}</div>` };
  const months = Array.from({ length: Math.max(ctx.n, 6) }, (_, i) => addMonths(endMk, -(Math.max(ctx.n, 6) - 1 - i)));
  const T = months.map((m) => ({ m, ...monthTotals(m) }));
  const inRange = T.filter((x) => x.m >= ctx.startMk && x.m <= endMk);
  const inc = sum(inRange, (x) => x.income), exp = sum(inRange, (x) => x.expense), sav = sum(inRange, (x) => x.saving), debtPay = sum(inRange, (x) => x.debtPay);
  const savingsRate = inc ? Math.round(((inc - exp) / inc) * 100) : null;
  // anggaran
  let bIn = 0, bAll = 0;
  for (const x of inRange) { const b = S.budgets[x.m]; if (!b) continue; const sp = spentByCat(x.m); for (const [id, v] of Object.entries(b)) { bAll++; if ((sp[id] || 0) <= v) bIn++; } }
  const budgetScore = bAll ? Math.round((bIn / bAll) * 100) : null;
  const posMonths = inRange.filter((x) => x.incomeAll || x.expenseAll);
  const cfScore = posMonths.length ? Math.round((posMonths.filter((x) => x.income >= x.expense).length / posMonths.length) * 100) : null;
  const vs = vaultSummary();
  const avgInc = inRange.length ? inc / inRange.length : 0;
  const dti = vs && avgInc ? Math.round((vs.monthly / avgInc) * 100) : null;
  const parts = [];
  if (savingsRate != null) parts.push(Math.max(0, Math.min(100, Math.round((savingsRate / 30) * 100))));
  if (budgetScore != null) parts.push(budgetScore);
  if (cfScore != null) parts.push(cfScore);
  if (dti != null) parts.push(dti <= 30 ? 100 : dti <= 50 ? 60 : 25);
  const score = parts.length ? Math.round(sum(parts) / parts.length) : null;

  // kategori dalam rentang
  const catSum = {};
  for (const x of inRange) for (const [id, v] of Object.entries(spentByCat(x.m))) { const c = cat(id); if (c && !c.system) catSum[id] = (catSum[id] || 0) + v; }
  const catRows = Object.entries(catSum).map(([id, v]) => ({ c: cat(id), v })).sort((a, b) => b.v - a.v);
  const top = catRows.slice(0, 6), rest = catRows.slice(6);
  const donutItems = top.map((x, i) => ({ label: x.c.name, value: x.v, color: PALETTE[i], tip: `${x.c.name}: ${rp(x.v)}` }));
  if (rest.length) donutItems.push({ label: 'Lainnya', value: sum(rest, (x) => x.v), color: OTHER });
  // pola hari
  const wd = Array(7).fill(0);
  const txR = S.transactions.filter((t) => t.date >= ctx.from && t.date <= ctx.to);
  for (const t of txR) if (t.type === 'expense' && !cat(t.categoryId)?.system) wd[(parseYmd(t.date).getDay() + 6) % 7] += t.amount;
  const biggest = txR.filter((t) => t.type === 'expense' && !cat(t.categoryId)?.system).sort((a, b) => b.amount - a.amount).slice(0, 3);
  // kekayaan bersih (kas + goals) per akhir bulan
  const nw = months.map((m) => { const end = `${m}-${pad(daysInMonth(m))}`; const cash = sum(S.accounts, (a) => accountBalance(a.id, end)); const g = sum(S.transactions.filter((t) => t.goalId && t.date <= end), (t) => (t.type === 'expense' ? t.amount : -t.amount)); return cash + g; });

  const insights = [];
  if (savingsRate != null) insights.push(savingsRate >= 20 ? ['💚', `Rasio sisa pendapatan <b>${savingsRate}%</b> — sehat (≥20%).`] : savingsRate >= 0 ? ['🟡', `Rasio sisa pendapatan <b>${savingsRate}%</b>. Targetkan minimal 20% dari pemasukan untuk ditabung.`] : ['🔴', `Pengeluaran melebihi pemasukan sebesar <b>${rp(exp - inc)}</b>. Tinjau kategori terbesar.`]);
  if (catRows[0] && exp) insights.push(['🧾', `Pengeluaran terbesar: <b>${esc(catRows[0].c.emoji + ' ' + catRows[0].c.name)}</b> (${pct(catRows[0].v, exp)}% dari total).`]);
  if (T.length >= 2) { const lastFull = endMk === monthKey() ? T.length - 2 : T.length - 1; const a = T[lastFull - 1], b = T[lastFull]; if (a && b) if (a.expense && b.expense) { const ch = Math.round(((b.expense - a.expense) / a.expense) * 100); if (Math.abs(ch) >= 15) insights.push([ch > 0 ? '⚠️' : '👍', `Pengeluaran ${monthLabel(b.m, true)} ${ch > 0 ? 'naik' : 'turun'} ${Math.abs(ch)}% dibanding ${monthLabel(a.m, true)}.`]); } }
  if (budgetScore != null && budgetScore < 70) insights.push(['📊', `Hanya ${bIn} dari ${bAll} pos anggaran yang terjaga. Sesuaikan anggaran atau rem pengeluaran.`]);
  if (dti != null) insights.push([dti <= 30 ? '🔐' : '⚠️', `Rasio cicilan terhadap pemasukan ${dti}% ${dti <= 30 ? '(aman, ≤30%)' : '(tinggi, idealnya ≤30%)'}.`]);
  const wdMax = wd.indexOf(Math.max(...wd));
  if (Math.max(...wd) > 0) insights.push(['📆', `Hari paling boros: <b>${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][wdMax]}</b>.`]);

  const html = `<div class="grid2" style="margin-bottom:12px">
      <div class="stat"><div class="s-l">Pemasukan</div><div class="s-v inc">${rpShort(inc)}</div><div class="s-s">rata-rata ${rpShort(avgInc)}/bln</div></div>
      <div class="stat"><div class="s-l">Pengeluaran</div><div class="s-v exp">${rpShort(exp)}</div><div class="s-s">tanpa tabungan & cicilan</div></div>
      <div class="stat"><div class="s-l">Ditabung (goals)</div><div class="s-v">${rpShort(sav)}</div><div class="s-s">${inc ? pct(sav, inc) + '% dari pemasukan' : ''}</div></div>
      <div class="stat"><div class="s-l">Anggaran terjaga</div><div class="s-v">${budgetScore != null ? budgetScore + '%' : '–'}</div><div class="s-s">${bAll ? `${bIn}/${bAll} pos` : 'belum ada anggaran'}</div></div>
    </div>
    <div class="card"><div class="card-h"><h3>Pemasukan vs Pengeluaran</h3><span class="pill">${months.length} bulan</span></div>
      ${bars({ labels: months.map((m) => BLN[+m.slice(5) - 1]), series: [{ name: 'Pemasukan', color: '#1baf7a', values: T.map((x) => x.income) }, { name: 'Pengeluaran', color: '#eb6834', values: T.map((x) => x.expense) }], height: 170 })}</div>
    <div class="card"><div class="card-h"><h3>Kekayaan Bersih (Kas + Goals)</h3><span class="pill">${rpShort(totalCash() + totalGoals())}</span></div>
      ${line({ labels: months.map((m) => BLN[+m.slice(5) - 1]), series: [{ name: 'Kekayaan', color: '#2a78d6', values: nw, area: true }], fmt: rpShort, maxV: null, minV: Math.min(0, ...nw) })}
      <p class="hint">Tidak termasuk hutang${vs ? ` (sisa hutang ${rpShort(vs.total)} → bersih ${rpShort(totalCash() + totalGoals() - vs.total)})` : ' — buka Brankas untuk memasukkan rasio hutang ke evaluasi'}.</p></div>
    ${donutItems.length ? `<div class="card"><div class="card-h"><h3>Komposisi Pengeluaran</h3></div><div class="donut-row">${donut(donutItems, { size: 140, thickness: 18, top: rpShort(exp), sub: 'total' })}
      <div class="donut-leg">${donutItems.map((d) => `<div class="dl"><i class="dot" style="background:${d.color}"></i><span>${esc(d.label)}</span><b>${pct(d.value, exp)}%</b></div>`).join('')}</div></div></div>` : ''}
    <div class="card"><div class="card-h"><h3>Pola Pengeluaran per Hari</h3></div>${bars({ labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'], series: [{ name: 'Pengeluaran', color: '#eb6834', values: wd }], height: 140 })}</div>
    ${biggest.length ? `<div class="card"><div class="card-h"><h3>Pengeluaran Terbesar</h3></div><div class="list">${biggest.map((t) => { const c = cat(t.categoryId); return `<div class="li"><div class="ava" style="background:${c?.color}1f">${c?.emoji || '•'}</div><div class="main"><div class="t1">${esc(t.note || c?.name)}</div><div class="t2">${fmtDate(t.date, { day: true })} · ${esc(c?.name || '')}</div></div><div class="end amt exp">${rp(t.amount)}</div></div>`; }).join('')}</div></div>` : ''}
    ${vs ? `<div class="card"><div class="card-h"><h3>🔐 Hutang</h3><span class="pill">brankas terbuka</span></div><div class="grid2"><div class="stat"><div class="s-l">Sisa hutang</div><div class="s-v exp">${rpShort(vs.total)}</div></div><div class="stat"><div class="s-l">Cicilan / pemasukan</div><div class="s-v">${dti ?? '–'}${dti != null ? '%' : ''}</div></div></div>
      <div class="hint">Dibayar pada periode ini: ${rp(debtPay)}</div></div>` : ''}`;
  return { score, insights, html };
}
