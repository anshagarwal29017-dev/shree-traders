const E = require('../source/engine.js');
const seed = require('../source/seed.js');
const assert = require('assert');
let pass = 0; const t = (n, f) => { try { f(); pass++; console.log('ok  ', n); } catch (e) { console.log('FAIL', n, '\n   ', e.message); process.exitCode = 1; } };

const db = E.newDB();
E.addYear(db, 2026);
seed(E, db, 'test');
const fy = E.getYear(db);
const checks = () => {
  const tb = E.trialBalance(db, fy.id);
  const bs = E.balanceSheet(db, fy.id);
  const stockLedger = E.balanceAt(db, 'STOCK', fy.end);
  const stockSum = E.r2(db.products.reduce((s, p) => s + p.value, 0));
  return { tb, bs, stockLedger, stockSum };
};
t('seed posts vouchers', () => assert(db.vouchers.length > 100, 'vouchers=' + db.vouchers.length));
t('trial balance balances', () => { const c = checks(); assert(c.tb.ok, `Dr ${c.tb.dr} Cr ${c.tb.cr}`); });
t('balance sheet balances', () => { const c = checks(); assert(c.bs.ok, `A ${c.bs.totalAssets} L ${c.bs.totalLiab}`); });
t('stock ledger == sum of product values', () => { const c = checks(); assert.strictEqual(c.stockLedger, c.stockSum); });
t('no negative stock', () => assert(db.products.every(p => p.qty >= 0)));
t('every active voucher balanced', () => assert(E.live(db).every(v => Math.abs(E.sum(v.entries, e => e.dr || 0) - E.sum(v.entries, e => e.cr || 0)) < 0.005)));

const pl = E.profitLoss(db, fy.start, fy.end);
console.log('   P&L: sales', pl.netSales, 'cogs', pl.cogs, 'gross', pl.gross, 'exp', pl.expenses, 'net', pl.netProfit);
const d = E.dashboard(db);
console.log('   Dashboard: recv', d.recv, 'pay', d.pay, 'stock', d.stock, 'cash', d.cash, 'bank', d.bank);

