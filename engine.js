/* SHREE TRADERS accounting engine: pure logic, no DOM. */
const ENGINE = (() => {
'use strict';

/* ---------- helpers ---------- */
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r3 = n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const pad = (n, w) => String(n).padStart(w, '0');
const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

const STATES = {'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli and Daman & Diu','27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh'};

const RX = {
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  aadhaar: /^[2-9][0-9]{11}$/,
  mobile: /^[6-9][0-9]{9}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

/* ---------- chart of accounts ---------- */
const GROUPS = {
  'Cash-in-Hand': 'A', 'Bank Accounts': 'A', 'Stock-in-Hand': 'A', 'Sundry Debtors': 'A', 'Current Assets': 'A', 'Fixed Assets': 'A', 'Duties & Taxes (Input)': 'A',
  'Sundry Creditors': 'L', 'Current Liabilities': 'L', 'Duties & Taxes (Output)': 'L', 'Loans (Liability)': 'L', 'Capital Account': 'L',
  'Sales Accounts': 'I', 'Direct Income': 'I', 'Indirect Income': 'I',
  'Cost of Goods Sold': 'E', 'Direct Expenses': 'E', 'Indirect Expenses': 'E',
};
const SYS_ACCOUNTS = [
  ['CASH', 'Cash in Hand', 'Cash-in-Hand'], ['BANK', 'Bank Account', 'Bank Accounts'], ['STOCK', 'Stock-in-Trade', 'Stock-in-Hand'],
  ['ITC_CGST', 'Input CGST', 'Duties & Taxes (Input)'], ['ITC_SGST', 'Input SGST', 'Duties & Taxes (Input)'], ['ITC_IGST', 'Input IGST', 'Duties & Taxes (Input)'],
  ['OUT_CGST', 'Output CGST', 'Duties & Taxes (Output)'], ['OUT_SGST', 'Output SGST', 'Duties & Taxes (Output)'], ['OUT_IGST', 'Output IGST', 'Duties & Taxes (Output)'],
  ['CAPITAL', "Owner's Capital", 'Capital Account'],
  ['SALES', 'Sales', 'Sales Accounts'], ['SALES_RET', 'Sales Returns', 'Sales Accounts'], ['OTHER_INC', 'Other Income', 'Indirect Income'],
  ['COGS', 'Cost of Goods Sold', 'Cost of Goods Sold'],
  ['EXP_RENT', 'Shop Rent', 'Indirect Expenses'], ['EXP_ELEC', 'Electricity Bills', 'Indirect Expenses'], ['EXP_SAL', 'Employee Salaries', 'Indirect Expenses'],
  ['EXP_TRANS', 'Transportation', 'Indirect Expenses'], ['EXP_VEH', 'Vehicle Expenses', 'Indirect Expenses'], ['EXP_MAINT', 'Maintenance', 'Indirect Expenses'],
  ['EXP_OTHER', 'Other Expenses', 'Indirect Expenses'], ['STOCK_ADJ', 'Stock Adjustment', 'Indirect Expenses'], ['ROUNDOFF', 'Round Off', 'Indirect Expenses'],
];
const EXPENSE_ACCS = ['EXP_RENT', 'EXP_ELEC', 'EXP_SAL', 'EXP_TRANS', 'EXP_VEH', 'EXP_MAINT', 'EXP_OTHER'];

const SETTINGS_DEFAULT = () => ({
  businessName: 'SHREE TRADERS', ownerName: '', tradeType: 'Two-wheeler spare parts: wholesale & retail',
  address: '', city: '', state: '', stateCode: '', pincode: '', mobile: '', email: '',
  gstin: '', pan: '', aadhaar: '', udyam: '', tan: '', tradeLicense: '',
  bankName: '', accountNo: '', ifsc: '', branch: '', upi: '', logo: '',
  invPrefix: 'INV', invStart: 1, invPad: 4, invWithFY: true,
  terms: 'Goods once sold will not be taken back. Subject to local jurisdiction.', footer: 'Thank you for your business.',
  gstRates: [0, 5, 12, 18, 28], currency: 'INR', allowNegative: false,
});

function newDB() {
  const db = { v: 1, settings: SETTINGS_DEFAULT(), users: [], years: [], fy: null, accounts: [], parties: [], products: [], vouchers: [], counters: {}, audit: [], created: new Date().toISOString() };
  for (const [id, name, group] of SYS_ACCOUNTS) db.accounts.push({ id, name, group, sys: true });
  return db;
}

/* ---------- lookups ---------- */
const acc = (db, id) => db.accounts.find(a => a.id === id);
const prod = (db, id) => db.products.find(p => p.id === id);
const party = (db, id) => db.parties.find(p => p.id === id);
const nature = (db, id) => { const a = acc(db, id); return a ? GROUPS[a.group] : null; };
const isPL = (db, id) => { const n = nature(db, id); return n === 'I' || n === 'E'; };
const voucherLive = v => v.status !== 'cancelled';

/* ---------- financial years ---------- */
function yearRange(startYear) {
  const y = Number(startYear);
  return { id: `${y}-${String((y + 1) % 100).padStart(2, '0')}`, start: `${y}-04-01`, end: `${y + 1}-03-31`, locked: false };
}
function addYear(db, startYear) {
  const y = yearRange(startYear);
  if (!(y.start.slice(0, 4) >= 1990)) throw new Error('Enter a valid starting year, for example 2026.');
  if (db.years.some(x => x.id === y.id)) throw new Error(`Financial year ${y.id} already exists.`);
  db.years.push(y); db.years.sort((a, b) => a.start.localeCompare(b.start));
  if (!db.fy) db.fy = y.id;
  return y;
}
const getYear = (db, id) => db.years.find(y => y.id === (id || db.fy));
const fyOfDate = (db, date) => db.years.find(y => date >= y.start && date <= y.end);

/* ---------- transactions ---------- */
function run(db, fn) {
  const snap = JSON.stringify(db);
  try { return fn(); } catch (e) {
    const old = JSON.parse(snap);
    for (const k of Object.keys(db)) delete db[k];
    Object.assign(db, old);
    throw e;
  }
}
function audit(db, action, v, user, extra) {
  db.audit.push({ t: new Date().toISOString(), user: user || '', action, voucher: v ? v.no || v.id : '', type: v ? v.type : '', info: extra || '' });
  if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
}

/* ---------- validation ---------- */
const clean = s => String(s ?? '').trim();
function validateGSTIN(v) { v = clean(v).toUpperCase(); return !v || RX.gstin.test(v); }
function checkBusiness(s) {
  const errs = [];
  if (!clean(s.businessName)) errs.push('Business name is required.');
  if (s.gstin && !RX.gstin.test(clean(s.gstin).toUpperCase())) errs.push('GSTIN must be 15 characters, for example 27ABCDE1234F1Z5.');
  if (s.gstin && s.stateCode && clean(s.gstin).slice(0, 2) !== s.stateCode) errs.push('The first two digits of the GSTIN must match the state code.');
  if (s.pan && !RX.pan.test(clean(s.pan).toUpperCase())) errs.push('PAN must look like ABCDE1234F.');
  if (s.aadhaar && !RX.aadhaar.test(clean(s.aadhaar).replace(/\s/g, ''))) errs.push('Aadhaar must be 12 digits.');
  if (s.mobile && !RX.mobile.test(clean(s.mobile))) errs.push('Mobile number must be 10 digits.');
  if (s.email && !RX.email.test(clean(s.email))) errs.push('Email address is not valid.');
  if (s.ifsc && !RX.ifsc.test(clean(s.ifsc).toUpperCase())) errs.push('IFSC must look like SBIN0001234.');
  return errs;
}

/* ---------- parties ---------- */
function saveParty(db, p, user) {
  return run(db, () => {
    const name = clean(p.name);
    if (!name) throw new Error('Name is required.');
    if (!['customer', 'supplier'].includes(p.type)) throw new Error('Choose customer or supplier.');
    const gstin = clean(p.gstin).toUpperCase();
    if (gstin && !RX.gstin.test(gstin)) throw new Error('GSTIN is not valid.');
    if (clean(p.mobile) && !RX.mobile.test(clean(p.mobile))) throw new Error('Mobile number must be 10 digits.');
    const dup = db.parties.find(x => x.id !== p.id && x.type === p.type && x.name.toLowerCase() === name.toLowerCase());
    if (dup) throw new Error(`A ${p.type} named "${name}" already exists.`);
    if (gstin) {
      const d2 = db.parties.find(x => x.id !== p.id && x.type === p.type && x.gstin === gstin);
      if (d2) throw new Error(`GSTIN ${gstin} already belongs to ${d2.name}.`);
    }
    let rec = p.id && party(db, p.id);
    const stateCode = gstin ? gstin.slice(0, 2) : (p.stateCode || '');
    const data = { name, mobile: clean(p.mobile), address: clean(p.address), gstin, stateCode, state: STATES[stateCode] || clean(p.state), email: clean(p.email),
      opening: Math.abs(r2(num(p.opening))), openingType: p.openingType === 'Cr' ? 'Cr' : 'Dr' };
    if (rec) {
      Object.assign(rec, data);
      acc(db, rec.id).name = name;
    } else {
      rec = { id: uid('P'), type: p.type, ...data, created: new Date().toISOString() };
      db.parties.push(rec);
      db.accounts.push({ id: rec.id, name, group: p.type === 'customer' ? 'Sundry Debtors' : 'Sundry Creditors', party: true });
    }
    setOpening(db, 'acc', rec.id, rec.opening, rec.openingType);
    audit(db, p.id ? 'edit-party' : 'add-party', null, user, name);
    return rec;
  });
}
function deleteParty(db, id, user) {
  return run(db, () => {
    const used = db.vouchers.some(v => v.type !== 'opening' && (v.party === id || (v.entries || []).some(e => e.acc === id)));
    if (used) throw new Error('This party has transactions and cannot be deleted. Cancel its vouchers first, or leave it as is.');
    const p = party(db, id);
    db.vouchers = db.vouchers.filter(v => !(v.type === 'opening' && v.ref === id));
    db.parties = db.parties.filter(x => x.id !== id);
    db.accounts = db.accounts.filter(x => x.id !== id);
    audit(db, 'delete-party', null, user, p && p.name);
  });
}

/* ---------- ledger accounts ---------- */
function saveAccount(db, a, user) {
  return run(db, () => {
    const name = clean(a.name);
    if (!name) throw new Error('Ledger name is required.');
    if (!GROUPS[a.group]) throw new Error('Choose a valid group.');
    if (db.accounts.some(x => x.id !== a.id && x.name.toLowerCase() === name.toLowerCase())) throw new Error(`A ledger named "${name}" already exists.`);
    let rec = a.id && acc(db, a.id);
    if (rec) { if (!rec.sys) { rec.name = name; rec.group = a.group; } }
    else { rec = { id: uid('A'), name, group: a.group }; db.accounts.push(rec); }
    if (a.opening !== undefined) setOpening(db, 'acc', rec.id, Math.abs(r2(num(a.opening))), a.openingType === 'Cr' ? 'Cr' : 'Dr');
    audit(db, 'save-ledger', null, user, name);
    return rec;
  });
}

/* ---------- products ---------- */
function saveProduct(db, p, user) {
  return run(db, () => {
    const name = clean(p.name), code = clean(p.code);
    if (!name) throw new Error('Product name is required.');
    if (!code) throw new Error('Product code is required.');
    if (db.products.some(x => x.id !== p.id && x.code.toLowerCase() === code.toLowerCase())) throw new Error(`Product code "${code}" is already used.`);
    const bc = clean(p.barcode);
    if (bc && db.products.some(x => x.id !== p.id && x.barcode === bc)) throw new Error(`Barcode ${bc} is already assigned to another product.`);
    const buy = r2(num(p.buy)), sell = r2(num(p.sell));
    if (buy < 0 || sell < 0) throw new Error('Prices cannot be negative.');
    const gst = num(p.gst);
    if (!db.settings.gstRates.includes(gst)) throw new Error(`GST rate ${gst}% is not in your GST rate list.`);
    const data = { name, code, category: clean(p.category), brand: clean(p.brand), hsn: clean(p.hsn), unit: clean(p.unit) || 'Pcs', buy, sell, gst, min: Math.max(0, num(p.min)), barcode: bc };
    let rec = p.id && prod(db, p.id);
    if (rec) Object.assign(rec, data);
    else {
      rec = { id: uid('I'), ...data, qty: 0, value: 0, created: new Date().toISOString() };
      db.products.push(rec);
      const oq = r3(num(p.openQty));
      if (oq > 0) {
        const fy = getYear(db);
        postOpeningStock(db, rec, oq, r2(num(p.openRate) || buy), fy ? fy.start : todayISO());
      }
    }
    audit(db, p.id ? 'edit-product' : 'add-product', null, user, name);
    return rec;
  });
}
function postOpeningStock(db, rec, qty, rate, date) {
  const v = { id: uid('V'), type: 'opening', ref: 'stock:' + rec.id, date, fy: (fyOfDate(db, date) || {}).id || db.fy, no: 'OB', status: 'active', lines: [{ pid: rec.id, name: rec.name, qty, rate, taxable: r2(qty * rate) }], narr: 'Opening stock', created: new Date().toISOString() };
  applyStock(db, v);
  const cost = sum(v.lines, l => l.cost);
  v.entries = [{ acc: 'STOCK', dr: cost }, { acc: 'CAPITAL', cr: cost }];
  db.vouchers.push(v);
}
function deleteProduct(db, id, user) {
  return run(db, () => {
    const used = db.vouchers.some(v => v.type !== 'opening' && voucherLive(v) && (v.lines || []).some(l => l.pid === id));
    if (used) throw new Error('This product is used in vouchers and cannot be deleted.');
    const p = prod(db, id);
    const ov = db.vouchers.find(v => v.type === 'opening' && v.ref === 'stock:' + id);
    if (ov) { revertStock(db, ov); db.vouchers = db.vouchers.filter(v => v !== ov); }
    db.products = db.products.filter(x => x.id !== id);
    audit(db, 'delete-product', null, user, p && p.name);
  });
}

/* ---------- opening balances ---------- */
function setOpening(db, kind, id, amount, type) {
  db.vouchers = db.vouchers.filter(v => !(v.type === 'opening' && v.ref === kind + ':' + id));
  if (!(amount > 0)) return;
  const fy = getYear(db);
  const date = fy ? fy.start : todayISO();
  const e = type === 'Cr' ? [{ acc: 'CAPITAL', dr: amount }, { acc: id, cr: amount }] : [{ acc: id, dr: amount }, { acc: 'CAPITAL', cr: amount }];
  db.vouchers.push({ id: uid('V'), type: 'opening', ref: kind + ':' + id, date, fy: (fyOfDate(db, date) || {}).id || db.fy, no: 'OB', status: 'active', entries: e, narr: 'Opening balance', created: new Date().toISOString() });
}

/* ---------- stock mechanics ---------- */
const sum = (arr, f) => r2((arr || []).reduce((s, x) => s + (f ? f(x) : x), 0));
function unitCostOut(p, q) {
  if (p.qty <= 1e-9) return r2(q * p.buy);
  if (q >= p.qty - 1e-9) return r2(p.value);
  return r2(q * p.value / p.qty);
}
function applyStock(db, v) {
  for (const l of v.lines || []) {
    const p = prod(db, l.pid);
    if (!p) throw new Error(`Product "${l.name || l.pid}" no longer exists.`);
    const q = r3(l.qty);
    switch (v.type) {
      case 'sale': case 'debitnote': {
        if (q > p.qty + 1e-9 && !db.settings.allowNegative) throw new Error(`Not enough stock for ${p.name}: ${p.qty} in stock, ${q} requested.`);
        l.cost = unitCostOut(p, q); p.qty = r3(p.qty - q); p.value = r2(p.value - l.cost); break;
      }
      case 'purchase': case 'opening': l.cost = r2(l.taxable != null ? l.taxable : q * l.rate); p.qty = r3(p.qty + q); p.value = r2(p.value + l.cost); break;
      case 'creditnote': l.cost = l.unitCost != null ? r2(q * l.unitCost) : (p.qty > 1e-9 ? r2(q * p.value / p.qty) : r2(q * p.buy)); p.qty = r3(p.qty + q); p.value = r2(p.value + l.cost); break;
      case 'adjust':
        if (q >= 0) { l.cost = r2(q * l.rate); p.qty = r3(p.qty + q); p.value = r2(p.value + l.cost); }
        else { const o = -q; if (o > p.qty + 1e-9) throw new Error(`Cannot reduce ${p.name} by ${o}; only ${p.qty} in stock.`); l.cost = unitCostOut(p, o); p.qty = r3(p.qty - o); p.value = r2(p.value - l.cost); }
        break;
    }
  }
}
function revertStock(db, v) {
  for (const l of v.lines || []) {
    const p = prod(db, l.pid); if (!p) continue;
    const q = r3(l.qty);
    const outType = v.type === 'sale' || v.type === 'debitnote' || (v.type === 'adjust' && q < 0);
    const amt = Math.abs(q);
    if (outType) { p.qty = r3(p.qty + amt); p.value = r2(p.value + l.cost); }
    else {
      p.qty = r3(p.qty - amt); p.value = r2(p.value - l.cost);
      if (p.qty < -1e-9) throw new Error(`Cannot reverse this voucher: ${p.name} has already been sold or returned (${amt} needed, stock would go negative).`);
    }
  }
}

/* ---------- document totals ---------- */
function computeDoc(db, v) {
  const s = db.settings;
  let inter = false;
  if (v.party) { const p = party(db, v.party); if (p && p.stateCode && s.stateCode) inter = p.stateCode !== s.stateCode; }
  else if (v.placeCode && s.stateCode) inter = v.placeCode !== s.stateCode;
  v.inter = inter;
  let t = 0, cg = 0, sg = 0, ig = 0;
  for (const l of v.lines) {
    const p = prod(db, l.pid);
    l.name = p ? p.name : l.name; l.hsn = p ? p.hsn : l.hsn;
    l.qty = r3(num(l.qty)); l.rate = r2(num(l.rate)); l.disc = Math.min(100, Math.max(0, num(l.disc))); l.gst = num(l.gst);
    if (!(l.qty > 0) && v.type !== 'adjust') throw new Error(`Enter a quantity for ${l.name}.`);
    if (l.rate < 0) throw new Error('Rate cannot be negative.');
    const gross = l.qty * l.rate;
    l.taxable = r2(gross - gross * l.disc / 100);
    const g = r2(l.taxable * l.gst / 100);
    if (inter) { l.igst = g; l.cgst = 0; l.sgst = 0; } else { l.cgst = r2(g / 2); l.sgst = r2(g - l.cgst); l.igst = 0; }
    l.total = r2(l.taxable + l.cgst + l.sgst + l.igst);
    t += l.taxable; cg += l.cgst; sg += l.sgst; ig += l.igst;
  }
  v.taxable = r2(t); v.cgst = r2(cg); v.sgst = r2(sg); v.igst = r2(ig);
  const raw = r2(v.taxable + v.cgst + v.sgst + v.igst);
  v.round = r2(Math.round(raw) - raw);
  v.total = r2(raw + v.round);
}

/* ---------- ledger entries per voucher type ---------- */
function payAcc(db, v) {
  if (v.mode === 'cash') return 'CASH';
  const b = v.bankId && acc(db, v.bankId);
  if (b && b.group === 'Bank Accounts') return b.id;
  return 'BANK';
}
const E = (a, dr, cr, extra) => { const e = { acc: a }; if (dr) e.dr = r2(dr); if (cr) e.cr = r2(cr); return Object.assign(e, extra || {}); };
function rnd(round, posSide) { // positive rounding goes to posSide
  if (!round) return [];
  const amt = Math.abs(round);
  const dr = (round > 0) === (posSide === 'dr');
  return [E('ROUNDOFF', dr ? amt : 0, dr ? 0 : amt)];
}
function gstEntries(v, prefix, side) {
  const out = [];
  for (const [k, a] of [['cgst', 'CGST'], ['sgst', 'SGST'], ['igst', 'IGST']]) if (v[k] > 0) out.push(E(prefix + a, side === 'dr' ? v[k] : 0, side === 'cr' ? v[k] : 0));
  return out;
}
function buildEntries(db, v) {
  const cost = sum(v.lines, l => l.cost);
  let e = [];
  switch (v.type) {
    case 'sale': {
      const pa = payAcc(db, v);
      if (v.party) {
        e.push(E(v.party, v.total, 0));
      } else e.push(E(pa, v.total, 0));
      e.push(E('SALES', 0, v.taxable), ...gstEntries(v, 'OUT_', 'cr'), ...rnd(v.round, 'cr'));
      e.push(E('COGS', cost, 0), E('STOCK', 0, cost));
      if (v.party && v.paid > 0) e.push(E(pa, v.paid, 0, { settle: true }), E(v.party, 0, v.paid, { settle: true }));
      break;
    }
    case 'purchase': {
      const pa = payAcc(db, v);
      e.push(E('STOCK', v.taxable, 0), ...gstEntries(v, 'ITC_', 'dr'), ...rnd(v.round, 'dr'), E(v.party, 0, v.total));
      if (v.paid > 0) e.push(E(v.party, v.paid, 0, { settle: true }), E(pa, 0, v.paid, { settle: true }));
      break;
    }
    case 'creditnote':
      e.push(E('SALES_RET', v.taxable, 0), ...gstEntries(v, 'OUT_', 'dr'), ...rnd(v.round, 'dr'), E(v.party, 0, v.total), E('STOCK', cost, 0), E('COGS', 0, cost));
      break;
    case 'debitnote': {
      e.push(E(v.party, v.total, 0), E('STOCK', 0, cost), ...gstEntries(v, 'ITC_', 'cr'), ...rnd(v.round, 'cr'));
      const diff = r2(v.taxable - cost);
      if (diff > 0) e.push(E('STOCK_ADJ', 0, diff)); else if (diff < 0) e.push(E('STOCK_ADJ', -diff, 0));
      break;
    }
    case 'receipt': e.push(E(payAcc(db, v), v.amount, 0, { settle: true }), E(v.party, 0, v.amount, { settle: true })); break;
    case 'payment': e.push(E(v.party, v.amount, 0, { settle: true }), E(payAcc(db, v), 0, v.amount, { settle: true })); break;
    case 'contra': e.push(E(v.toAcc, v.amount, 0), E(v.fromAcc, 0, v.amount)); break;
    case 'expense': e.push(E(v.expAcc, v.amount, 0), E(payAcc(db, v), 0, v.amount)); break;
    case 'journal': e = (v.jlines || []).map(l => E(l.acc, l.dr, l.cr)); break;
    case 'adjust': {
      for (const l of v.lines) {
        if (l.qty >= 0) e.push(E('STOCK', l.cost, 0), E('STOCK_ADJ', 0, l.cost));
        else e.push(E('STOCK_ADJ', l.cost, 0), E('STOCK', 0, l.cost));
      }
      break;
    }
  }
  return e.filter(x => (x.dr || 0) > 0 || (x.cr || 0) > 0);
}
const balanced = e => Math.abs(r2(sum(e, x => x.dr || 0) - sum(e, x => x.cr || 0))) < 0.005;

/* ---------- numbering ---------- */
const PREFIX = { purchase: 'PUR', receipt: 'RCT', payment: 'PAY', contra: 'CON', journal: 'JV', expense: 'EXP', creditnote: 'CN', debitnote: 'DN', adjust: 'ADJ' };
function nextNo(db, type, fy) {
  const key = type + '|' + fy;
  const s = db.settings;
  const seqStart = type === 'sale' ? Math.max(1, Math.floor(num(s.invStart)) || 1) : 1;
  const n = (db.counters[key] || (seqStart - 1)) + 1;
  db.counters[key] = n;
  const prefix = type === 'sale' ? (clean(s.invPrefix) || 'INV') : PREFIX[type];
  const width = type === 'sale' ? Math.max(1, Math.floor(num(s.invPad)) || 4) : 4;
  const useFY = type === 'sale' ? s.invWithFY !== false : true;
  return useFY ? `${prefix}/${fy}/${pad(n, width)}` : `${prefix}/${pad(n, width)}`;
}

/* ---------- voucher validation ---------- */
function validateVoucher(db, v, oldId) {
  if (!v.date || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) throw new Error('Enter a valid date.');
  const fy = fyOfDate(db, v.date);
  if (!fy) throw new Error('This date is not inside any financial year. Add that financial year in Settings first.');
  if (fy.locked) throw new Error(`Financial year ${fy.id} is closed. Unlock it in Settings to post here.`);
  v.fy = fy.id;
  const docTypes = ['sale', 'purchase', 'creditnote', 'debitnote'];
  if (docTypes.includes(v.type)) {
    if (!v.lines || !v.lines.length) throw new Error('Add at least one product.');
    if (v.type !== 'sale' && !v.party) throw new Error('Select a ' + (v.type === 'purchase' || v.type === 'debitnote' ? 'supplier.' : 'customer.'));
    if (v.party) {
      const p = party(db, v.party); if (!p) throw new Error('The selected party no longer exists.');
      if ((v.type === 'purchase' || v.type === 'debitnote') && p.type !== 'supplier') throw new Error('Select a supplier.');
      if ((v.type === 'sale' || v.type === 'creditnote') && p.type !== 'customer') throw new Error('Select a customer.');
    }
    const seen = new Set();
    for (const l of v.lines) { if (!l.pid) throw new Error('Select a product on every line.'); }
    if (v.type === 'purchase') {
      const ref = clean(v.refNo);
      if (!ref) throw new Error("Enter the supplier's bill number.");
      const dup = db.vouchers.find(x => x.id !== oldId && x.type === 'purchase' && voucherLive(x) && x.party === v.party && clean(x.refNo).toLowerCase() === ref.toLowerCase());
      if (dup) throw new Error(`Bill ${ref} from this supplier is already recorded as ${dup.no}.`);
    }
  }
  if (['receipt', 'payment'].includes(v.type)) {
    v.amount = r2(num(v.amount));
    if (!(v.amount > 0)) throw new Error('Enter an amount greater than zero.');
    if (!party(db, v.party)) throw new Error('Select a party.');
    if (v.mode === 'credit') throw new Error('Choose cash, UPI or bank.');
  }
  if (v.type === 'expense') {
    v.amount = r2(num(v.amount));
    if (!(v.amount > 0)) throw new Error('Enter an amount greater than zero.');
    if (!acc(db, v.expAcc) || nature(db, v.expAcc) !== 'E') throw new Error('Select an expense category.');
  }
  if (v.type === 'contra') {
    v.amount = r2(num(v.amount));
    if (!(v.amount > 0)) throw new Error('Enter an amount greater than zero.');
    const ok = id => { const a = acc(db, id); return a && (a.group === 'Cash-in-Hand' || a.group === 'Bank Accounts'); };
    if (!ok(v.fromAcc) || !ok(v.toAcc)) throw new Error('Contra entries move money between cash and bank accounts.');
    if (v.fromAcc === v.toAcc) throw new Error('Choose two different accounts.');
  }
  if (v.type === 'journal') {
    v.jlines = (v.jlines || []).map(l => ({ acc: l.acc, dr: r2(num(l.dr)), cr: r2(num(l.cr)) })).filter(l => l.acc && (l.dr || l.cr));
    if (v.jlines.length < 2) throw new Error('A journal entry needs at least two lines.');
    for (const l of v.jlines) { if (!acc(db, l.acc)) throw new Error('Select a ledger on every line.'); if (l.dr && l.cr) throw new Error('A line cannot have both debit and credit.'); }
  }
  if (v.type === 'adjust') {
    if (!v.lines || !v.lines.length) throw new Error('Add at least one product.');
    for (const l of v.lines) { l.qty = r3(num(l.qty)); l.rate = r2(num(l.rate)); if (!l.qty) throw new Error('Enter a non-zero quantity on every line.'); if (l.qty > 0 && !(l.rate > 0)) throw new Error('Enter the cost rate for stock increases.'); }
  }
}

function validatePayment(v) {
  if (['sale', 'purchase'].includes(v.type)) {
    if (v.paid === undefined || v.paid === null || v.paid === '') v.paid = v.mode === 'credit' ? 0 : v.total;
    v.paid = r2(Math.max(0, num(v.paid)));
    if (v.mode === 'credit') v.paid = 0;
    if (v.paid > v.total + 0.005) throw new Error('Amount paid cannot be more than the invoice total.');
    if (v.type === 'sale' && !v.party && v.paid < v.total - 0.005) throw new Error('A walk-in sale must be paid in full. Choose a customer to sell on credit.');
    if (v.type === 'sale' && !v.party && v.mode === 'credit') throw new Error('A walk-in sale cannot be on credit.');
  }
}

/* ---------- post / edit / cancel ---------- */
function prepare(db, v) {
  validateVoucher(db, v, v.id);
  if (v.lines && ['sale', 'purchase', 'creditnote', 'debitnote'].includes(v.type)) computeDoc(db, v);
  validatePayment(v);
  if (v.lines && v.type === 'adjust') for (const l of v.lines) { const p = prod(db, l.pid); l.name = p ? p.name : l.name; }
}
function finish(db, v) {
  if (v.lines) applyStock(db, v);
  v.entries = buildEntries(db, v);
  if (!v.entries.length || !balanced(v.entries)) throw new Error('This entry does not balance (debits and credits differ). Nothing was saved.');
}
function postVoucher(db, input, user) {
  return run(db, () => {
    const v = JSON.parse(JSON.stringify(input));
    v.id = uid('V'); v.status = 'active'; v.created = new Date().toISOString(); v.by = user || '';
    prepare(db, v);
    v.no = nextNo(db, v.type, v.fy);
    finish(db, v);
    db.vouchers.push(v);
    audit(db, 'create', v, user);
    return v;
  });
}
function editVoucher(db, id, input, user) {
  return run(db, () => {
    const i = db.vouchers.findIndex(x => x.id === id);
    if (i < 0) throw new Error('Voucher not found.');
    const old = db.vouchers[i];
    if (old.status === 'cancelled') throw new Error('A cancelled voucher cannot be edited.');
    if (old.type === 'opening') throw new Error('Opening balances are edited from the party, product or ledger.');
    const oldFy = getYear(db, old.fy); if (oldFy && oldFy.locked) throw new Error(`Financial year ${oldFy.id} is closed.`);
    if (old.lines) revertStock(db, old);
    const v = JSON.parse(JSON.stringify(input));
    v.id = old.id; v.type = old.type; v.status = 'active'; v.created = old.created; v.by = old.by; v.edited = new Date().toISOString(); v.editedBy = user || '';
    prepare(db, v);
    if (v.fy === old.fy) v.no = old.no; else v.no = nextNo(db, v.type, v.fy);
    finish(db, v);
    db.vouchers[i] = v;
    audit(db, 'edit', v, user, old.no === v.no ? '' : `was ${old.no}`);
    return v;
  });
}
function cancelVoucher(db, id, reason, user) {
  return run(db, () => {
    const v = db.vouchers.find(x => x.id === id);
    if (!v) throw new Error('Voucher not found.');
    if (v.status === 'cancelled') throw new Error('Already cancelled.');
    if (v.type === 'opening') throw new Error('Opening balances cannot be cancelled here.');
    const fy = getYear(db, v.fy); if (fy && fy.locked) throw new Error(`Financial year ${fy.id} is closed.`);
    if (v.lines) revertStock(db, v);
    v.status = 'cancelled'; v.cancelled = new Date().toISOString(); v.cancelReason = clean(reason); v.cancelledBy = user || '';
    audit(db, 'cancel', v, user, clean(reason));
    return v;
  });
}

/* ---------- aggregation ---------- */
function live(db) { return db.vouchers.filter(voucherLive); }
function totals(db, from, to) {
  const m = new Map();
  for (const v of live(db)) {
    if ((from && v.date < from) || (to && v.date > to)) continue;
    for (const e of v.entries || []) {
      const t = m.get(e.acc) || { dr: 0, cr: 0 };
      t.dr += e.dr || 0; t.cr += e.cr || 0; m.set(e.acc, t);
    }
  }
  for (const t of m.values()) { t.dr = r2(t.dr); t.cr = r2(t.cr); }
  return m;
}
const net = (m, id) => { const t = m.get(id); return t ? r2(t.dr - t.cr) : 0; }; // Dr positive
function balanceAt(db, id, to) { return net(totals(db, null, to), id); }

/* Ledger with running balance */
function ledger(db, accId, from, to) {
  const opening = r2(from ? net(totals(db, null, dayBefore(from)), accId) : 0);
  const rows = []; let bal = opening;
  const vs = live(db).filter(v => (!from || v.date >= from) && (!to || v.date <= to) && (v.entries || []).some(e => e.acc === accId)).sort((a, b) => a.date.localeCompare(b.date) || (a.created || '').localeCompare(b.created || ''));
  for (const v of vs) {
    const mine = v.entries.filter(e => e.acc === accId);
    const dr = r2(sum(mine, e => e.dr || 0)), cr = r2(sum(mine, e => e.cr || 0));
    bal = r2(bal + dr - cr);
    const others = [...new Set(v.entries.filter(e => e.acc !== accId).map(e => (acc(db, e.acc) || {}).name || e.acc))];
    rows.push({ v, date: v.date, no: v.no, type: v.type, particulars: others.slice(0, 3).join(', ') + (others.length > 3 ? '…' : ''), narr: v.narr || '', dr, cr, bal });
  }
  return { opening, rows, closing: bal, dr: r2(sum(rows, r => r.dr)), cr: r2(sum(rows, r => r.cr)) };
}
function dayBefore(iso) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }

/* Trial balance */
function trialBalance(db, fyId) {
  const fy = getYear(db, fyId);
  const bs = totals(db, null, fy.end), pl = totals(db, fy.start, fy.end), prior = totals(db, null, dayBefore(fy.start));
  const rows = [];
  for (const a of db.accounts) {
    const n = GROUPS[a.group];
    const b = (n === 'I' || n === 'E') ? net(pl, a.id) : net(bs, a.id);
    if (Math.abs(b) < 0.005) continue;
    rows.push({ acc: a, group: a.group, dr: b > 0 ? b : 0, cr: b < 0 ? -b : 0 });
  }
  let pb = 0;
  for (const a of db.accounts) if (isPL(db, a.id)) pb += net(prior, a.id);
  pb = r2(pb);
  if (Math.abs(pb) >= 0.005) rows.push({ acc: { id: '_pb', name: 'Profit & Loss A/c (brought forward from earlier years)' }, group: 'Capital Account', dr: pb > 0 ? pb : 0, cr: pb < 0 ? -pb : 0 });
  const dr = r2(sum(rows, r => r.dr)), cr = r2(sum(rows, r => r.cr));
  return { rows, dr, cr, ok: Math.abs(dr - cr) < 0.005 };
}

/* Profit & Loss */
function profitLoss(db, from, to) {
  const m = totals(db, from, to);
  const by = g => db.accounts.filter(a => a.group === g).map(a => ({ id: a.id, name: a.name, amt: net(m, a.id) })).filter(r => Math.abs(r.amt) >= 0.005);
  const salesGross = -net(m, 'SALES'), salesRet = net(m, 'SALES_RET');
  const netSales = r2(salesGross - salesRet);
  const directInc = by('Direct Income').map(r => ({ ...r, amt: -r.amt }));
  const cogs = net(m, 'COGS');
  const directExp = by('Direct Expenses');
  const gross = r2(netSales + sum(directInc, r => r.amt) - cogs - sum(directExp, r => r.amt));
  const indInc = by('Indirect Income').map(r => ({ ...r, amt: -r.amt }));
  const indExp = by('Indirect Expenses');
  const netProfit = r2(gross + sum(indInc, r => r.amt) - sum(indExp, r => r.amt));
  const revenue = r2(netSales + sum(directInc, r => r.amt) + sum(indInc, r => r.amt));
  return { salesGross: r2(salesGross), salesRet: r2(salesRet), netSales, directInc, cogs: r2(cogs), directExp, gross, indInc, indExp, netProfit, revenue, expenses: r2(sum(directExp, r => r.amt) + sum(indExp, r => r.amt)) };
}

/* Balance sheet */
function balanceSheet(db, fyId, asOn) {
  const fy = getYear(db, fyId); const to = asOn || fy.end;
  const bs = totals(db, null, to);
  const prior = totals(db, null, dayBefore(fy.start));
  const cur = profitLoss(db, fy.start, to);
  let priorProfit = 0; for (const a of db.accounts) if (isPL(db, a.id)) priorProfit -= net(prior, a.id);
  priorProfit = r2(priorProfit);
  const groupRows = (nat, sign) => {
    const g = {};
    for (const a of db.accounts) {
      if (GROUPS[a.group] !== nat) continue;
      const b = net(bs, a.id) * sign;
      if (Math.abs(b) < 0.005) continue;
      (g[a.group] = g[a.group] || { group: a.group, total: 0, items: [] });
      g[a.group].items.push({ id: a.id, name: a.name, amt: r2(b) }); g[a.group].total = r2(g[a.group].total + b);
    }
    return Object.values(g);
  };
  const assets = groupRows('A', 1), liabs = groupRows('L', -1);
  const capGroup = liabs.find(g => g.group === 'Capital Account');
  const extra = [];
  if (Math.abs(priorProfit) >= 0.005) extra.push({ name: 'Retained profit (earlier years)', amt: priorProfit });
  extra.push({ name: cur.netProfit >= 0 ? 'Net profit (this year)' : 'Net loss (this year)', amt: cur.netProfit });
  const totalAssets = r2(sum(assets, g => g.total));
  const totalLiab = r2(sum(liabs, g => g.total) + priorProfit + cur.netProfit);
  return { assets, liabs, extra, capGroup, totalAssets, totalLiab, ok: Math.abs(totalAssets - totalLiab) < 0.005, netProfit: cur.netProfit, priorProfit, to };
}

/* Party summary (khata) */
function partySummary(db, pid, from, to) {
  const p = party(db, pid);
  const l = ledger(db, pid, from, to);
  let debit = 0, credit = 0, received = 0, paid = 0;
  for (const r of l.rows) { if (r.type === 'opening') continue; debit += r.dr; credit += r.cr; }
  for (const v of live(db)) {
    if ((from && v.date < from) || (to && v.date > to)) continue;
    for (const e of v.entries || []) if (e.acc === pid && e.settle) { received += e.cr || 0; paid += e.dr || 0; }
  }
  const lifetimeOpening = r2((p.openingType === 'Cr' ? -1 : 1) * (p.opening || 0));
  return { p, opening: from ? l.opening : lifetimeOpening, debit: r2(debit), credit: r2(credit), received: r2(received), paid: r2(paid), closing: l.closing, rows: l.rows };
}
function outstanding(db, type, to) {
  const m = totals(db, null, to);
  return db.parties.filter(p => p.type === type).map(p => ({ p, bal: net(m, p.id) })).filter(r => Math.abs(r.bal) >= 0.005);
}

/* invoice settlement status */
function invoiceStatus(db, v) {
  if (v.status === 'cancelled') return { label: 'Cancelled', paid: 0, balance: 0 };
  let paid = v.paid || 0;
  const settleType = v.type === 'sale' ? 'receipt' : 'payment';
  const retType = v.type === 'sale' ? 'creditnote' : 'debitnote';
  for (const x of live(db)) {
    if (x.against !== v.id) continue;
    if (x.type === settleType || x.type === retType) paid += x.type === settleType ? x.amount : x.total;
  }
  paid = r2(Math.min(paid, v.total));
  const balance = r2(v.total - paid);
  return { label: balance <= 0.005 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid'), paid, balance };
}

/* ---------- monthly series ---------- */
function monthKeys(fy) {
  const y = Number(fy.start.slice(0, 4));
  return MONTHS.map((m, i) => { const mm = ((i + 3) % 12) + 1; const yy = mm >= 4 ? y : y + 1; return { label: m, from: `${yy}-${pad(mm, 2)}-01`, to: `${yy}-${pad(mm, 2)}-${pad(new Date(yy, mm, 0).getDate(), 2)}`, key: `${yy}-${pad(mm, 2)}` }; });
}
function monthlySeries(db, fyId) {
  const fy = getYear(db, fyId);
  return monthKeys(fy).map(mo => {
    const m = totals(db, mo.from, mo.to);
    const pl = profitLoss(db, mo.from, mo.to);
    const purchases = r2(sum(live(db).filter(v => v.date >= mo.from && v.date <= mo.to && v.type === 'purchase'), v => v.taxable) - sum(live(db).filter(v => v.date >= mo.from && v.date <= mo.to && v.type === 'debitnote'), v => v.taxable));
    return { ...mo, sales: pl.netSales, purchases, expenses: pl.expenses, profit: pl.netProfit, revenue: pl.revenue };
  });
}

/* ---------- GST ---------- */
function gstData(db, from, to) {
  const inRange = v => voucherLive(v) && v.date >= from && v.date <= to;
  const sales = db.vouchers.filter(v => inRange(v) && (v.type === 'sale' || v.type === 'creditnote')).sort((a, b) => a.date.localeCompare(b.date));
  const purch = db.vouchers.filter(v => inRange(v) && (v.type === 'purchase' || v.type === 'debitnote')).sort((a, b) => a.date.localeCompare(b.date));
  const sgn = v => (v.type === 'creditnote' || v.type === 'debitnote') ? -1 : 1;
  const tot = list => ({ taxable: r2(sum(list, v => sgn(v) * v.taxable)), cgst: r2(sum(list, v => sgn(v) * v.cgst)), sgst: r2(sum(list, v => sgn(v) * v.sgst)), igst: r2(sum(list, v => sgn(v) * v.igst)), total: r2(sum(list, v => sgn(v) * v.total)) });
  const out = tot(sales), itc = tot(purch);
  const outTax = r2(out.cgst + out.sgst + out.igst), itcTax = r2(itc.cgst + itc.sgst + itc.igst);
  const hsn = {};
  for (const v of [...sales, ...purch]) {
    const outward = v.type === 'sale' || v.type === 'creditnote';
    for (const l of v.lines || []) {
      const k = (outward ? 'O|' : 'I|') + (l.hsn || '-') + '|' + l.gst;
      const h = hsn[k] || (hsn[k] = { dir: outward ? 'Outward' : 'Inward', hsn: l.hsn || '-', rate: l.gst, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 });
      const s = sgn(v); h.qty = r3(h.qty + s * l.qty); h.taxable = r2(h.taxable + s * l.taxable); h.cgst = r2(h.cgst + s * l.cgst); h.sgst = r2(h.sgst + s * l.sgst); h.igst = r2(h.igst + s * l.igst);
    }
  }
  return { sales, purch, out, itc, outTax, itcTax, payable: r2(outTax - itcTax), hsn: Object.values(hsn).sort((a, b) => a.dir.localeCompare(b.dir) || a.hsn.localeCompare(b.hsn)), sgn };
}

/* ---------- cash flow ---------- */
function cashFlow(db, fyId) {
  const fy = getYear(db, fyId);
  const ids = db.accounts.filter(a => a.group === 'Cash-in-Hand' || a.group === 'Bank Accounts').map(a => a.id);
  const opening = r2(sum(ids, id => balanceAt(db, id, dayBefore(fy.start))));
  const byType = {}; const monthly = monthKeys(fy).map(m => ({ ...m, inflow: 0, outflow: 0 }));
  for (const v of live(db)) {
    if (v.date < fy.start || v.date > fy.end) continue;
    if (v.type === 'contra') continue;
    let inn = 0, out = 0;
    for (const e of v.entries || []) if (ids.includes(e.acc)) { inn += e.dr || 0; out += e.cr || 0; }
    if (!inn && !out) continue;
    const k = v.type; const b = byType[k] || (byType[k] = { type: k, inflow: 0, outflow: 0 });
    b.inflow = r2(b.inflow + inn); b.outflow = r2(b.outflow + out);
    const mo = monthly.find(m => v.date >= m.from && v.date <= m.to); if (mo) { mo.inflow = r2(mo.inflow + inn); mo.outflow = r2(mo.outflow + out); }
  }
  let run_ = opening; for (const m of monthly) { run_ = r2(run_ + m.inflow - m.outflow); m.closing = run_; }
  return { opening, byType: Object.values(byType), monthly, closing: run_, inflow: r2(sum(monthly, m => m.inflow)), outflow: r2(sum(monthly, m => m.outflow)) };
}

/* ---------- dashboard ---------- */
function dashboard(db) {
  const fy = getYear(db); if (!fy) return null;
  const pl = profitLoss(db, fy.start, fy.end);
  const m = totals(db, null, fy.end);
  const purchases = r2(sum(live(db).filter(v => v.fy === fy.id && v.type === 'purchase'), v => v.taxable) - sum(live(db).filter(v => v.fy === fy.id && v.type === 'debitnote'), v => v.taxable));
  const recv = r2(sum(outstanding(db, 'customer', fy.end).filter(r => r.bal > 0), r => r.bal));
  const pay = r2(sum(outstanding(db, 'supplier', fy.end).filter(r => r.bal < 0), r => -r.bal));
  const cash = r2(net(m, 'CASH'));
  const bank = r2(sum(db.accounts.filter(a => a.group === 'Bank Accounts'), a => net(m, a.id)));
  const t = todayISO();
  const mo = monthlySeries(db, fy.id);
  const curKey = t.slice(0, 7);
  const cm = mo.find(x => x.key === curKey) || [...mo].reverse().find(x => x.sales || x.expenses) || mo[0];
  return { fy, pl, purchases, recv, pay, cash, bank, stock: r2(net(m, 'STOCK')), today: db.vouchers.filter(v => v.date === t && voucherLive(v) && v.type !== 'opening'), months: mo, curMonth: cm,
    lowStock: db.products.filter(p => p.qty <= p.min && (p.min > 0 || p.qty <= 0)) };
}

/* ---------- amount in words (Indian) ---------- */
function inWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  n = r2(n); let rupees = Math.floor(n), paise = Math.round((n - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
  const parts = [];
  const cr = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lk = Math.floor(rupees / 100000); rupees %= 100000;
  const th = Math.floor(rupees / 1000); rupees %= 1000;
  if (cr) parts.push(three(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (rupees) parts.push(three(rupees));
  let s = (parts.join(' ') || 'Zero') + ' Rupees';
  if (paise) s += ' and ' + two(paise) + ' Paise';
  return s + ' Only';
}

return { r2, r3, num, uid, todayISO, pad, MONTHS, STATES, RX, GROUPS, EXPENSE_ACCS, SETTINGS_DEFAULT, PREFIX,
  newDB, acc, prod, party, nature, isPL, voucherLive, yearRange, addYear, getYear, fyOfDate, run, audit, checkBusiness,
  saveParty, deleteParty, saveAccount, saveProduct, deleteProduct, setOpening, postVoucher, editVoucher, cancelVoucher, computeDoc,
  totals, net, balanceAt, ledger, dayBefore, trialBalance, profitLoss, balanceSheet, partySummary, outstanding, invoiceStatus,
  monthKeys, monthlySeries, gstData, cashFlow, dashboard, inWords, payAcc, sum, live };
})();
if (typeof module !== 'undefined') module.exports = ENGINE;
