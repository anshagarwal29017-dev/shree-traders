/* ===================== SHREE TRADERS UI: books, GST, expenses, reports, settings, events ===================== */
const fyLabel = () => 'FY ' + db.fy;
const dayBookRows = f => db.vouchers.filter(v => v.type !== 'opening' && inRange(v, f) && (!f.type || v.type === f.type)).sort((a, b) => a.date.localeCompare(b.date) || (a.created || '').localeCompare(b.created || ''));

PAGES.daybook = () => {
  const f = ui.f.daybook = ui.f.daybook || { ...fyDef(), type: '' }; const rows = dayBookRows(f);
  const rep = { title: 'Day Book', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Date', t: 'date' }, { h: 'Type' }, { h: 'Number' }, { h: 'Particulars' }, { h: 'Amount', t: 'money' }, { h: 'Status' }], rows: rows.map(v => [v.date, TYPE_LABEL[v.type], v.no, partyName(v) || v.narr || '', voucherAmount(v), v.status === 'cancelled' ? 'Cancelled' : 'Posted']) };
  const html = `<div class="page-head"><div><h2>Day book</h2><p>Every voucher in date order.</p></div></div><div class="card"><header><div class="row">${searchBox('dayTbl')}${dateFilter('daybook', fyDef())}<select data-f="daybook.type" style="width:auto" aria-label="Voucher type">${opts(Object.entries(TYPE_LABEL).filter(([k]) => k !== 'opening'), f.type, 'All types')}</select></div>${exportBtns('daybook', rep)}</header>${rows.length ? `<div class="scroll"><table class="tbl" id="dayTbl"><thead><tr><th>Date</th><th>Type</th><th>Number</th><th>Particulars</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${rows.map(v => `<tr class="click ${v.status === 'cancelled' ? 'cancelled' : ''}" data-act="view-voucher" data-id="${v.id}"><td class="nowrap">${dt(v.date)}</td><td>${esc(TYPE_LABEL[v.type])}</td><td class="mono">${esc(v.no)}</td><td>${esc(partyName(v) || v.narr || '')}</td><td class="num mono">${nf(voucherAmount(v))}</td><td class="keep">${v.status === 'cancelled' ? chip('Cancelled', 'gray') : chip('Posted', 'good')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No vouchers in this range</b></div>'}</div>`;
  return { html, title: 'Day Book' };
};

function ledgerTable(accId, f, key, title) {
  const L = E.ledger(db, accId, f.from || null, f.to || null); const a = E.acc(db, accId);
  const book = a.group === 'Cash-in-Hand' || a.group === 'Bank Accounts';
  const rep = { title, period: `${f.from ? dt(f.from) : 'start'} to ${f.to ? dt(f.to) : 'today'}`, cols: [{ h: 'Date', t: 'date' }, { h: 'Voucher' }, { h: 'Type' }, { h: 'Particulars' }, { h: book ? 'Receipts' : 'Debit', t: 'money' }, { h: book ? 'Payments' : 'Credit', t: 'money' }, { h: 'Balance' }], rows: [...(f.from ? [['', '', '', 'Opening balance', '', '', drcr(L.opening)]] : []), ...L.rows.map(r => [r.date, r.no, TYPE_LABEL[r.type] || r.type, r.particulars, r.dr, r.cr, drcr(r.bal)])], foot: ['', '', '', 'Closing balance', L.dr, L.cr, drcr(L.closing)] };
  return { rep, html: `${exportBtns(key, rep)}`, body: L.rows.length || f.from ? `<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Particulars</th><th class="num">${book ? 'Receipts' : 'Debit'}</th><th class="num">${book ? 'Payments' : 'Credit'}</th><th class="num">Balance</th></tr></thead><tbody>${f.from ? `<tr><td colspan="6" class="muted">Opening balance</td><td class="num mono">${drcr(L.opening)}</td></tr>` : ''}${L.rows.map(r => `<tr class="click" data-act="view-voucher" data-id="${r.v.id}"><td class="nowrap">${dt(r.date)}</td><td class="mono">${esc(r.no)}</td><td>${esc(TYPE_LABEL[r.type] || r.type)}</td><td>${esc(r.particulars)}${r.narr ? `<div class="small muted">${esc(r.narr)}</div>` : ''}</td><td class="num mono">${r.dr ? nf(r.dr) : ''}</td><td class="num mono">${r.cr ? nf(r.cr) : ''}</td><td class="num mono">${drcr(r.bal)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">Closing balance</td><td class="num mono">${nf(L.dr)}</td><td class="num mono">${nf(L.cr)}</td><td class="num mono">${drcr(L.closing)}</td></tr></tfoot></table></div>` : '<div class="empty"><b>No entries</b>Nothing has been posted to this account yet.</div>', L };
}
function bookPage(kind) {
  const cash = kind === 'cash'; const key = kind + 'book'; const f = ui.f[key] = ui.f[key] || { ...fyDef(), acc: cash ? 'CASH' : 'BANK' };
  const banks = bankAccounts(); if (!cash && !banks.some(b => b.id === f.acc)) f.acc = banks[0] ? banks[0].id : 'BANK';
  const t = ledgerTable(f.acc, f, key, cash ? 'Cash Book' : 'Bank Book - ' + E.acc(db, f.acc).name);
  const html = `<div class="page-head"><div><h2>${cash ? 'Cash book' : 'Bank book'}</h2><p>Receipts on the debit side, payments on the credit side, with a running balance.</p></div></div>
  <div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><span class="l">${cash ? 'Cash in hand' : 'Balance'} today</span><span class="v">${inr(E.balanceAt(db, f.acc, E.todayISO() > E.getYear(db).end ? E.getYear(db).end : E.todayISO()))}</span></div><div class="card kpi"><span class="l">Total receipts</span><span class="v good">${inr(t.L.dr)}</span></div><div class="card kpi"><span class="l">Total payments</span><span class="v">${inr(t.L.cr)}</span></div></div>
  <div class="card"><header><div class="row">${dateFilter(key, fyDef())}${!cash && banks.length > 1 ? `<select data-f="${key}.acc" style="width:auto">${opts(banks.map(b => [b.id, b.name]), f.acc)}</select>` : ''}</div>${t.html}</header>${t.body}</div>`;
  return { html, title: cash ? 'Cash Book' : 'Bank Book' };
}
PAGES.cashbook = () => bookPage('cash'); PAGES.bankbook = () => bookPage('bank');

PAGES.ledgers = () => {
  const fy = E.getYear(db); const bs = E.totals(db, null, fy.end), pl = E.totals(db, fy.start, fy.end);
  const f = ui.f.ledgers = ui.f.ledgers || { q: '' };
  const rows = db.accounts.map(a => { const b = E.isPL(db, a.id) ? E.net(pl, a.id) : E.net(bs, a.id); return { a, b }; }).sort((x, y) => x.a.group.localeCompare(y.a.group) || x.a.name.localeCompare(y.a.name));
  const rep = { title: 'Ledger Accounts', period: 'FY ' + fy.id, cols: [{ h: 'Group' }, { h: 'Ledger' }, { h: 'Debit', t: 'money' }, { h: 'Credit', t: 'money' }], rows: rows.map(r => [r.a.group, r.a.name, r.b > 0 ? r.b : 0, r.b < 0 ? -r.b : 0]) };
  const html = `<div class="page-head"><div><h2>Ledger accounts</h2><p>Every account in your books. Open one to see its full ledger.</p></div>${isAdmin() ? btn('New ledger', 'ledger-form', { cls: 'primary', icon: 'plus' }) : ''}</div>
  <div class="card"><header>${searchBox('ledTbl', 'Search ledger or group')}${exportBtns('ledgers', rep)}</header><div class="scroll"><table class="tbl" id="ledTbl"><thead><tr><th>Group</th><th>Ledger</th><th class="num">Closing balance</th></tr></thead><tbody>${rows.map(r => `<tr class="click" data-act="open-ledger" data-id="${r.a.id}"><td class="muted">${esc(r.a.group)}</td><td><b>${esc(r.a.name)}</b></td><td class="num mono">${drcr(r.b)}</td></tr>`).join('')}</tbody></table></div></div>`;
  return { html, title: 'Ledger Accounts' };
};
PAGES.ledger = () => {
  const a = E.acc(db, ui.accId); if (!a) return { html: '<div class="empty"><b>Ledger not found</b></div>' };
  const f = ui.f.ledgerView = ui.f.ledgerView && ui.f.ledgerViewAcc === a.id ? ui.f.ledgerView : { ...fyDef() }; ui.f.ledgerViewAcc = a.id;
  const t = ledgerTable(a.id, f, 'ledgerView', a.name + ' - Ledger');
  return { html: `<div class="page-head"><div><h2>${esc(a.name)}</h2><p>${esc(a.group)}</p></div><div class="row">${btn('Back', 'nav', { d: { page: 'ledgers' } })}${a.party ? btn('Open khata', 'open-party', { d: { id: a.id } }) : ''}</div></div><div class="card"><header>${dateFilter('ledgerView', fyDef())}${t.html}</header>${t.body}</div>`, title: 'Ledger' };
};
function ledgerForm() {
  const sc = openModal('New ledger account', `<div class="grid g2">${field('Ledger name', `<input name="name">`, { req: 1 })}${field('Group', `<select name="group">${opts(Object.keys(E.GROUPS).filter(g => !['Sundry Debtors', 'Sundry Creditors', 'Stock-in-Hand'].includes(g)).map(g => [g, g]), 'Indirect Expenses')}</select>`, { req: 1, hint: 'Choose Bank Accounts for another bank account.' })}${field('Opening balance (₹)', `<input name="opening" type="number" min="0" step="any">`)}${field('Opening type', `<select name="openingType">${opts([['Dr', 'Debit'], ['Cr', 'Credit']], 'Dr')}</select>`)}</div>`, { ok: 'Create ledger' });
  sc._onSubmit = () => { const f = formData($('form', sc)); if (mutate(() => E.saveAccount(db, f, ui.user.name), 'Ledger created.')) { closeModal(sc); render(); } };
}

/* vouchers & journal */
const VTABS = [['receipt', 'Receipts'], ['payment', 'Payments'], ['contra', 'Contra'], ['creditnote', 'Credit notes'], ['debitnote', 'Debit notes'], ['adjust', 'Stock adjustments']];
function voucherListHTML(type, f) {
  const rows = db.vouchers.filter(v => v.type === type && inRange(v, f)).sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  const rep = { title: TYPE_LABEL[type] + ' Register', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Date', t: 'date' }, { h: 'Number' }, { h: 'Particulars' }, { h: 'Mode' }, { h: 'Amount', t: 'money' }, { h: 'Status' }], rows: rows.map(v => [v.date, v.no, partyName(v) || v.narr || '', v.mode || '', voucherAmount(v), v.status === 'cancelled' ? 'Cancelled' : 'Posted']) };
  const part = v => v.type === 'contra' ? `${(E.acc(db, v.fromAcc) || {}).name} to ${(E.acc(db, v.toAcc) || {}).name}` : v.type === 'journal' ? (v.narr || '') : (partyName(v) || v.narr || '');
  return { rep, html: rows.length ? `<div class="scroll"><table class="tbl" id="vTbl"><thead><tr><th>Date</th><th>Number</th><th>Particulars</th><th>Mode</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${rows.map(v => `<tr class="click ${v.status === 'cancelled' ? 'cancelled' : ''}" data-act="view-voucher" data-id="${v.id}"><td class="nowrap">${dt(v.date)}</td><td class="mono">${esc(v.no)}</td><td>${esc(part(v))}</td><td>${esc((v.mode || '').toUpperCase())}</td><td class="num mono">${nf(voucherAmount(v))}</td><td class="keep">${v.status === 'cancelled' ? chip('Cancelled', 'gray') : chip('Posted', 'good')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>No ${TYPE_LABEL[type].toLowerCase()}s in this period</b></div>` };
}
function newVoucherBtn(type) { return DOC_TYPES.includes(type) ? btn('New ' + TYPE_LABEL[type].toLowerCase(), 'new-doc', { cls: 'primary', icon: 'plus', d: { type } }) : btn('New ' + (type === 'adjust' ? 'stock adjustment' : TYPE_LABEL[type].toLowerCase()), 'voucher-form', { cls: 'primary', icon: 'plus', d: { type } }); }
PAGES.vouchers = () => {
  const f = ui.f.vouchers = ui.f.vouchers || { ...fyDef(), tab: 'receipt' }; const t = voucherListHTML(f.tab, f);
  const help = { receipt: 'Money received from customers.', payment: 'Money paid to suppliers.', contra: 'Cash deposits, withdrawals and bank transfers.', creditnote: 'Sales returns and price reductions given to customers.', debitnote: 'Purchase returns sent back to suppliers.', adjust: 'Corrections for damaged, lost or found stock.' };
  return { html: `<div class="page-head"><div><h2>Vouchers</h2><p>${help[f.tab]}</p></div>${newVoucherBtn(f.tab)}</div><div class="tabs" role="tablist">${VTABS.map(([k, l]) => `<button role="tab" aria-selected="${f.tab === k}" data-act="tab" data-key="vouchers" data-v="${k}">${l}</button>`).join('')}</div><div class="card"><header><div class="row">${searchBox('vTbl')}${dateFilter('vouchers', fyDef())}</div>${exportBtns('vouchers', t.rep)}</header>${t.html}</div>`, title: 'Vouchers' };
};
PAGES.journal = () => {
  const f = ui.f.journal = ui.f.journal || { ...fyDef() }; const t = voucherListHTML('journal', f);
  return { html: `<div class="page-head"><div><h2>Journal entries</h2><p>Manual double-entry adjustments. Debits must equal credits.</p></div>${newVoucherBtn('journal')}</div><div class="card"><header><div class="row">${searchBox('vTbl')}${dateFilter('journal', fyDef())}</div>${exportBtns('journal', t.rep)}</header>${t.html}</div>`, title: 'Journal Entries' };
};

/* statements */
PAGES.trial = () => {
  const fy = E.getYear(db); const tb = E.trialBalance(db, fy.id);
  const rep = { title: 'Trial Balance', period: `FY ${fy.id} as on ${dt(fy.end)}`, cols: [{ h: 'Ledger' }, { h: 'Group' }, { h: 'Debit', t: 'money' }, { h: 'Credit', t: 'money' }], rows: tb.rows.sort((a, b) => a.group.localeCompare(b.group) || a.acc.name.localeCompare(b.acc.name)).map(r => [r.acc.name, r.group, r.dr, r.cr]), foot: ['Total', '', tb.dr, tb.cr] };
  return { html: `<div class="page-head"><div><h2>Trial balance</h2><p>FY ${fy.id}. Balance-sheet ledgers run from the start of your books; income and expense ledgers cover this year only.</p></div></div><div class="banner ${tb.ok ? 'good' : 'bad'}" style="margin-bottom:16px"><div><b>${tb.ok ? 'Trial balance tallies' : 'Trial balance does not tally'}</b><div class="small">Debit ${inr(tb.dr)} · Credit ${inr(tb.cr)}</div></div></div><div class="card"><header>${searchBox('tbTbl')}${exportBtns('trial', rep)}</header>${dataTable(rep, { id: 'tbTbl', emptyTitle: 'No balances yet' })}</div>`, title: 'Trial Balance' };
};
function plRows(pl) {
  const r = [];
  const add = (h, a, bold) => r.push([h, a, bold ? 1 : 0]);
  add('Sales (excl. GST)', pl.salesGross); if (pl.salesRet) add('Less: Sales returns', -pl.salesRet); add('Net sales', pl.netSales, 1);
  pl.directInc.forEach(x => add(x.name, x.amt)); add('Less: Cost of goods sold', -pl.cogs); pl.directExp.forEach(x => add('Less: ' + x.name, -x.amt));
  add('Gross profit', pl.gross, 1);
  pl.indInc.forEach(x => add(x.name, x.amt)); pl.indExp.forEach(x => add('Less: ' + x.name, -x.amt));
  add(pl.netProfit >= 0 ? 'Net profit' : 'Net loss', pl.netProfit, 1);
  return r;
}
PAGES.pnl = () => {
  const f = ui.f.pnl = ui.f.pnl || { ...fyDef() }; const pl = E.profitLoss(db, f.from, f.to); const rows = plRows(pl);
  const rep = { title: 'Profit & Loss Account', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Particulars' }, { h: 'Amount', t: 'money' }], rows: rows.map(r => [r[0], r[1]]) };
  return { html: `<div class="page-head"><div><h2>Profit & loss account</h2><p>Sales less cost of goods sold and expenses, from posted vouchers only.</p></div></div>
  <div class="banner ${pl.netProfit >= 0 ? 'good' : 'bad'}" style="margin-bottom:16px"><div><b>${pl.netProfit >= 0 ? 'Net profit' : 'Net loss'}: ${inr(Math.abs(pl.netProfit))}</b><div class="small">Gross profit ${inr(pl.gross)}${pl.netSales ? ` (${E.r2(pl.gross / pl.netSales * 100)}% of net sales)` : ''}</div></div></div>
  <div class="card"><header>${dateFilter('pnl', fyDef())}${exportBtns('pnl', rep)}</header><div class="scroll"><table class="tbl"><tbody>${rows.map(r => `<tr style="${r[2] ? 'font-weight:600;background:var(--surface-2)' : ''}"><td>${esc(r[0])}</td><td class="num mono ${r[1] < 0 ? 'bad' : ''}">${nf(r[1])}</td></tr>`).join('')}</tbody></table></div></div>`, title: 'Profit & Loss' };
};
function bsRows(bs) {
  const L = [], A = [];
  const wanted = ['Capital Account', 'Loans (Liability)', 'Current Liabilities', 'Sundry Creditors', 'Duties & Taxes (Output)'];
  const gs = (list, order) => list.slice().sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  gs(bs.liabs, wanted).forEach(g => { L.push({ h: g.group, amt: g.total, head: 1 }); g.items.forEach(i => L.push({ h: i.name, amt: i.amt })); if (g.group === 'Capital Account') bs.extra.forEach(x => L.push({ h: x.name, amt: x.amt })); });
  if (!bs.liabs.find(g => g.group === 'Capital Account')) { L.unshift({ h: 'Capital Account', amt: 0, head: 1 }); bs.extra.forEach(x => L.splice(1, 0, { h: x.name, amt: x.amt })); }
  const aorder = ['Fixed Assets', 'Stock-in-Hand', 'Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts', 'Duties & Taxes (Input)', 'Current Assets'];
  gs(bs.assets, aorder).forEach(g => { A.push({ h: g.group, amt: g.total, head: 1 }); g.items.forEach(i => A.push({ h: i.name, amt: i.amt })); });
  return { L, A };
}
PAGES.bsheet = () => {
  const fy = E.getYear(db); const f = ui.f.bsheet = ui.f.bsheet || { on: fy.end }; if (f.on < fy.start || f.on > fy.end) f.on = fy.end;
  const bs = E.balanceSheet(db, fy.id, f.on); const { L, A } = bsRows(bs);
  const flat = []; const n = Math.max(L.length, A.length);
  const rep = { title: 'Balance Sheet', period: 'as on ' + dt(f.on), cols: [{ h: 'Liabilities & capital' }, { h: 'Amount', t: 'money' }, { h: 'Assets' }, { h: 'Amount', t: 'money' }], rows: Array.from({ length: n }, (_, i) => [L[i] ? L[i].h : '', L[i] ? L[i].amt : '', A[i] ? A[i].h : '', A[i] ? A[i].amt : '']), foot: ['Total', bs.totalLiab, 'Total', bs.totalAssets] };
  const side = (rows, total, label) => `<div class="card"><header><h2>${label}</h2></header><div class="scroll"><table class="tbl"><tbody>${rows.map(r => `<tr style="${r.head ? 'font-weight:600;background:var(--surface-2)' : ''}"><td style="${r.head ? '' : 'padding-left:26px'}">${esc(r.h)}</td><td class="num mono ${r.amt < 0 ? 'bad' : ''}">${nf(r.amt)}</td></tr>`).join('') || '<tr><td class="muted">Nothing yet</td><td></td></tr>'}</tbody><tfoot><tr><td>Total</td><td class="num mono">${nf(total)}</td></tr></tfoot></table></div></div>`;
  return { html: `<div class="page-head"><div><h2>Balance sheet</h2><p>What the business owns and owes as on a date in FY ${fy.id}.</p></div></div><div class="banner ${bs.ok ? 'good' : 'bad'}" style="margin-bottom:16px"><div><b>${bs.ok ? 'Balance sheet tallies' : 'Balance sheet does not tally'}</b><div class="small">Assets ${inr(bs.totalAssets)} · Liabilities and capital ${inr(bs.totalLiab)}</div></div></div>
  <div class="row" style="margin-bottom:12px"><label class="f" style="flex-direction:row;align-items:center;gap:8px">As on <input type="date" data-f="bsheet.on" value="${f.on}" min="${fy.start}" max="${fy.end}" style="width:160px"></label>${exportBtns('bsheet', rep)}</div><div class="grid g2">${side(L, bs.totalLiab, 'Liabilities & capital')}${side(A, bs.totalAssets, 'Assets')}</div>`, title: 'Balance Sheet' };
};

/* ---------- GST ---------- */
PAGES.gst = () => {
  const f = ui.f.gst = ui.f.gst || { ...fyDef(), tab: 'summary' }; const g = E.gstData(db, f.from, f.to); const s = S();
  let body = '';
  const reg = (list, sales) => ({ cols: [{ h: 'Date', t: 'date' }, { h: 'Number' }, ...(sales ? [] : [{ h: 'Supplier bill' }]), { h: 'Party' }, { h: 'GSTIN' }, { h: 'Type' }, { h: 'Taxable', t: 'money' }, { h: 'CGST', t: 'money' }, { h: 'SGST', t: 'money' }, { h: 'IGST', t: 'money' }, { h: 'Total', t: 'money' }], rows: list.map(v => { const sg = g.sgn(v); const p = v.party ? E.party(db, v.party) : null; return [v.date, v.no, ...(sales ? [] : [v.refNo || '']), partyName(v), p ? p.gstin : '', v.inter ? 'IGST' : 'CGST+SGST', sg * v.taxable, sg * v.cgst, sg * v.sgst, sg * v.igst, sg * v.total]; }) });
  const tot = (r, sales) => { r.foot = [...Array(sales ? 5 : 6).fill('').map((x, i) => i === (sales ? 3 : 4) ? 'Total' : ''), '', E.r2(r.rows.reduce((a, x) => a + x[x.length - 5], 0)), E.r2(r.rows.reduce((a, x) => a + x[x.length - 4], 0)), E.r2(r.rows.reduce((a, x) => a + x[x.length - 3], 0)), E.r2(r.rows.reduce((a, x) => a + x[x.length - 2], 0)), E.r2(r.rows.reduce((a, x) => a + x[x.length - 1], 0))]; return r; };
  if (f.tab === 'summary') {
    const months = E.monthKeys(E.getYear(db)).map(m => { const d = E.gstData(db, m.from, m.to); return [m.label + ' ' + m.from.slice(0, 4), d.outTax, d.itcTax, d.payable]; });
    const rep = { title: 'GST Tax Summary', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Tax head' }, { h: 'Output GST (sales)', t: 'money' }, { h: 'Input tax credit (purchases)', t: 'money' }, { h: 'Net payable / (credit)', t: 'money' }], rows: [['CGST', g.out.cgst, g.itc.cgst, E.r2(g.out.cgst - g.itc.cgst)], ['SGST', g.out.sgst, g.itc.sgst, E.r2(g.out.sgst - g.itc.sgst)], ['IGST', g.out.igst, g.itc.igst, E.r2(g.out.igst - g.itc.igst)]], foot: ['Total', g.outTax, g.itcTax, g.payable] };
    const mrep = { title: 'GST Month-wise', period: 'FY ' + db.fy, cols: [{ h: 'Month' }, { h: 'Output GST', t: 'money' }, { h: 'Input tax credit', t: 'money' }, { h: 'Net payable', t: 'money' }], rows: months };
    body = `<div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><span class="l">Output GST (collected on sales)</span><span class="v">${inr(g.outTax)}</span><span class="s">On taxable sales of ${inr(g.out.taxable)}</span></div><div class="card kpi"><span class="l">Input tax credit (paid on purchases)</span><span class="v">${inr(g.itcTax)}</span><span class="s">On taxable purchases of ${inr(g.itc.taxable)}</span></div><div class="card kpi"><span class="l">${g.payable >= 0 ? 'Net GST payable' : 'Net credit carried forward'}</span><span class="v ${g.payable > 0 ? 'bad' : 'good'}">${inr(Math.abs(g.payable))}</span><span class="s">Output minus input credit</span></div></div>
    <div class="card" style="margin-bottom:16px"><header><h2>Tax summary</h2>${exportBtns('gstsum', rep)}</header>${dataTable(rep)}</div><div class="card"><header><h2>Month-wise</h2>${exportBtns('gstmon', mrep)}</header>${dataTable(mrep)}</div>`;
  } else if (f.tab === 'sales') {
    const r = tot(reg(g.sales, true), true); const rep = { title: 'GST Sales Register', period: `${dt(f.from)} to ${dt(f.to)}`, ...r };
    body = `<div class="card"><header><h2>Sales register (output GST)</h2>${exportBtns('gstsales', rep)}</header>${dataTable(rep, { emptyTitle: 'No sales in this period' })}<div class="body small muted">Credit notes are shown as negative entries.</div></div>`;
  } else if (f.tab === 'purchase') {
    const r = tot(reg(g.purch, false), false); const rep = { title: 'GST Purchase Register', period: `${dt(f.from)} to ${dt(f.to)}`, ...r };
    body = `<div class="card"><header><h2>Purchase register (input tax credit)</h2>${exportBtns('gstpur', rep)}</header>${dataTable(rep, { emptyTitle: 'No purchases in this period' })}<div class="body small muted">Debit notes are shown as negative entries.</div></div>`;
  } else {
    const rep = { title: 'HSN Summary', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Direction' }, { h: 'HSN' }, { h: 'GST %', t: 'qty' }, { h: 'Quantity', t: 'qty' }, { h: 'Taxable', t: 'money' }, { h: 'CGST', t: 'money' }, { h: 'SGST', t: 'money' }, { h: 'IGST', t: 'money' }], rows: g.hsn.map(h => [h.dir, h.hsn, h.rate, h.qty, h.taxable, h.cgst, h.sgst, h.igst]) };
    body = `<div class="card"><header><h2>HSN-wise summary</h2>${exportBtns('gsthsn', rep)}</header>${dataTable(rep, { emptyTitle: 'No data' })}</div>`;
  }
  const warn = !s.gstin ? `<div class="notice" style="margin-bottom:16px">Your GSTIN is not set. Add it in <a href="#settings" data-act="nav" data-page="settings">Settings</a> so it prints on invoices and reports.</div>` : '';
  return { html: `<div class="page-head"><div><h2>GST & tax</h2><p>${s.gstin ? 'GSTIN ' + esc(s.gstin) : ''}${s.pan ? ' · PAN ' + esc(s.pan) : ''}${s.state ? ' · ' + esc(s.state) : ''}</p></div>${dateFilter('gst', fyDef())}</div>${warn}<div class="tabs" role="tablist">${[['summary', 'Tax summary'], ['sales', 'Sales register'], ['purchase', 'Purchase register'], ['hsn', 'HSN summary']].map(([k, l]) => `<button role="tab" aria-selected="${f.tab === k}" data-act="tab" data-key="gst" data-v="${k}">${l}</button>`).join('')}</div>${body}`, title: 'GST' };
};

/* ---------- expenses ---------- */
PAGES.expenses = () => {
  const f = ui.f.expenses = ui.f.expenses || { ...fyDef(), cat: '' };
  const all = db.vouchers.filter(v => v.type === 'expense' && v.status !== 'cancelled' && inRange(v, f));
  const list = db.vouchers.filter(v => v.type === 'expense' && inRange(v, f) && (!f.cat || v.expAcc === f.cat)).sort((a, b) => b.date.localeCompare(a.date));
  const cats = {}; all.forEach(v => { const n = (E.acc(db, v.expAcc) || {}).name; cats[n] = (cats[n] || 0) + v.amount; });
  const bars = Object.entries(cats).map(([name, amt]) => ({ name, amt: E.r2(amt) })).sort((a, b) => b.amt - a.amt);
  const expAccs = db.accounts.filter(a => E.nature(db, a.id) === 'E' && !['COGS', 'ROUNDOFF', 'STOCK_ADJ'].includes(a.id));
  const rep = { title: 'Expense Report', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Date', t: 'date' }, { h: 'Number' }, { h: 'Category' }, { h: 'Description' }, { h: 'Mode' }, { h: 'Amount', t: 'money' }], rows: list.filter(v => v.status !== 'cancelled').map(v => [v.date, v.no, (E.acc(db, v.expAcc) || {}).name, v.narr || '', (v.mode || '').toUpperCase(), v.amount]), foot: ['', '', '', '', 'Total', sumBy(list.filter(v => v.status !== 'cancelled'), v => v.amount)] };
  return { html: `<div class="page-head"><div><h2>Expenses</h2><p>Rent, electricity, salaries, transport and everything else you pay to run the business.</p></div>${btn('Add expense', 'voucher-form', { cls: 'primary', icon: 'plus', d: { type: 'expense' } })}</div>
  <div class="grid g2" style="margin-bottom:16px"><div class="card kpi"><span class="l">Total expenses</span><span class="v">${inr(sumBy(all, v => v.amount))}</span><span class="s">${all.length} entries in the selected period</span></div><div class="card"><div class="body">${bars.length ? hbars(bars) : '<span class="muted">No expenses recorded in this period.</span>'}</div></div></div>
  <div class="card"><header><div class="row">${searchBox('expTbl', 'Search description')}${dateFilter('expenses', fyDef())}<select data-f="expenses.cat" style="width:auto" aria-label="Category">${opts(expAccs.map(a => [a.id, a.name]), f.cat, 'All categories')}</select></div>${exportBtns('expenses', rep)}</header>${list.length ? `<div class="scroll"><table class="tbl" id="expTbl"><thead><tr><th>Date</th><th>Number</th><th>Category</th><th>Description</th><th>Mode</th><th class="num">Amount</th></tr></thead><tbody>${list.map(v => `<tr class="click ${v.status === 'cancelled' ? 'cancelled' : ''}" data-act="view-voucher" data-id="${v.id}"><td class="nowrap">${dt(v.date)}</td><td class="mono">${esc(v.no)}</td><td>${esc((E.acc(db, v.expAcc) || {}).name)}</td><td>${esc(v.narr || '')}</td><td>${esc((v.mode || '').toUpperCase())}</td><td class="num mono">${nf(v.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No expenses</b>Add an expense to see it here.</div>'}</div>`, title: 'Expenses' };
};

/* ---------- reports ---------- */
const REPORTS = {
  daily: { t: 'Daily Sales Report', d: 'Sales by day with how each day was paid.', p: 'range', build(f) {
    const m = {}; db.vouchers.filter(v => v.type === 'sale' && v.status !== 'cancelled' && inRange(v, f)).forEach(v => { const r = m[v.date] || (m[v.date] = { n: 0, tx: 0, gst: 0, tot: 0, cash: 0, upi: 0, bank: 0, cr: 0 }); r.n++; r.tx += v.taxable; r.gst += v.cgst + v.sgst + v.igst; r.tot += v.total; if (v.mode === 'cash') r.cash += v.paid; else if (v.mode === 'upi') r.upi += v.paid; else if (v.mode === 'bank') r.bank += v.paid; r.cr += v.total - v.paid; });
    const rows = Object.keys(m).sort().map(d => { const r = m[d]; return [d, r.n, E.r2(r.tx), E.r2(r.gst), E.r2(r.tot), E.r2(r.cash), E.r2(r.upi), E.r2(r.bank), E.r2(r.cr)]; });
    return { cols: [{ h: 'Date', t: 'date' }, { h: 'Invoices', t: 'qty' }, { h: 'Taxable', t: 'money' }, { h: 'GST', t: 'money' }, { h: 'Total', t: 'money' }, { h: 'Cash', t: 'money' }, { h: 'UPI', t: 'money' }, { h: 'Bank', t: 'money' }, { h: 'On credit', t: 'money' }], rows, foot: ['Total', ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => sumBy(rows, r => r[i]))] };
  } },
  monthly: { t: 'Monthly Sales Report', d: 'Month-wise sales, returns and net sales for the year.', p: 'fy', build() {
    const fy = E.getYear(db); const rows = E.monthKeys(fy).map(m => { const vs = E.live(db).filter(v => v.date >= m.from && v.date <= m.to); const s = vs.filter(v => v.type === 'sale'), c = vs.filter(v => v.type === 'creditnote'); return [m.label + ' ' + m.from.slice(0, 4), s.length, sumBy(s, v => v.taxable), sumBy(s, v => v.cgst + v.sgst + v.igst), sumBy(s, v => v.total), sumBy(c, v => v.taxable), E.r2(sumBy(s, v => v.taxable) - sumBy(c, v => v.taxable))]; });
    return { cols: [{ h: 'Month' }, { h: 'Invoices', t: 'qty' }, { h: 'Taxable', t: 'money' }, { h: 'GST', t: 'money' }, { h: 'Invoice total', t: 'money' }, { h: 'Returns', t: 'money' }, { h: 'Net sales', t: 'money' }], rows, foot: ['Total', ...[1, 2, 3, 4, 5, 6].map(i => sumBy(rows, r => r[i]))] };
  } },
  purchase: { t: 'Purchase Report', d: 'All purchase bills with supplier, GST and payment status.', p: 'range', build(f) {
    const rows = db.vouchers.filter(v => v.type === 'purchase' && v.status !== 'cancelled' && inRange(v, f)).sort((a, b) => a.date.localeCompare(b.date)).map(v => { const st = E.invoiceStatus(db, v); return [v.date, v.no, v.refNo, partyName(v), v.taxable, E.r2(v.cgst + v.sgst + v.igst), v.total, st.paid, st.balance]; });
    return { cols: [{ h: 'Date', t: 'date' }, { h: 'Number' }, { h: 'Supplier bill' }, { h: 'Supplier' }, { h: 'Taxable', t: 'money' }, { h: 'GST', t: 'money' }, { h: 'Total', t: 'money' }, { h: 'Paid', t: 'money' }, { h: 'Balance', t: 'money' }], rows, foot: ['', '', '', 'Total', ...[4, 5, 6, 7, 8].map(i => sumBy(rows, r => r[i]))] };
  } },
  stock: { t: 'Stock Report', d: 'Quantity and value of every product on hand.', p: 'none', build() {
    const rows = db.products.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.code, p.name, p.category, p.qty, p.min, p.qty > 0 ? E.r2(p.value / p.qty) : 0, p.value, p.qty <= 0 ? 'Out of stock' : (p.min > 0 && p.qty <= p.min) ? 'Low' : 'OK']);
    return { cols: [{ h: 'Code' }, { h: 'Product' }, { h: 'Category' }, { h: 'Qty', t: 'qty' }, { h: 'Min', t: 'qty' }, { h: 'Avg cost', t: 'money' }, { h: 'Stock value', t: 'money' }, { h: 'Status' }], rows, foot: ['', 'Total', '', sumBy(rows, r => r[3]), '', '', sumBy(rows, r => r[6]), ''] };
  } },
  custout: { t: 'Customer Outstanding Report', d: 'Who owes you money and since when.', p: 'none', build() { return outstandingRep('customer'); } },
  supout: { t: 'Supplier Outstanding Report', d: 'What you owe each supplier.', p: 'none', build() { return outstandingRep('supplier'); } },
  expense: { t: 'Expense Report', d: 'Expenses by category and by entry.', p: 'range', build(f) {
    const rows = db.vouchers.filter(v => v.type === 'expense' && v.status !== 'cancelled' && inRange(v, f)).sort((a, b) => a.date.localeCompare(b.date)).map(v => [v.date, v.no, (E.acc(db, v.expAcc) || {}).name, v.narr || '', (v.mode || '').toUpperCase(), v.amount]);
    return { cols: [{ h: 'Date', t: 'date' }, { h: 'Number' }, { h: 'Category' }, { h: 'Description' }, { h: 'Mode' }, { h: 'Amount', t: 'money' }], rows, foot: ['', '', '', '', 'Total', sumBy(rows, r => r[5])] };
  } },
  gst: { t: 'GST Report', d: 'Output tax and input credit by GST rate, with net payable.', p: 'range', build(f) {
    const g = E.gstData(db, f.from, f.to); const m = {};
    for (const v of [...g.sales, ...g.purch]) { const out = v.type === 'sale' || v.type === 'creditnote'; for (const l of v.lines) { const k = (out ? 'Output' : 'Input credit') + '|' + l.gst; const r = m[k] || (m[k] = [out ? 'Output' : 'Input credit', l.gst, 0, 0, 0, 0]); const s = g.sgn(v); r[2] += s * l.taxable; r[3] += s * l.cgst; r[4] += s * l.sgst; r[5] += s * l.igst; } }
    const rows = Object.values(m).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]).map(r => [r[0], r[1], E.r2(r[2]), E.r2(r[3]), E.r2(r[4]), E.r2(r[5]), E.r2(r[3] + r[4] + r[5])]);
    rows.push(['Net GST payable (output minus input credit)', '', '', E.r2(g.out.cgst - g.itc.cgst), E.r2(g.out.sgst - g.itc.sgst), E.r2(g.out.igst - g.itc.igst), g.payable]);
    return { cols: [{ h: 'Type' }, { h: 'GST %', t: 'qty' }, { h: 'Taxable', t: 'money' }, { h: 'CGST', t: 'money' }, { h: 'SGST', t: 'money' }, { h: 'IGST', t: 'money' }, { h: 'Total tax', t: 'money' }], rows };
  } },
  pnl: { t: 'Profit & Loss Report', d: 'Income, cost of goods and expenses with net result.', p: 'range', build(f) { const pl = E.profitLoss(db, f.from, f.to); return { cols: [{ h: 'Particulars' }, { h: 'Amount', t: 'money' }], rows: plRows(pl).map(r => [r[0], r[1]]) }; } },
  bs: { t: 'Balance Sheet', d: 'Assets, liabilities and capital at year end.', p: 'fy', build() { const fy = E.getYear(db); const bs = E.balanceSheet(db, fy.id); const { L, A } = bsRows(bs); const n = Math.max(L.length, A.length); return { cols: [{ h: 'Liabilities & capital' }, { h: 'Amount', t: 'money' }, { h: 'Assets' }, { h: 'Amount', t: 'money' }], rows: Array.from({ length: n }, (_, i) => [L[i] ? L[i].h : '', L[i] ? L[i].amt : '', A[i] ? A[i].h : '', A[i] ? A[i].amt : '']), foot: ['Total', bs.totalLiab, 'Total', bs.totalAssets] }; } },
  cash: { t: 'Cash Flow Report', d: 'Money in and out of cash and bank, month by month.', p: 'fy', build() {
    const cf = E.cashFlow(db, db.fy); const rows = [['Opening cash and bank', '', '', cf.opening], ...cf.monthly.map(m => [m.label + ' ' + m.from.slice(0, 4), m.inflow, m.outflow, m.closing]), ['Total for the year', cf.inflow, cf.outflow, cf.closing]];
    cf.byType.forEach(b => rows.push(['  ' + TYPE_LABEL[b.type], b.inflow, b.outflow, '']));
    return { cols: [{ h: 'Period / source' }, { h: 'Cash in', t: 'money' }, { h: 'Cash out', t: 'money' }, { h: 'Closing balance', t: 'money' }], rows };
  } },
};
function outstandingRep(type) {
  const fy = E.getYear(db); const cust = type === 'customer';
  const rows = E.outstanding(db, type, fy.end).filter(r => cust ? r.bal > 0 : r.bal < 0).map(r => { const s = E.partySummary(db, r.p.id, null, fy.end); const last = s.rows.length ? s.rows[s.rows.length - 1].date : ''; return [r.p.name, r.p.mobile, last, Math.abs(r.bal)]; }).sort((a, b) => b[3] - a[3]);
  return { cols: [{ h: cust ? 'Customer' : 'Supplier' }, { h: 'Mobile' }, { h: 'Last activity', t: 'date' }, { h: cust ? 'To collect' : 'To pay', t: 'money' }], rows, foot: ['Total', '', '', sumBy(rows, r => r[3])] };
}
PAGES.reports = () => {
  const f = ui.f.reports = ui.f.reports || { ...fyDef(), which: '' }; const R = REPORTS[f.which];
  let body;
  if (!R) body = `<div class="grid g-auto">${Object.entries(REPORTS).map(([k, r]) => `<button type="button" class="card body" style="text-align:left;cursor:pointer" data-act="open-report" data-id="${k}"><b>${r.t}</b><div class="small muted" style="margin-top:4px">${r.d}</div></button>`).join('')}</div>`;
  else {
    const rep = R.build(f); rep.title = R.t; rep.period = R.p === 'range' ? `${dt(f.from)} to ${dt(f.to)}` : (R.p === 'fy' ? 'FY ' + db.fy : 'as on ' + dt(E.todayISO()));
    body = `<div class="card"><header><div class="row">${btn('All reports', 'open-report', { d: { id: '' } })}<b>${R.t}</b>${R.p === 'range' ? dateFilter('reports', fyDef()) : ''}</div>${exportBtns('report', rep)}</header>${dataTable(rep, { emptyTitle: 'No data for this selection', empty: 'Post some transactions or widen the date range.' })}</div>`;
  }
  return { html: `<div class="page-head"><div><h2>Reports</h2><p>Every figure comes from your posted vouchers. Export any report as PDF, Excel or CSV.</p></div></div>${body}`, title: 'Reports' };
};

/* ---------- settings ---------- */
const openingOf = id => { const v = db.vouchers.find(x => x.type === 'opening' && x.ref === 'acc:' + id); if (!v) return { amt: 0, type: 'Dr' }; const e = v.entries.find(x => x.acc === id); return { amt: e ? (e.dr || e.cr) : 0, type: e && e.cr ? 'Cr' : 'Dr' }; };
PAGES.settings = () => {
  const f = ui.f.settings = ui.f.settings || { tab: 'business' }; const s = S(); let body = '';
  const form = (name, inner, label) => `<form data-form="${name}" novalidate class="stack">${inner}<div><button class="btn primary" type="submit">${label || 'Save settings'}</button></div></form>`;
  if (f.tab === 'business') body = form('set-business', `<div class="grid g2">${field('Business name', `<input name="businessName" value="${val(s, 'businessName')}">`, { req: 1 })}${field('Owner name', `<input name="ownerName" value="${val(s, 'ownerName')}">`)}${field('Nature of business', `<input name="tradeType" value="${val(s, 'tradeType')}">`)}${field('Mobile', `<input name="mobile" inputmode="numeric" maxlength="10" value="${val(s, 'mobile')}">`)}${field('Email', `<input name="email" type="email" value="${val(s, 'email')}">`)}${field('Address', `<input name="address" value="${val(s, 'address')}">`)}${field('City', `<input name="city" value="${val(s, 'city')}">`)}${field('PIN code', `<input name="pincode" inputmode="numeric" maxlength="6" value="${val(s, 'pincode')}">`)}${field('State', `<select name="stateCode">${stateOpts(s.stateCode)}</select>`, { req: 1, hint: 'Decides CGST/SGST or IGST on every invoice.' })}</div>
    <div class="row">${s.logo ? `<img src="${s.logo}" alt="Logo" style="width:64px;height:64px;object-fit:contain;border:1px solid var(--line);border-radius:6px;background:#fff">` : ''}<label class="btn" style="cursor:pointer">${s.logo ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg" data-act-change="logo-file" hidden></label>${s.logo ? btn('Remove logo', 'remove-logo') : ''}<span class="small muted">PNG or JPG. Printed on invoices.</span></div>`);
  else if (f.tab === 'registrations') body = form('set-reg', `<p class="muted" style="margin:0">These appear on invoices and tax reports. Leave blank anything that does not apply to you.</p><div class="grid g2">${field('GSTIN', `<input name="gstin" maxlength="15" style="text-transform:uppercase" value="${val(s, 'gstin')}" placeholder="27ABCDE1234F1Z5">`, { hint: 'First two digits must match your state.' })}${field('PAN', `<input name="pan" maxlength="10" style="text-transform:uppercase" value="${val(s, 'pan')}" placeholder="ABCDE1234F">`)}${field('Aadhaar number (owner)', `<input name="aadhaar" inputmode="numeric" maxlength="14" value="${val(s, 'aadhaar')}" placeholder="12 digits">`, { hint: 'Kept in this browser only. It is not printed on invoices.' })}${field('Udyam / MSME registration', `<input name="udyam" value="${val(s, 'udyam')}">`)}${field('TAN', `<input name="tan" maxlength="10" style="text-transform:uppercase" value="${val(s, 'tan')}">`)}${field('Shop / trade licence no.', `<input name="tradeLicense" value="${val(s, 'tradeLicense')}">`)}</div>`);
  else if (f.tab === 'invoice') body = form('set-invoice', `<div class="grid g3">${field('Invoice prefix', `<input name="invPrefix" maxlength="8" value="${val(s, 'invPrefix')}">`)}${field('Starting number', `<input name="invStart" type="number" min="1" value="${s.invStart}">`, { hint: 'Used for a financial year with no invoices yet.' })}${field('Digits in number', `<input name="invPad" type="number" min="1" max="8" value="${s.invPad}">`)}</div><label class="row" style="gap:8px"><input type="checkbox" name="invWithFY" ${s.invWithFY !== false ? 'checked' : ''}> Include the financial year in the number (${esc(s.invPrefix || 'INV')}/${esc(db.fy)}/${'1'.padStart(s.invPad || 4, '0')})</label><div class="notice info">Next invoice number: <b class="mono">${esc((() => { const k = 'sale|' + db.fy; const n = (db.counters[k] || (Math.max(1, +s.invStart || 1) - 1)) + 1; const w = Math.max(1, +s.invPad || 4); return s.invWithFY !== false ? `${s.invPrefix}/${db.fy}/${String(n).padStart(w, '0')}` : `${s.invPrefix}/${String(n).padStart(w, '0')}`; })())}</b></div>
    <div class="grid g2">${field('GST rates (comma separated)', `<input name="gstRates" value="${esc(s.gstRates.join(', '))}">`, { hint: 'For example 0, 5, 12, 18, 28.' })}${field('Currency', `<input value="Indian Rupees (₹)" disabled>`)}</div>${field('Terms & conditions on invoice', `<textarea name="terms">${esc(s.terms)}</textarea>`)}${field('Footer line', `<input name="footer" value="${val(s, 'footer')}">`)}<label class="row" style="gap:8px"><input type="checkbox" name="allowNegative" ${s.allowNegative ? 'checked' : ''}> Allow selling more than the stock on hand</label>`);
  else if (f.tab === 'bank') { const oc = openingOf('CASH'), ob = openingOf('BANK'); body = form('set-bank', `<div class="grid g2">${field('Bank name', `<input name="bankName" value="${val(s, 'bankName')}">`)}${field('Branch', `<input name="branch" value="${val(s, 'branch')}">`)}${field('Account number', `<input name="accountNo" inputmode="numeric" value="${val(s, 'accountNo')}">`)}${field('IFSC', `<input name="ifsc" maxlength="11" style="text-transform:uppercase" value="${val(s, 'ifsc')}">`)}${field('UPI ID', `<input name="upi" value="${val(s, 'upi')}" placeholder="name@bank">`, { hint: 'Printed on invoices and shared with payment reminders.' })}</div><h3 style="margin:8px 0 0;font-size:14px">Opening balances</h3><p class="small muted" style="margin:0">Cash and bank balances at the start of your books. Changing them re-posts the opening entry.</p><div class="grid g2">${field('Opening cash in hand (₹)', `<input name="openCash" type="number" min="0" step="any" value="${oc.amt || ''}">`)}${field('Opening bank balance (₹)', `<input name="openBank" type="number" min="0" step="any" value="${ob.amt || ''}">`)}</div>`); }
  else if (f.tab === 'years') body = `<div class="scroll"><table class="tbl"><thead><tr><th>Accounting year</th><th>Period</th><th>Status</th><th>Vouchers</th><th></th></tr></thead><tbody>${db.years.map(y => `<tr><td><b>${y.id}</b></td><td>${dt(y.start)} to ${dt(y.end)}</td><td>${y.id === db.fy ? chip('Active', 'good') + ' ' : ''}${y.locked ? chip('Closed', 'gray') : chip('Open')}</td><td class="mono">${db.vouchers.filter(v => v.fy === y.id && v.type !== 'opening').length}</td><td class="nowrap">${y.id !== db.fy ? btn('Make active', 'fy-set', { cls: 'sm', d: { id: y.id } }) : ''} ${btn(y.locked ? 'Reopen' : 'Close year', 'fy-lock', { cls: 'sm', d: { id: y.id } })}</td></tr>`).join('')}</tbody></table></div>
    <form data-form="fy-add" class="row" style="margin-top:16px;align-items:flex-end">${field('Add accounting year starting 1 April', `<input name="year" type="number" min="1990" max="2100" placeholder="${+db.years[db.years.length - 1].start.slice(0, 4) + 1}" style="width:150px">`)}<button class="btn primary" type="submit">${ic('plus')}Create year</button></form>
    <div class="notice info" style="margin-top:14px">Balances, stock and outstanding amounts carry forward automatically into a new year, while sales, expenses and profit start from zero. Closing a year blocks new entries and edits in it.</div>`;
  else if (f.tab === 'users') body = `<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th></th></tr></thead><tbody>${db.users.map(u => `<tr><td>${esc(u.name)}</td><td class="mono">${esc(u.username)}</td><td>${chip(u.role, u.role === 'admin' ? '' : 'gray')}</td><td class="nowrap">${btn('Reset PIN', 'user-pin', { cls: 'sm', d: { id: u.id } })} ${u.id !== ui.user.id ? btn('Remove', 'user-del', { cls: 'sm danger', d: { id: u.id } }) : ''}</td></tr>`).join('')}</tbody></table></div><div style="margin-top:14px">${btn('Add user', 'user-add', { cls: 'primary', icon: 'plus' })}</div><div class="notice info" style="margin-top:14px"><b>Administrator</b> can do everything. <b>Staff</b> can create invoices, bills, receipts, expenses, products and parties, but cannot edit or cancel entries, see profit statements, GST or reports, or change settings.</div>`;
  else {
    const prev = (() => { try { return !!localStorage.getItem(KEY_PREV); } catch (e) { return false; } })();
    const hasTx = db.vouchers.some(v => v.type !== 'opening');
    body = `<div class="stack"><div class="notice">Your books are stored in this browser on this device. Download a backup after each working day, and before clearing browser data.</div>
    <div class="card"><div class="body row sp"><div><b>Download full backup</b><div class="small muted">All settings, parties, products, vouchers and users in one file.${ui.saved ? ' Last saved to this browser ' + ui.saved.toLocaleTimeString('en-IN') + '.' : ''}</div></div>${btn('Download backup', 'backup-download', { cls: 'primary', icon: 'download' })}</div></div>
    <div class="card"><div class="body row sp"><div><b>Restore from backup</b><div class="small muted">Replaces everything in this browser with the contents of a backup file.</div></div><label class="btn" style="cursor:pointer">Choose file<input type="file" accept=".json,application/json" data-act-change="restore-file" hidden></label></div></div>
    ${prev ? `<div class="card"><div class="body row sp"><div><b>Undo last restore or erase</b><div class="small muted">Brings back the data that was here before.</div></div>${btn('Undo', 'restore-prev')}</div></div>` : ''}
    <div class="card"><div class="body row sp"><div><b>${hasTx ? 'Erase transactions, parties and products' : 'Load sample data'}</b><div class="small muted">${hasTx ? 'Keeps business details, users and accounting years. A safety copy is kept for undo.' : 'Fills the books with example parties, products and a few months of transactions so you can explore.'}</div></div>${hasTx ? btn('Erase data', 'erase-data', { cls: 'danger' }) : btn('Load sample data', 'load-sample')}</div></div>
    <div class="card"><header><h2>Activity log</h2></header><div class="scroll" style="max-height:320px"><table class="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entry</th><th>Note</th></tr></thead><tbody>${db.audit.slice(-60).reverse().map(a => `<tr><td class="nowrap small">${new Date(a.t).toLocaleString('en-IN')}</td><td>${esc(a.user)}</td><td>${esc(a.action)}</td><td class="mono">${esc(a.voucher)}</td><td class="small muted">${esc(a.info)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing yet.</td></tr>'}</tbody></table></div></div></div>`;
  }
  const tabs = [['business', 'Business'], ['registrations', 'GST, PAN & Aadhaar'], ['invoice', 'Invoice & GST rates'], ['bank', 'Bank, UPI & opening balances'], ['years', 'Accounting years'], ['users', 'Users'], ['data', 'Backup & data']];
  return { html: `<div class="page-head"><div><h2>Settings</h2><p>Saved permanently in this browser. They are still here after you sign out and back in.</p></div></div><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${f.tab === k}" data-act="tab" data-key="settings" data-v="${k}">${l}</button>`).join('')}</div><div class="card"><div class="body">${body}</div></div>`, title: 'Settings' };
};

const FORMS = {
  async setup(f) { await doSetup(f); },
  async login(f) { await doLogin(f); },
  'set-business'(f) {
    const next = { ...S(), businessName: f.businessName.trim(), ownerName: f.ownerName.trim(), tradeType: f.tradeType.trim(), mobile: f.mobile.trim(), email: f.email.trim(), address: f.address.trim(), city: f.city.trim(), pincode: f.pincode.trim(), stateCode: f.stateCode, state: E.STATES[f.stateCode] || '' };
    const errs = E.checkBusiness(next); if (errs.length) return toast(errs[0], 'err');
    if (!f.stateCode) return toast('Choose your state. It decides CGST/SGST or IGST.', 'err');
    mutate(() => { db.settings = next; E.audit(db, 'settings', null, ui.user.name, 'business'); }, 'Business details saved.'); render();
  },
  'set-reg'(f) {
    const up = k => (f[k] || '').trim().toUpperCase(); const next = { ...S(), gstin: up('gstin'), pan: up('pan'), aadhaar: (f.aadhaar || '').replace(/\s/g, ''), udyam: f.udyam.trim(), tan: up('tan'), tradeLicense: f.tradeLicense.trim() };
    if (next.gstin && E.RX.gstin.test(next.gstin)) { next.stateCode = next.gstin.slice(0, 2); next.state = E.STATES[next.stateCode] || next.state; if (!E.STATES[next.stateCode]) return toast('The GSTIN starts with an unknown state code.', 'err'); }
    const errs = E.checkBusiness(next); if (errs.length) return toast(errs[0], 'err');
    mutate(() => { db.settings = next; E.audit(db, 'settings', null, ui.user.name, 'registrations'); }, 'Registrations saved.'); render();
  },
  'set-invoice'(f) {
    const rates = f.gstRates.split(',').map(x => x.trim()).filter(Boolean).map(Number);
    if (!rates.length || rates.some(r => !isFinite(r) || r < 0 || r > 100)) return toast('Enter GST rates as numbers, for example 0, 5, 12, 18, 28.', 'err');
    if (!f.invPrefix.trim()) return toast('Enter an invoice prefix.', 'err');
    const used = new Set(db.products.map(p => p.gst)); const missing = [...used].filter(r => !rates.includes(r)); if (missing.length) return toast(`Products still use ${missing.join('%, ')}%. Keep those rates in the list.`, 'err');
    mutate(() => { Object.assign(db.settings, { invPrefix: f.invPrefix.trim().toUpperCase(), invStart: Math.max(1, Math.floor(+f.invStart) || 1), invPad: Math.min(8, Math.max(1, Math.floor(+f.invPad) || 4)), invWithFY: !!f.invWithFY, gstRates: [...new Set(rates)].sort((a, b) => a - b), terms: f.terms, footer: f.footer, allowNegative: !!f.allowNegative }); E.audit(db, 'settings', null, ui.user.name, 'invoice'); }, 'Invoice settings saved.'); render();
  },
  'set-bank'(f) {
    const next = { ...S(), bankName: f.bankName.trim(), branch: f.branch.trim(), accountNo: f.accountNo.trim(), ifsc: (f.ifsc || '').trim().toUpperCase(), upi: f.upi.trim() };
    const errs = E.checkBusiness(next); if (errs.length) return toast(errs[0], 'err');
    if (next.upi && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(next.upi)) return toast('UPI ID should look like name@bank.', 'err');
    mutate(() => { db.settings = next; E.acc(db, 'BANK').name = next.bankName ? next.bankName + ' A/c' : 'Bank Account'; E.setOpening(db, 'acc', 'CASH', Math.abs(E.r2(+f.openCash || 0)), 'Dr'); E.setOpening(db, 'acc', 'BANK', Math.abs(E.r2(+f.openBank || 0)), 'Dr'); E.audit(db, 'settings', null, ui.user.name, 'bank'); }, 'Bank details saved.'); render();
  },
  'fy-add'(f) { if (mutate(() => E.addYear(db, +f.year || 0), 'Accounting year created.')) render(); },
};

/* ---------- actions ---------- */
function tryOpenParty(id) { ui.pid = id; go('party'); }
function downloadBackup() { saveFile(`${fileStem(S().businessName)}_backup_${E.todayISO()}.json`, JSON.stringify(db)); }
function validBackup(d) { return d && d.v === 1 && Array.isArray(d.vouchers) && Array.isArray(d.accounts) && Array.isArray(d.users) && Array.isArray(d.years) && d.settings && Array.isArray(d.products) && Array.isArray(d.parties); }
async function restoreText(text) {
  let d; try { d = JSON.parse(text); } catch (e) { return toast('That file is not a valid backup.', 'err'); }
  if (!validBackup(d)) return toast('That file is not a SHREE TRADERS backup.', 'err');
  const tb = d.vouchers.length; if (db && !(await confirmBox(`Restore this backup (${tb} entries, ${d.products.length} products, ${d.parties.length} parties)? Everything currently here will be replaced. You can undo this right after.`, 'Restore', true))) return;
  try { if (db) localStorage.setItem(KEY_PREV, JSON.stringify(db)); } catch (e) { }
  db = d; persist(); const u = db.users.find(x => ui.user && x.id === ui.user.id); ui.user = u || null; ui.f = {}; ui.draft = null; render(); toast('Backup restored.');
}
function checkTotalsAfterLoad() { try { const fy = E.getYear(db); return E.trialBalance(db, fy.id).ok; } catch (e) { return false; } }
const ACT = {
  nav(a) { ui.f.reports && (ui.f.reports.which = ''); go(a.dataset.page); },
  burger() { document.body.classList.toggle('nav-open'); },
  logout,
  lowstock() { ui.f.products = { ...(ui.f.products || {}), tab: 'items', low: true }; go('products'); },
  tab(a) { ui.f[a.dataset.key] = ui.f[a.dataset.key] || {}; ui.f[a.dataset.key].tab = a.dataset.v; render(); },
  'new-doc'(a) { const pre = a.dataset.party ? { party: a.dataset.party } : null; startDoc(a.dataset.type, null, pre); },
  'doc-cancel'() { const d = ui.draft; ui.draft = null; if (d && d.id) go('view', { vid: d.id }); else go(ui.from || 'dashboard'); },
  'doc-save': saveDoc,
  'add-line'() { ui.draft.lines.push({ pid: '', qty: 1, rate: 0, disc: 0, gst: S().gstRates.includes(18) ? 18 : S().gstRates[0] }); $('#lineBody').innerHTML = ui.draft.lines.map(lineRow).join(''); const sel = $$('#lineBody select[data-l$=".pid"]').pop(); if (sel) sel.focus(); },
  'del-line'(a) { ui.draft.lines.splice(+a.dataset.i, 1); $('#lineBody').innerHTML = ui.draft.lines.map(lineRow).join(''); refreshTotals(); },
  'quick-party'(a) { ui.afterParty = r => { ui.draft.party = r.id; render(); }; partyForm(a.dataset.ptype); },
  'view-voucher'(a) { ui.from = ui.from && PAGES[ui.page] && ui.page !== 'view' ? ui.page : (ui.from || 'dashboard'); if (ui.page !== 'view') ui.from = ui.page === 'doc' ? ui.from : ui.page; go('view', { vid: a.dataset.id }); },
  'edit-voucher'(a) { const v = db.vouchers.find(x => x.id === a.dataset.id); if (!v) return; if (DOC_TYPES.includes(v.type)) startDoc(v.type, v); else openVoucherForm(v.type, v); },
  'cancel-voucher'(a) {
    const v = db.vouchers.find(x => x.id === a.dataset.id); const extra = (v.type === 'sale' || v.type === 'purchase') && db.vouchers.some(x => x.against === v.id && x.status === 'active') ? '<p class="small warn">Receipts or notes linked to this entry will stay in the books as on-account amounts.</p>' : '';
    const sc = openModal('Cancel ' + TYPE_LABEL[v.type].toLowerCase() + ' ' + v.no, `<p style="margin-top:0">Cancelling reverses the ledger entries, stock and GST for this entry. The record stays in your history, marked as cancelled.</p>${extra}${field('Reason', `<input name="reason" placeholder="For example: wrong customer, duplicate entry">`)}`, { size: 'narrow', ok: 'Cancel entry' });
    sc._onSubmit = () => { const f = formData($('form', sc)); if (mutate(() => E.cancelVoucher(db, v.id, f.reason, ui.user.name), 'Entry cancelled. Books, stock and GST updated.')) { closeModal(sc); render(); } };
  },
  'invoice-pdf'(a) { const v = db.vouchers.find(x => x.id === a.dataset.id); if (v) invoicePDF(v); },
  'settle-invoice'(a) { const v = db.vouchers.find(x => x.id === a.dataset.id); const st = E.invoiceStatus(db, v); openVoucherForm(v.type === 'sale' ? 'receipt' : 'payment', null, { party: v.party, against: v.id, amount: st.balance }); },
  'voucher-form'(a) { openVoucherForm(a.dataset.type, null, a.dataset.party ? { party: a.dataset.party } : null); },
  'party-form'(a) { partyForm(a.dataset.ptype, a.dataset.id ? E.party(db, a.dataset.id) : null); },
  'open-party'(a) { tryOpenParty(a.dataset.id); },
  async 'delete-party'(a) { const p = E.party(db, a.dataset.id); if (await confirmBox(`Delete ${esc(p.name)}? This only works for parties with no transactions.`, 'Delete', true)) { if (mutate(() => E.deleteParty(db, p.id, ui.user.name), 'Party deleted.')) go('parties'); } },
  'product-form'(a) { productForm(a.dataset.id ? E.prod(db, a.dataset.id) : null); },
  async 'delete-product'(a) { const p = E.prod(db, a.dataset.id); if (await confirmBox(`Delete ${esc(p.name)}? This only works for products with no sales or purchases.`, 'Delete', true)) { if (mutate(() => E.deleteProduct(db, p.id, ui.user.name), 'Product deleted.')) render(); } },
  export(a) { exportRep(a.dataset.key, a.dataset.fmt); },
  'close-modal'() { closeModal(); },
  'modal-submit'(a) { const sc = a.closest('.scrim'); if (sc && sc._onSubmit) sc._onSubmit(); },
  'add-jrow'(a) { const sc = a.closest('.scrim'); $('#jBody', sc).insertAdjacentHTML('beforeend', jRow()); },
  'add-arow'(a) { const sc = a.closest('.scrim'); $('#aBody', sc).insertAdjacentHTML('beforeend', aRow()); },
  'del-row'(a) { const sc = a.closest('.scrim'); const tb = a.closest('tbody'); if (tb.children.length > 1) a.closest('tr').remove(); if (sc) jSum(sc); },
  'open-ledger'(a) { ui.accId = a.dataset.id; go('ledger'); },
  'ledger-form': ledgerForm,
  'open-report'(a) { ui.f.reports = ui.f.reports || { ...fyDef() }; ui.f.reports.which = a.dataset.id; render(); },
  'remove-logo'() { mutate(() => { db.settings.logo = ''; }, 'Logo removed.'); render(); },
  'fy-set'(a) { db.fy = a.dataset.id; persist(); ui.f = { settings: ui.f.settings }; render(); toast('Active year is now ' + db.fy); },
  async 'fy-lock'(a) { const y = E.getYear(db, a.dataset.id); const lock = !y.locked; if (lock && !(await confirmBox(`Close ${y.id}? No one can add, edit or cancel entries dated in this year until it is reopened.`, 'Close year'))) return; mutate(() => { y.locked = lock; E.audit(db, lock ? 'close-year' : 'reopen-year', null, ui.user.name, y.id); }, lock ? 'Year closed.' : 'Year reopened.'); render(); },
  'user-add'() {
    const sc = openModal('Add user', `<div class="grid g2">${field('Name', `<input name="name">`, { req: 1 })}${field('Username', `<input name="username">`, { req: 1 })}${field('Role', `<select name="role">${opts([['staff', 'Staff'], ['admin', 'Administrator']], 'staff')}</select>`)}${field('PIN (4 to 8 digits)', `<input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">`, { req: 1 })}</div>`, { ok: 'Add user' });
    sc._onSubmit = async () => { const f = formData($('form', sc)); if (!f.name.trim() || !/^[A-Za-z0-9_.-]{3,20}$/.test(f.username.trim())) return toast('Enter a name and a username of 3 to 20 letters or digits.', 'err'); if (!/^\d{4,8}$/.test(f.pin)) return toast('PIN must be 4 to 8 digits.', 'err'); if (db.users.some(u => u.username.toLowerCase() === f.username.trim().toLowerCase())) return toast('That username is taken.', 'err'); const salt = E.uid('s'); const hash = await hashPin(f.pin, salt); mutate(() => { db.users.push({ id: E.uid('U'), name: f.name.trim(), username: f.username.trim(), role: f.role, salt, hash }); E.audit(db, 'add-user', null, ui.user.name, f.username); }, 'User added.'); closeModal(sc); render(); };
  },
  'user-pin'(a) {
    const u = db.users.find(x => x.id === a.dataset.id); const sc = openModal('Reset PIN for ' + u.name, field('New PIN (4 to 8 digits)', `<input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">`), { size: 'narrow', ok: 'Set PIN' });
    sc._onSubmit = async () => { const f = formData($('form', sc)); if (!/^\d{4,8}$/.test(f.pin)) return toast('PIN must be 4 to 8 digits.', 'err'); const salt = E.uid('s'); const hash = await hashPin(f.pin, salt); mutate(() => { u.salt = salt; u.hash = hash; E.audit(db, 'reset-pin', null, ui.user.name, u.username); }, 'PIN updated.'); closeModal(sc); };
  },
  async 'user-del'(a) { const u = db.users.find(x => x.id === a.dataset.id); if (u.role === 'admin' && db.users.filter(x => x.role === 'admin').length < 2) return toast('You need at least one administrator.', 'err'); if (await confirmBox(`Remove ${esc(u.name)}?`, 'Remove', true)) { mutate(() => { db.users = db.users.filter(x => x.id !== u.id); }, 'User removed.'); render(); } },
  'backup-download': downloadBackup,
  async 'restore-prev'() { let raw = null; try { raw = localStorage.getItem(KEY_PREV); } catch (e) { } if (!raw) return; try { const d = JSON.parse(raw); if (!validBackup(d)) throw 0; const cur = JSON.stringify(db); db = d; persist(); try { localStorage.setItem(KEY_PREV, cur); } catch (e) { } ui.user = db.users.find(x => x.id === ui.user.id) || null; render(); toast('Previous data restored.'); } catch (e) { toast('Nothing to undo.', 'err'); } },
  async 'erase-data'() {
    const sc = openModal('Erase data', `<p style="margin-top:0">This removes every voucher, party, product and ledger you added. Business details, users and accounting years stay. A safety copy is kept so you can undo.</p>${field('Type ERASE to confirm', `<input name="c" autocomplete="off">`)}`, { size: 'narrow', ok: 'Erase', sticky: true });
    sc._onSubmit = () => { if (formData($('form', sc)).c.trim() !== 'ERASE') return toast('Type ERASE exactly to confirm.', 'err'); try { localStorage.setItem(KEY_PREV, JSON.stringify(db)); } catch (e) { } mutate(() => { db.vouchers = []; db.parties = []; db.products = []; db.accounts = db.accounts.filter(a => a.sys); db.counters = {}; db.audit = []; }, 'All transaction data erased.'); closeModal(sc); ui.f = {}; go('dashboard'); };
  },
  async 'load-sample'() {
    if (db.vouchers.some(v => v.type !== 'opening')) return toast('Sample data can only be loaded into empty books.', 'err');
    if (!(await confirmBox('Load sample parties, products and transactions? They are clearly named "Sample" and can be erased in Settings.', 'Load sample data'))) return;
    const ok = mutate(() => E.run(db, () => { seedSample(E, db, ui.user.name); }), 'Sample data loaded. Explore every section.'); if (ok) { ui.f = {}; go('dashboard'); }
  },
};
function pageChange(el) {
  if (el.dataset.f) {
    const [k, p] = el.dataset.f.split('.'); ui.f[k] = ui.f[k] || {}; ui.f[k][p] = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'bsheet' && p === 'on' && !el.value) return; render(); return;
  }
  const act = el.dataset.actChange;
  if (act === 'set-fy') { db.fy = el.value; persist(); const keep = { settings: ui.f.settings }; ui.f = keep; render(); }
  else if (act === 'restore-file') { const file = el.files && el.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => restoreText(String(r.result)); r.readAsText(file); el.value = ''; }
  else if (act === 'logo-file') {
    const file = el.files && el.files[0]; if (!file) return; if (file.size > 2e6) return toast('Choose an image under 2 MB.', 'err');
    const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const m = 240, sc = Math.min(1, m / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); mutate(() => { db.settings.logo = c.toDataURL('image/png'); }, 'Logo saved.'); render(); }; img.onerror = () => toast('That image could not be read.', 'err'); img.src = r.result; }; r.readAsDataURL(file);
  }
  else if (el.dataset.agp) {
    const type = el.dataset.agp; const sel = $('#againstSel2', el.closest('form')); if (!sel) return; const invs = el.value ? openInvoicesFor(el.value, type === 'receipt' ? 'sale' : 'purchase') : [];
    sel.innerHTML = opts(invs.map(r => [r.v.id, `${r.v.no} · balance ${nf(r.st.balance)}`]), '', 'On account / not linked');
  }
  else if (el.id === 'againstSel2' && el.value) { const v = db.vouchers.find(x => x.id === el.value); if (v) { const amt = $('#vAmt', el.closest('form')); if (amt && !E.num(amt.value)) amt.value = E.invoiceStatus(db, v).balance; } }
}

/* ---------- event wiring & boot ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return; const fn = ACT[a.dataset.act]; if (!fn) return;
  if (a.tagName === 'A' && a.getAttribute('href') && a.getAttribute('href').startsWith('#')) e.preventDefault();
  if (a.closest('.scrim') && ['cf-yes', 'cf-no'].includes(a.dataset.act)) return;
  fn(a, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.filter) return applyFilter(el);
  if (el.matches('[data-jsum]')) { const sc = el.closest('.scrim'); if (sc) jSum(sc); return; }
  if ((el.dataset.d || el.dataset.l) && el.tagName === 'INPUT' && el.type !== 'radio' && el.type !== 'date') docInput(el);
});
document.addEventListener('change', e => {
  const el = e.target;
  if ((el.dataset.d || el.dataset.l) && (el.tagName !== 'INPUT' || el.type === 'radio' || el.type === 'date')) return docInput(el);
  if (el.dataset.f || el.dataset.actChange || el.dataset.agp || el.id === 'againstSel2') pageChange(el);
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const form = e.target; const sc = form.closest('.scrim');
  if (sc) { if (sc._onSubmit) sc._onSubmit(); return; }
  const name = form.dataset.form; if (!FORMS[name]) return; const btnEl = form.querySelector('[type=submit]'); if (btnEl) btnEl.disabled = true;
  try { await FORMS[name](formData(form)); } finally { if (btnEl && document.body.contains(btnEl)) btnEl.disabled = false; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalStack.length) { const sc = modalStack[modalStack.length - 1]; if (!sc.querySelector('[data-act=cf-yes]')) closeModal(); }
  if (e.target.id === 'scan' && e.key === 'Enter') {
    e.preventDefault(); const q = e.target.value.trim().toLowerCase(); if (!q) return;
    const p = db.products.find(x => (x.barcode && x.barcode.toLowerCase() === q) || x.code.toLowerCase() === q);
    if (p) { addLineByProduct(p, 1); e.target.value = ''; } else toast(`No product with barcode or code "${e.target.value.trim()}".`, 'err');
  }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && PAGES[h] && !['doc', 'view', 'party', 'ledger'].includes(h) && h !== ui.page && ui.user) { ui.page = h; render(); } });

(function boot() {
  db = loadDB();
  if (db) {
    try { const sid = sessionStorage.getItem(SESS); if (sid) ui.user = db.users.find(u => u.id === sid) || null; } catch (e) { }
    if (!db.years.length) E.addYear(db, fyStartDefault());
    if (!E.getYear(db)) db.fy = db.years[0].id;
    const h = location.hash.slice(1); if (h && PAGES[h] && !['doc', 'view', 'party', 'ledger'].includes(h)) ui.page = h;
  } else { try { localStorage.setItem('shree_probe', '1'); localStorage.removeItem('shree_probe'); } catch (e) { ui.storageOk = false; } }
  render();
})();
