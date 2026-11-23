/* Optional sample data. Everything is posted through the real engine, so books stay consistent. */
function seedSample(E, db, user) {
  const s = db.settings;
  const fill = (k, v) => { if (!s[k]) s[k] = v; };
  fill('ownerName', 'Sample Owner'); fill('address', '12, Auto Parts Market, Main Road'); fill('city', 'Pune');
  fill('state', 'Maharashtra'); fill('stateCode', '27'); fill('pincode', '411002'); fill('mobile', '9800000001'); fill('email', 'accounts@example.com');
  fill('gstin', '27ABCDE1234F1Z5'); fill('pan', 'ABCDE1234F'); fill('bankName', 'Sample Bank'); fill('accountNo', '000123456789'); fill('ifsc', 'SBIN0001234'); fill('branch', 'Main Branch'); fill('upi', 'shreetraders@upi');
  const fy = E.getYear(db);
  const y0 = Number(fy.start.slice(0, 4));
  const D = (mi, d) => { const mm = ((mi + 3) % 12) + 1; const yy = mm >= 4 ? y0 : y0 + 1; return `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
  const today = E.todayISO();
  const ok = d => d <= today && d >= fy.start && d <= fy.end;

  E.setOpening(db, 'acc', 'CASH', 50000, 'Dr'); E.setOpening(db, 'acc', 'BANK', 250000, 'Dr'); E.setOpening(db, 'acc', 'CAPITAL', 0, 'Cr');
  const cust = [['Sample Ravi Auto Works', '9811111101', 'Shivaji Nagar, Pune', '27AAAPL1234C1Z5', 'Dr', 8000], ['Sample Patil Motors', '9811111102', 'Kothrud, Pune', '', 'Dr', 0], ['Sample Gujarat Bikes', '9811111103', 'Surat, Gujarat', '24AABCU9603R1ZX', 'Dr', 0], ['Sample City Garage', '9811111104', 'Camp, Pune', '', 'Dr', 0], ['Sample Rider Hub', '9811111105', 'Hadapsar, Pune', '27AAACR5055K1Z7', 'Dr', 0]]
    .map(c => E.saveParty(db, { type: 'customer', name: c[0], mobile: c[1], address: c[2], gstin: c[3], openingType: c[4], opening: c[5] }, user));
  const sup = [['Sample Motomax Distributors', '9822222201', 'Chakan, Pune', '27AAACM1234D1Z2', 0], ['Sample Speedline Spares', '9822222202', 'Ahmedabad, Gujarat', '24AAACS8577K1ZV', 0], ['Sample Ridefit Industries', '9822222203', 'Nashik', '27AABCR2345E1Z9', 0]]
    .map(c => E.saveParty(db, { type: 'supplier', name: c[0], mobile: c[1], address: c[2], gstin: c[3], openingType: 'Cr', opening: c[4] }, user));
  const P = [
    ['Brake Pad Set (Front)', 'BP-F01', 'Brakes', 'Motomax', 95, 150, 28, 10, 40], ['Brake Shoe (Rear)', 'BS-R01', 'Brakes', 'Motomax', 70, 115, 28, 10, 30],
    ['Chain Sprocket Kit', 'CS-K01', 'Transmission', 'Speedline', 640, 920, 28, 6, 12], ['Clutch Plate Set', 'CL-P01', 'Transmission', 'Speedline', 310, 470, 28, 8, 16],
    ['Air Filter', 'AF-01', 'Filters', 'Ridefit', 85, 140, 28, 12, 35], ['Oil Filter', 'OF-01', 'Filters', 'Ridefit', 45, 80, 28, 12, 50],
    ['Spark Plug', 'SP-01', 'Ignition', 'Ridefit', 60, 105, 28, 20, 60], ['Headlight Bulb 12V', 'HB-12', 'Electricals', 'Speedline', 38, 75, 28, 15, 45],
    ['Battery 12V 5Ah', 'BT-5A', 'Electricals', 'Motomax', 780, 1050, 28, 4, 8], ['Engine Oil 10W30 (1L)', 'EO-1L', 'Lubricants', 'Ridefit', 330, 430, 18, 10, 30],
    ['Clutch Cable', 'CC-01', 'Cables', 'Speedline', 55, 98, 18, 10, 25], ['Rear View Mirror (Pair)', 'RM-01', 'Accessories', 'Motomax', 160, 260, 28, 6, 14],
    ['Tyre Tube 2.75-17', 'TT-17', 'Tyres', 'Ridefit', 190, 285, 28, 8, 20], ['Handle Grip (Pair)', 'HG-01', 'Accessories', 'Speedline', 48, 90, 28, 10, 30],
  ].map((p, i) => E.saveProduct(db, { name: p[0], code: p[1], category: p[2], brand: p[3], hsn: '87141090', buy: p[4], sell: p[5], gst: p[6], min: p[7], barcode: '89010000' + String(1000 + i), unit: 'Pcs', openQty: 0 }, user));
  const line = (p, qty, rate, disc) => ({ pid: p.id, qty, rate: rate != null ? rate : p.sell, disc: disc || 0, gst: p.gst });
  const bank = 'BANK';
  const nMonths = 8;
  const bills = [];
  for (let m = 0; m < nMonths; m++) {
    const sp = sup[m % 3];
    const d1 = D(m, 3);
    if (ok(d1)) {
      const pick = [0, 1, 2, 3, 4, 5, 6].map(k => P[(k + m * 2) % P.length]);
      const v = E.postVoucher(db, { type: 'purchase', date: d1, party: sp.id, refNo: `SUP-${m + 1}01`, lines: pick.map((p, k) => line(p, 28 + ((m + k) % 4) * 6, p.buy, 0)), mode: m % 2 ? 'bank' : 'credit', paid: m % 2 ? 0 : 0 }, user);
      bills.push(v);
    }
    const d2 = D(m, 14);
    if (ok(d2)) {
      const pick = [7, 8, 9, 10, 11, 12, 13].map(k => P[(k + m) % P.length]);
      E.postVoucher(db, { type: 'purchase', date: d2, party: sup[(m + 1) % 3].id, refNo: `SUP-${m + 1}02`, lines: pick.map((p, k) => line(p, 26 + ((m + k) % 3) * 6, p.buy, 0)), mode: 'credit', paid: 0 }, user);
    }
  }
  const modes = ['cash', 'upi', 'bank', 'credit'];
  let seq = 0;
  for (let m = 0; m < nMonths; m++) {
    for (const day of [2, 4, 7, 9, 11, 15, 17, 19, 21, 23, 25, 28]) {
      const d = D(m, day); if (!ok(d)) continue;
      seq++;
      const c = cust[seq % cust.length];
      const lines = [];
      for (let k = 0; k < 4; k++) {
        const p = P[(seq * 3 + k * 5 + m) % P.length];
        const live = E.prod(db, p.id);
        const qty = Math.min(6 + ((seq + k * 3) % 9), Math.floor(live.qty));
        if (qty > 0 && !lines.some(l => l.pid === p.id)) lines.push(line(p, qty, null, k === 0 ? 5 : 0));
      }
      if (!lines.length) continue;
      const walkIn = seq % 6 === 0;
      let mode = modes[seq % 4]; if (walkIn && mode === 'credit') mode = 'cash';
      E.postVoucher(db, { type: 'sale', date: d, party: walkIn ? '' : c.id, lines, mode, narr: '' }, user);
    }
    const dr = D(m, 27);
    if (ok(dr)) {
      const c = cust[m % cust.length];
      const bal = E.balanceAt(db, c.id, dr);
      if (bal > 500) E.postVoucher(db, { type: 'receipt', date: dr, party: c.id, amount: Math.round(bal * 0.6), mode: m % 2 ? 'upi' : 'cash', narr: 'Part payment received' }, user);
    }
    const de = D(m, 28);
    if (ok(de)) {
      E.postVoucher(db, { type: 'expense', date: D(m, 1), expAcc: 'EXP_RENT', amount: 9000, mode: 'bank', narr: 'Shop rent' }, user);
      E.postVoucher(db, { type: 'expense', date: D(m, 8), expAcc: 'EXP_ELEC', amount: 2800 + (m % 3) * 350, mode: 'upi', narr: 'Electricity bill' }, user);
      E.postVoucher(db, { type: 'expense', date: D(m, 28), expAcc: 'EXP_SAL', amount: 20000, mode: 'cash', narr: 'Staff salary' }, user);
      if (m % 2 === 0) E.postVoucher(db, { type: 'expense', date: D(m, 18), expAcc: 'EXP_TRANS', amount: 1500 + m * 100, mode: 'cash', narr: 'Freight' }, user);
    }
    const dp = D(m, 26);
    if (ok(dp)) {
      const sp = sup[m % 3];
      const bal = -E.balanceAt(db, sp.id, dp);
      if (bal > 1000) E.postVoucher(db, { type: 'payment', date: dp, party: sp.id, amount: Math.round(bal * 0.5), mode: 'bank', narr: 'Payment to supplier' }, user);
    }
  }
  const t1 = D(5, 10);
  if (ok(t1)) E.postVoucher(db, { type: 'contra', date: t1, fromAcc: 'CASH', toAcc: 'BANK', amount: 20000, mode: 'cash', narr: 'Cash deposited in bank' }, user);
  return db;
}
if (typeof module !== 'undefined') module.exports = seedSample;