// edit / cancel a sale
const sale = db.vouchers.filter(v => v.type === 'sale' && v.status === 'active' && v.party)[3];
t('edit sale updates stock, ledger, GST', () => {
  const before = JSON.parse(JSON.stringify({ p: db.products, o: E.totals(db, null, fy.end).get('OUT_CGST') }));
  const l0 = sale.lines[0]; const prod = E.prod(db, l0.pid); const q0 = prod.qty;
  const input = JSON.parse(JSON.stringify(sale)); input.lines[0].qty = l0.qty + 1; input.paid = 0; input.mode = 'credit';
  const nv = E.editVoucher(db, sale.id, input, 'test');
  assert.strictEqual(nv.no, sale.no);
  assert.strictEqual(E.prod(db, l0.pid).qty, E.r3(q0 - 1));
  const c = checks(); assert(c.tb.ok && c.bs.ok && c.stockLedger === c.stockSum);
});
t('edit that fails rolls back everything', () => {
  const snap = JSON.stringify(db);
  const input = JSON.parse(JSON.stringify(db.vouchers.find(v => v.id === sale.id))); input.lines[0].qty = 100000;
  assert.throws(() => E.editVoucher(db, sale.id, input, 'test'), /Not enough stock/);
  assert.strictEqual(JSON.stringify(db), snap);
});
t('cancel sale restores stock and removes from books', () => {
  const v = db.vouchers.find(x => x.id === sale.id); const p = E.prod(db, v.lines[0].pid); const q = p.qty, qty = v.lines[0].qty;
  const salesBefore = E.profitLoss(db, fy.start, fy.end).netSales;
  E.cancelVoucher(db, v.id, 'test cancel', 'test');
  assert.strictEqual(E.prod(db, v.lines[0].pid).qty, E.r3(q + qty));
  assert(E.profitLoss(db, fy.start, fy.end).netSales < salesBefore);
  const c = checks(); assert(c.tb.ok && c.bs.ok && c.stockLedger === c.stockSum);
  assert.throws(() => E.cancelVoucher(db, v.id, '', 'x'), /Already cancelled/);
  assert.throws(() => E.editVoucher(db, v.id, v, 'x'), /cancelled/);
});
t('purchase cancel blocked when stock already sold', () => {
  const p = db.products[0];
  const buyer = db.parties.find(x => x.type === 'supplier');
  const nb = E.postVoucher(db, { type: 'purchase', date: E.todayISO(), party: buyer.id, refNo: 'TESTBILL-1', lines: [{ pid: p.id, qty: 5, rate: 100, gst: 28 }], mode: 'credit' }, 'test');
  const cust = db.parties.find(x => x.type === 'customer');
  E.postVoucher(db, { type: 'sale', date: E.todayISO(), party: cust.id, lines: [{ pid: p.id, qty: p.qty, rate: 150, gst: 28 }], mode: 'credit' }, 'test');
  assert.strictEqual(E.prod(db, p.id).qty, 0); assert.strictEqual(E.prod(db, p.id).value, 0);
  const snap = JSON.stringify(db);
  assert.throws(() => E.cancelVoucher(db, nb.id, '', 't'), /already been sold/);
  assert.strictEqual(JSON.stringify(db), snap);
});
t('duplicate supplier bill rejected', () => {
  const sp = db.parties.find(x => x.type === 'supplier');
  assert.throws(() => E.postVoucher(db, { type: 'purchase', date: E.todayISO(), party: sp.id, refNo: 'TESTBILL-1', lines: [{ pid: db.products[1].id, qty: 1, rate: 10, gst: 28 }], mode: 'credit' }, 't'), /already recorded/);
});
t('walk-in credit sale rejected; duplicate codes rejected', () => {
  assert.throws(() => E.postVoucher(db, { type: 'sale', date: E.todayISO(), party: '', lines: [{ pid: db.products[2].id, qty: 1, rate: 100, gst: 28 }], mode: 'credit', paid: 0 }, 't'), /walk-in/i);
  assert.throws(() => E.saveProduct(db, { name: 'X', code: 'bp-f01', buy: 1, sell: 2, gst: 28 }, 't'), /already used/);
  assert.throws(() => E.saveParty(db, { type: 'customer', name: 'sample ravi auto works' }, 't'), /already exists/);
});
t('IGST for interstate customer, CGST/SGST for local', () => {
  const g = db.parties.find(p => p.stateCode === '24' && p.type === 'customer'); const l = db.parties.find(p => p.stateCode === '27' && p.type === 'customer');
  const pid = db.products[3];
  const a = E.postVoucher(db, { type: 'sale', date: E.todayISO(), party: g.id, lines: [{ pid: pid.id, qty: 1, rate: 1000, gst: 28 }], mode: 'credit' }, 't');
  const b = E.postVoucher(db, { type: 'sale', date: E.todayISO(), party: l.id, lines: [{ pid: pid.id, qty: 1, rate: 1000, gst: 28 }], mode: 'credit' }, 't');
  assert.strictEqual(a.igst, 280); assert.strictEqual(a.cgst, 0); assert.strictEqual(b.cgst, 140); assert.strictEqual(b.sgst, 140);
});
t('credit note and debit note keep books balanced', () => {
  const c = db.parties.find(p => p.type === 'customer'); const s = db.parties.find(p => p.type === 'supplier'); const p = db.products[4];
  E.postVoucher(db, { type: 'creditnote', date: E.todayISO(), party: c.id, lines: [{ pid: p.id, qty: 1, rate: 140, gst: 28 }] }, 't');
  E.postVoucher(db, { type: 'debitnote', date: E.todayISO(), party: s.id, lines: [{ pid: p.id, qty: 1, rate: 90, gst: 28 }] }, 't');
  const k = checks(); assert(k.tb.ok && k.bs.ok && k.stockLedger === k.stockSum);
});
t('stock adjustment up and down', () => {
  const p = db.products[5]; const q = p.qty;
  E.postVoucher(db, { type: 'adjust', date: E.todayISO(), lines: [{ pid: p.id, qty: 3, rate: 50 }], narr: 'found' }, 't');
  E.postVoucher(db, { type: 'adjust', date: E.todayISO(), lines: [{ pid: p.id, qty: -2 }], narr: 'damaged' }, 't');
  assert.strictEqual(E.prod(db, p.id).qty, E.r3(q + 1));
  const k = checks(); assert(k.tb.ok && k.bs.ok && k.stockLedger === k.stockSum);
});
t('journal must balance', () => {
  assert.throws(() => E.postVoucher(db, { type: 'journal', date: E.todayISO(), jlines: [{ acc: 'CASH', dr: 100 }, { acc: 'CAPITAL', cr: 90 }] }, 't'), /does not balance/);
  E.postVoucher(db, { type: 'journal', date: E.todayISO(), jlines: [{ acc: 'CASH', dr: 100 }, { acc: 'CAPITAL', cr: 100 }] }, 't');
});
t('receipt allocation updates invoice status', () => {
  const inv = db.vouchers.find(v => v.type === 'sale' && v.status === 'active' && v.mode === 'credit');
  const st = E.invoiceStatus(db, inv); assert(st.balance > 0);
  E.postVoucher(db, { type: 'receipt', date: E.todayISO(), party: inv.party, amount: st.balance, mode: 'cash', against: inv.id }, 't');
  assert.strictEqual(E.invoiceStatus(db, inv).label, 'Paid');
});
t('new financial year carries balances forward and still balances', () => {
  const y = E.addYear(db, 2027); db.fy = y.id;
  const c = checks(); assert(c.tb.ok, `TB ${c.tb.dr}/${c.tb.cr}`); assert(c.bs.ok, `BS ${c.bs.totalAssets}/${c.bs.totalLiab}`);
  const plNew = E.profitLoss(db, y.start, y.end); assert.strictEqual(plNew.netProfit, 0);
  const dashNew = E.dashboard(db); assert(dashNew.stock > 0 && dashNew.recv > 0);
  const p = db.products.find(x => x.qty > 2); const cust = db.parties.find(x => x.type === 'customer');
  const v = E.postVoucher(db, { type: 'sale', date: '2027-04-02', party: cust.id, lines: [{ pid: p.id, qty: 1, rate: 100, gst: 28 }], mode: 'credit' }, 't');
  assert(v.no.includes('2027-28') && v.no.endsWith('0001'), v.no);
  assert(checks().bs.ok);
  assert.throws(() => E.postVoucher(db, { type: 'sale', date: '2029-01-02', party: cust.id, lines: [{ pid: p.id, qty: 1, rate: 100, gst: 28 }], mode: 'credit' }, 't'), /financial year/);
  db.fy = fy.id;
});
t('closed year blocks posting', () => {
  E.getYear(db, fy.id).locked = true;
  assert.throws(() => E.postVoucher(db, { type: 'expense', date: E.todayISO(), expAcc: 'EXP_RENT', amount: 10, mode: 'cash' }, 't'), /closed/);
  E.getYear(db, fy.id).locked = false;
});
t('GST register totals tie to ledger', () => {
  const g = E.gstData(db, fy.start, fy.end); const m = E.totals(db, fy.start, fy.end);
  assert.strictEqual(g.out.cgst, E.r2(E.net(m, 'OUT_CGST') * -1));
  assert.strictEqual(g.itc.igst, E.net(m, 'ITC_IGST'));
});
t('monthly series sums to yearly P&L', () => {
  const ms = E.monthlySeries(db, fy.id); const p = E.profitLoss(db, fy.start, fy.end);
  assert.strictEqual(E.r2(ms.reduce((s, m) => s + m.sales, 0)), p.netSales);
  assert.strictEqual(E.r2(ms.reduce((s, m) => s + m.profit, 0)), p.netProfit);
});
t('cash flow reconciles with cash + bank', () => {
  const cf = E.cashFlow(db, fy.id); const m = E.totals(db, null, fy.end);
  const cb = E.r2(db.accounts.filter(a => a.group === 'Cash-in-Hand' || a.group === 'Bank Accounts').reduce((s, a) => s + E.net(m, a.id), 0));
  assert.strictEqual(cf.closing, cb);
});
t('amount in words', () => {
  assert.strictEqual(E.inWords(1234567.5), 'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only');
  assert.strictEqual(E.inWords(100), 'One Hundred Rupees Only');
});
t('business validation', () => {
  const s = E.SETTINGS_DEFAULT(); s.gstin = '27ABCDE1234F1Z5'; s.stateCode = '27'; s.pan = 'ABCDE1234F'; s.aadhaar = '234567890123';
  assert.deepStrictEqual(E.checkBusiness(s), []);
  s.gstin = '27ABCDE1234'; assert(E.checkBusiness(s).length === 1);
});
t('party delete blocked when used; product delete blocked when used', () => {
  const c = db.parties.find(p => p.type === 'customer');
  assert.throws(() => E.deleteParty(db, c.id, 't'), /transactions/);
  assert.throws(() => E.deleteProduct(db, db.products[0].id, 't'), /used in vouchers/);
});
console.log(`\n${pass} checks passed`);
