/* ===================== SHREE TRADERS UI: documents, parties, inventory ===================== */
const DOC_TYPES = ['sale', 'purchase', 'creditnote', 'debitnote'];
const waLink = (mobile, text) => { let m = String(mobile || '').replace(/\D/g, ''); if (m.length === 10) m = '91' + m; return `https://wa.me/${m}?text=${encodeURIComponent(text)}`; };
const bankAccounts = () => db.accounts.filter(a => a.group === 'Bank Accounts');
const cashBankAccounts = () => db.accounts.filter(a => a.group === 'Cash-in-Hand' || a.group === 'Bank Accounts');
const voucherAmount = v => v.total != null ? v.total : (v.amount != null ? v.amount : E.sum(v.entries, e => e.dr || 0));
const sumBy = (arr, f) => E.r2(arr.reduce((s, x) => s + f(x), 0));
const inRange = (v, f) => (!f.from || v.date >= f.from) && (!f.to || v.date <= f.to);

/* ---------- list pages: sales & purchases ---------- */
function docList(type) {
  const key = type + 'List'; const f = ui.f[key] = ui.f[key] || { ...fyDef(), status: '' };
  const isSale = type === 'sale';
  const list = db.vouchers.filter(v => v.type === type && inRange(v, f)).sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  const rows = list.map(v => ({ v, st: E.invoiceStatus(db, v) })).filter(r => !f.status || r.st.label === f.status);
  const live = rows.filter(r => r.v.status !== 'cancelled');
  const tot = sumBy(live, r => r.v.total), paid = sumBy(live, r => r.st.paid), due = sumBy(live, r => r.st.balance);
  const tid = type + 'Tbl';
  const rep = { title: isSale ? 'Sales Register' : 'Purchase Register', period: `${dt(f.from)} to ${dt(f.to)}`, cols: [{ h: 'Date', t: 'date' }, { h: 'Number' }, ...(isSale ? [] : [{ h: 'Supplier bill' }]), { h: isSale ? 'Customer' : 'Supplier' }, { h: 'Taxable', t: 'money' }, { h: 'GST', t: 'money' }, { h: 'Total', t: 'money' }, { h: 'Paid', t: 'money' }, { h: 'Balance', t: 'money' }, { h: 'Status' }],
    rows: rows.map(r => [r.v.date, r.v.no, ...(isSale ? [] : [r.v.refNo]), partyName(r.v), r.v.taxable, E.r2(r.v.cgst + r.v.sgst + r.v.igst), r.v.total, r.st.paid, r.st.balance, r.st.label]) };
  const html = `<div class="page-head"><div><h2>${isSale ? 'Sales invoices' : 'Purchase bills'}</h2><p>${isSale ? 'Every invoice updates stock, the customer khata, GST and the books.' : 'Every bill adds stock and input tax credit and updates the supplier khata.'}</p></div>${btn(isSale ? 'New invoice' : 'New purchase bill', 'new-doc', { cls: 'primary', icon: 'plus', d: { type } })}</div>
  <div class="grid g4" style="margin-bottom:16px"><div class="card kpi"><span class="l">${isSale ? 'Invoiced' : 'Billed'}</span><span class="v">${inr(tot)}</span><span class="s">${live.length} ${isSale ? 'invoices' : 'bills'}, incl. GST</span></div><div class="card kpi"><span class="l">${isSale ? 'Received' : 'Paid'}</span><span class="v good">${inr(paid)}</span></div><div class="card kpi"><span class="l">Outstanding</span><span class="v ${due ? 'bad' : ''}">${inr(due)}</span></div><div class="card kpi"><span class="l">Cancelled</span><span class="v">${rows.length - live.length}</span></div></div>
  <div class="card"><header><div class="row">${searchBox(tid, 'Search number or party')}${dateFilter(key, fyDef())}<select data-f="${key}.status" style="width:auto" aria-label="Status">${opts([['Paid', 'Paid'], ['Partial', 'Partly paid'], ['Unpaid', 'Unpaid'], ['Cancelled', 'Cancelled']], f.status, 'All statuses')}</select></div>${exportBtns(key, rep)}</header>
  ${rows.length ? `<div class="scroll"><table class="tbl" id="${tid}"><thead><tr><th>Date</th><th>Number</th>${isSale ? '' : '<th>Supplier bill</th>'}<th>${isSale ? 'Customer' : 'Supplier'}</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${rows.map(({ v, st }) => `<tr class="click ${v.status === 'cancelled' ? 'cancelled' : ''}" data-act="view-voucher" data-id="${v.id}"><td class="nowrap">${dt(v.date)}</td><td class="mono">${esc(v.no)}</td>${isSale ? '' : `<td>${esc(v.refNo)}</td>`}<td>${esc(partyName(v))}</td><td class="num mono">${nf(v.total)}</td><td class="num mono">${nf(st.paid)}</td><td class="num mono">${nf(st.balance)}</td><td class="keep">${chip(st.label, statusChip(st.label))}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><b>No ${isSale ? 'invoices' : 'purchase bills'} in this period</b>Create ${isSale ? 'your first invoice' : 'a purchase bill'} to see it here.</div>`}</div>`;
  return { html, title: isSale ? 'Sales' : 'Purchases' };
}
PAGES.sales = () => docList('sale');
PAGES.purchases = () => docList('purchase');

/* ---------- document builder ---------- */
function startDoc(type, existing, preset) {
  const fy = E.getYear(db); const t = E.todayISO(); const date = t >= fy.start && t <= fy.end ? t : fy.end;
  if (existing) ui.draft = { type: existing.type, id: existing.id, date: existing.date, party: existing.party || '', refNo: existing.refNo || '', refDate: existing.refDate || '', mode: existing.mode || 'cash', bankId: existing.bankId || '', paid: existing.paid != null ? existing.paid : '', narr: existing.narr || '', against: existing.against || '', lines: existing.lines.map(l => ({ pid: l.pid, qty: l.qty, rate: l.rate, disc: l.disc, gst: l.gst, unitCost: l.unitCost })) };
  else ui.draft = Object.assign({ type, date, party: '', refNo: '', refDate: '', mode: type === 'purchase' ? 'credit' : 'cash', bankId: '', paid: '', narr: '', against: '', lines: [] }, preset || {});
  ui.from = type === 'purchase' || type === 'debitnote' ? 'purchases' : (type === 'sale' ? 'sales' : 'vouchers');
  go('doc');
}
const docMeta = { sale: ['New sales invoice', 'Customer', 'customer'], purchase: ['New purchase bill', 'Supplier', 'supplier'], creditnote: ['New credit note (sales return)', 'Customer', 'customer'], debitnote: ['New debit note (purchase return)', 'Supplier', 'supplier'] };
function defaultRate(type, p) { return type === 'purchase' ? p.buy : type === 'debitnote' ? (p.qty > 0 ? E.r2(p.value / p.qty) : p.buy) : p.sell; }
function previewDoc() {
  const d = ui.draft; const c = { type: d.type, party: d.party, lines: d.lines.filter(l => l.pid && E.num(l.qty) > 0).map(l => ({ ...l })) };
  try { E.computeDoc(db, c); } catch (e) { return null; } return c;
}
function partyOptions(type, sel) {
  const want = docMeta[type][2]; const list = db.parties.filter(p => p.type === want).sort((a, b) => a.name.localeCompare(b.name));
  return (type === 'sale' ? `<option value="">Walk-in customer (cash sale)</option>` : `<option value="">Select ${docMeta[type][1].toLowerCase()}</option>`) + list.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}${p.mobile ? ' · ' + p.mobile : ''}</option>`).join('');
}
function lineRow(l, i) {
  const d = ui.draft; const prods = db.products.slice().sort((a, b) => a.name.localeCompare(b.name));
  const showStock = d.type === 'sale' || d.type === 'debitnote';
  return `<tr data-i="${i}"><td style="min-width:230px"><select data-l="${i}.pid" aria-label="Product">${`<option value="">Select product</option>` + prods.map(p => `<option value="${p.id}" ${p.id === l.pid ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)}${showStock ? ` (stock ${qf(p.qty)})` : ''}</option>`).join('')}</select></td>
  <td class="num" style="width:84px"><input data-l="${i}.qty" type="number" min="0" step="any" value="${l.qty}" aria-label="Quantity"></td>
  <td class="num" style="width:104px"><input data-l="${i}.rate" type="number" min="0" step="any" value="${l.rate}" aria-label="Rate"></td>
  <td class="num" style="width:74px"><input data-l="${i}.disc" type="number" min="0" max="100" step="any" value="${l.disc}" aria-label="Discount percent"></td>
  <td style="width:84px"><select data-l="${i}.gst" aria-label="GST rate">${S().gstRates.map(r => `<option value="${r}" ${+r === +l.gst ? 'selected' : ''}>${r}%</option>`).join('')}</select></td>
  <td class="num mono" style="width:112px" data-lt="${i}">0.00</td><td style="width:36px"><button class="x" type="button" data-act="del-line" data-i="${i}" aria-label="Remove line">&times;</button></td></tr>`;
}
function totalsHTML() {
  const d = ui.draft; const c = previewDoc(); const meta = docMeta[d.type];
  if (!c || !c.lines.length) return `<div class="muted">Add products to see totals.</div>`;
  const hasPay = d.type === 'sale' || d.type === 'purchase'; const paid = d.mode === 'credit' ? 0 : (d.paid === '' ? c.total : Math.min(E.num(d.paid), c.total));
  return `<div class="totals"><span>Taxable value</span><span class="num mono">${nf(c.taxable)}</span>${c.inter ? `<span>IGST</span><span class="num mono">${nf(c.igst)}</span>` : `<span>CGST</span><span class="num mono">${nf(c.cgst)}</span><span>SGST</span><span class="num mono">${nf(c.sgst)}</span>`}${c.round ? `<span>Round off</span><span class="num mono">${c.round > 0 ? '+' : '-'}${nf(c.round)}</span>` : ''}<span class="gt">Grand total</span><span class="gt num mono">${inr(c.total)}</span>${hasPay ? `<span>${d.type === 'sale' ? 'Received now' : 'Paid now'}</span><span class="num mono">${nf(paid)}</span><span><b>Balance on credit</b></span><span class="num mono"><b>${nf(c.total - paid)}</b></span>` : ''}</div><div class="small muted" style="margin-top:8px">${c.inter ? 'Inter-state supply: IGST applies.' : 'Intra-state supply: CGST and SGST apply.'}</div>`;
}
function refreshTotals() {
  const c = previewDoc();
  $$('[data-lt]').forEach(td => { const i = +td.dataset.lt; const pl = c && ui.draft.lines.filter(l => l.pid && E.num(l.qty) > 0); const line = ui.draft.lines[i]; const idx = c ? pl.indexOf(line) : -1; td.textContent = idx >= 0 ? nf(c.lines[idx].total) : '0.00'; });
  const t = $('#docTotals'); if (t) t.innerHTML = totalsHTML();
}
function payBox() {
  const d = ui.draft; if (d.type !== 'sale' && d.type !== 'purchase') return '';
  const banks = bankAccounts(); const word = d.type === 'sale' ? 'received' : 'paid';
  return `<div class="stack"><div><div class="small muted" style="margin-bottom:6px">Payment mode</div><div class="seg" role="radiogroup">${[['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank transfer'], ['credit', 'Credit']].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" data-d="mode" ${d.mode === v ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
  ${d.mode !== 'credit' ? `<div class="grid g2">${field('Amount ' + word + ' now', `<input type="number" min="0" step="any" data-d="paid" value="${d.paid}" placeholder="Full amount">`, { hint: 'Leave blank for the full amount. A part payment leaves the rest on credit.' })}${(d.mode !== 'cash' && banks.length > 1) ? field('Bank account', `<select data-d="bankId">${opts(banks.map(b => [b.id, b.name]), d.bankId || 'BANK')}</select>`) : ''}</div>` : `<div class="notice info">The full amount will be added to the ${d.type === 'sale' ? 'customer' : 'supplier'} khata as outstanding.</div>`}</div>`;
}
PAGES.doc = () => {
  const d = ui.draft; if (!d) return PAGES.dashboard();
  const meta = docMeta[d.type]; const editing = !!d.id; const old = editing ? db.vouchers.find(v => v.id === d.id) : null;
  const refInv = (d.type === 'creditnote' || d.type === 'debitnote') && d.party ? db.vouchers.filter(v => v.type === (d.type === 'creditnote' ? 'sale' : 'purchase') && v.party === d.party && v.status === 'active') : [];
  const html = `<div class="page-head"><div><h2>${editing ? 'Edit ' + esc(TYPE_LABEL[d.type].toLowerCase()) + ' ' + esc(old ? old.no : '') : meta[0]}</h2><p>${editing ? 'Saving reverses the old entry and posts the corrected one, so stock, khata, GST and ledgers stay in step.' : 'Totals, GST and stock update automatically when you save.'}</p></div><div class="row">${btn('Cancel', 'doc-cancel')}${btn(editing ? 'Save changes' : 'Save', 'doc-save', { cls: 'primary' })}</div></div>
  <div class="card" style="margin-bottom:16px"><div class="body grid g4">
    <div style="grid-column:span 2" class="stack" ><label class="f">${meta[1]}${d.type === 'sale' || d.type === 'purchase' || true ? '' : ''}<div class="row" style="flex-wrap:nowrap"><select data-d="party" id="partySel">${partyOptions(d.type, d.party)}</select><button class="btn sm" type="button" data-act="quick-party" data-ptype="${meta[2]}">${ic('plus')}New</button></div></label></div>
    ${field('Date', `<input type="date" data-d="date" value="${d.date}">`, { req: 1 })}
    ${d.type === 'purchase' ? field("Supplier's bill no.", `<input data-d="refNo" value="${esc(d.refNo)}" placeholder="As printed on the bill">`, { req: 1 }) : (refInv.length ? field('Against invoice (optional)', `<select data-d="against" id="againstSel">${opts(refInv.map(v => [v.id, `${v.no} · ${dt(v.date)} · ${nf(v.total)}`]), d.against, 'Not linked')}</select>`) : '<div></div>')}
    ${d.type === 'purchase' ? field('Bill date', `<input type="date" data-d="refDate" value="${d.refDate}">`) : ''}
  </div></div>
  <div class="card" style="margin-bottom:16px"><header><h2>Items</h2><div class="row"><input id="scan" placeholder="Scan barcode or type code, press Enter" style="width:280px" autocomplete="off" aria-label="Scan barcode">${btn('Add line', 'add-line', { icon: 'plus' })}</div></header>
    <div class="scroll"><table class="lines"><thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Rate (₹)</th><th class="num">Disc %</th><th>GST</th><th class="num">Amount</th><th></th></tr></thead><tbody id="lineBody">${d.lines.map(lineRow).join('')}</tbody></table>${db.products.length ? '' : `<div class="empty"><b>No products yet</b>Add products in Inventory first.</div>`}</div></div>
  <div class="grid g2"><div class="card"><div class="body stack">${payBox() ? `<div id="payBox">${payBox()}</div>` : ''}${field('Notes', `<textarea data-d="narr" placeholder="Optional narration">${esc(d.narr)}</textarea>`)}</div></div>
  <div class="card"><div class="body" id="docTotals">${totalsHTML()}</div></div></div>`;
  return { html, title: editing ? 'Edit entry' : meta[0], mount: refreshTotals };
};
function addLineByProduct(p, qty) {
  const d = ui.draft; const ex = d.lines.find(l => l.pid === p.id);
  if (ex) ex.qty = E.r3(E.num(ex.qty) + (qty || 1)); else d.lines.push({ pid: p.id, qty: qty || 1, rate: defaultRate(d.type, p), disc: 0, gst: p.gst });
  $('#lineBody').innerHTML = d.lines.map(lineRow).join(''); refreshTotals();
}
function docInput(el) {
  const d = ui.draft; if (!d) return;
  if (el.dataset.d) {
    const k = el.dataset.d; d[k] = el.type === 'radio' ? el.value : el.value;
    if (k === 'mode') { if (d.mode === 'credit') d.paid = ''; const pb = $('#payBox'); if (pb) pb.innerHTML = payBox(); }
    if (k === 'party') { if (d.against) d.against = ''; if (d.type === 'creditnote' || d.type === 'debitnote') render(); }
    if (k === 'against' && d.against) {
      const inv = db.vouchers.find(v => v.id === d.against);
      if (inv && !d.lines.some(l => l.pid)) { d.lines = inv.lines.map(l => ({ pid: l.pid, qty: l.qty, rate: l.rate, disc: l.disc, gst: l.gst, unitCost: d.type === 'creditnote' ? E.r2(l.cost / l.qty) : undefined })); $('#lineBody').innerHTML = d.lines.map(lineRow).join(''); }
    }
    refreshTotals(); return;
  }
  if (el.dataset.l) {
    const [i, k] = el.dataset.l.split('.'); const l = d.lines[+i]; if (!l) return;
    l[k] = k === 'pid' ? el.value : el.value;
    if (k === 'pid') { const p = E.prod(db, el.value); if (p) { l.rate = defaultRate(d.type, p); l.gst = p.gst; delete l.unitCost; } $('#lineBody').innerHTML = d.lines.map(lineRow).join(''); }
    refreshTotals();
  }
}
function saveDoc() {
  const d = ui.draft; if (ui.saving) return;
  const input = { type: d.type, date: d.date, party: d.party, refNo: d.refNo, refDate: d.refDate, mode: d.mode, bankId: d.bankId, paid: d.mode === 'credit' ? 0 : d.paid, narr: d.narr, against: d.against, lines: d.lines.filter(l => l.pid) };
  if (d.type === 'creditnote' || d.type === 'debitnote') { delete input.mode; delete input.paid; }
  ui.saving = true;
  const v = mutate(() => d.id ? E.editVoucher(db, d.id, input, ui.user.name) : E.postVoucher(db, input, ui.user.name), d.id ? 'Changes saved. Books, stock and GST updated.' : null);
  ui.saving = false;
  if (v && v !== true) { toast(`${TYPE_LABEL[v.type]} ${v.no} saved.`); ui.draft = null; go('view', { vid: v.id }); }
}

/* ---------- voucher view ---------- */
function docPaper(v) {
  const s = S(); const p = v.party ? E.party(db, v.party) : null;
  const titleMap = { sale: 'Tax Invoice', purchase: 'Purchase Bill', creditnote: 'Credit Note', debitnote: 'Debit Note' };
  const sup = v.type === 'purchase' || v.type === 'debitnote';
  const st = (v.type === 'sale' || v.type === 'purchase') ? E.invoiceStatus(db, v) : null;
  const place = p && p.state ? `${p.state} (${p.stateCode})` : (v.inter ? 'Inter-state' : (s.state ? `${s.state} (${s.stateCode})` : ''));
  return `<div class="paper">
  <div class="row sp" style="align-items:flex-start"><div class="row" style="align-items:flex-start;flex-wrap:nowrap">${s.logo ? `<img src="${s.logo}" alt="" style="width:56px;height:56px;object-fit:contain">` : ''}<div><h3>${esc(s.businessName)}</h3><div>${esc(s.address)}${s.city ? ', ' + esc(s.city) : ''} ${esc(s.pincode)}</div><div>${s.state ? esc(s.state) + ' · ' : ''}${s.mobile ? 'Ph ' + esc(s.mobile) : ''}${s.email ? ' · ' + esc(s.email) : ''}</div><div>${s.gstin ? 'GSTIN <b>' + esc(s.gstin) + '</b>' : ''}${s.pan ? ' · PAN <b>' + esc(s.pan) + '</b>' : ''}</div></div></div>
  <div style="text-align:right"><div class="tag">${titleMap[v.type]}</div><div class="mono"><b>${esc(v.no)}</b></div><div>Date: ${dt(v.date)}</div>${v.refNo ? `<div>Bill no: ${esc(v.refNo)}${v.refDate ? ' · ' + dt(v.refDate) : ''}</div>` : ''}${v.status === 'cancelled' ? '<div style="margin-top:6px"><span class="watermark">CANCELLED</span></div>' : ''}</div></div>
  <div class="meta"><div><b>${sup ? 'Supplier' : 'Bill to'}</b><br>${esc(p ? p.name : 'Walk-in customer')}<br>${p ? esc(p.address || '') : ''}${p && p.gstin ? `<br>GSTIN ${esc(p.gstin)}` : ''}${p && p.mobile ? `<br>Ph ${esc(p.mobile)}` : ''}</div><div><b>Place of supply</b><br>${esc(place)}<br>${v.inter ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)'}${v.against ? `<br>Against ${esc((db.vouchers.find(x => x.id === v.against) || {}).no || '')}` : ''}</div></div>
  <div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Description</th><th>HSN</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Disc%</th><th class="num">Taxable</th><th class="num">GST%</th><th class="num">Amount</th></tr></thead><tbody>${v.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.hsn || '')}</td><td class="num mono">${qf(l.qty)}</td><td class="num mono">${nf(l.rate)}</td><td class="num mono">${l.disc || 0}</td><td class="num mono">${nf(l.taxable)}</td><td class="num mono">${l.gst}</td><td class="num mono">${nf(l.total)}</td></tr>`).join('')}</tbody></table></div>
  <div class="sum"><div><span>Taxable value</span><span class="mono">${nf(v.taxable)}</span></div>${v.inter ? `<div><span>IGST</span><span class="mono">${nf(v.igst)}</span></div>` : `<div><span>CGST</span><span class="mono">${nf(v.cgst)}</span></div><div><span>SGST</span><span class="mono">${nf(v.sgst)}</span></div>`}${v.round ? `<div><span>Round off</span><span class="mono">${v.round > 0 ? '+' : '-'}${nf(v.round)}</span></div>` : ''}<div class="gt"><span>Grand total</span><span class="mono">${inr(v.total)}</span></div>${st ? `<div><span>${v.type === 'sale' ? 'Received' : 'Paid'}</span><span class="mono">${nf(st.paid)}</span></div><div><span><b>Balance due</b></span><span class="mono"><b>${nf(st.balance)}</b></span></div>` : ''}</div>
  <p style="margin:12px 0 0"><b>Amount in words:</b> ${E.inWords(v.total)}</p>
  <div class="meta" style="margin-top:14px"><div>${v.type === 'sale' && (s.bankName || s.upi) ? `<b>Bank details</b><br>${esc(s.bankName)} ${s.branch ? '· ' + esc(s.branch) : ''}<br>${s.accountNo ? 'A/c ' + esc(s.accountNo) : ''} ${s.ifsc ? '· IFSC ' + esc(s.ifsc) : ''}${s.upi ? `<br>UPI ${esc(s.upi)}` : ''}` : ''}</div><div style="text-align:right">${v.type === 'sale' || v.type === 'creditnote' ? `For <b>${esc(s.businessName)}</b><br><br><br>Authorised signatory` : ''}</div></div>
  ${v.narr ? `<p><b>Notes:</b> ${esc(v.narr)}</p>` : ''}${v.type === 'sale' && s.terms ? `<p class="small" style="color:#5a6685;margin-bottom:0">${esc(s.terms)}</p>` : ''}${s.footer && v.type === 'sale' ? `<p class="small" style="text-align:center;color:#5a6685;margin:8px 0 0">${esc(s.footer)}</p>` : ''}</div>`;
}
function entriesTable(v) {
  return `<table class="tbl"><thead><tr><th>Ledger account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>${v.entries.map(e => `<tr><td>${esc((E.acc(db, e.acc) || {}).name || e.acc)}</td><td class="num mono">${e.dr ? nf(e.dr) : ''}</td><td class="num mono">${e.cr ? nf(e.cr) : ''}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="num mono">${nf(E.sum(v.entries, e => e.dr || 0))}</td><td class="num mono">${nf(E.sum(v.entries, e => e.cr || 0))}</td></tr></tfoot></table>`;
}
PAGES.view = () => {
  const v = db.vouchers.find(x => x.id === ui.vid); if (!v) return { html: '<div class="empty"><b>Voucher not found</b></div>', title: 'Voucher' };
  const isDoc = DOC_TYPES.includes(v.type); const active = v.status !== 'cancelled'; const p = v.party ? E.party(db, v.party) : null;
  const st = (v.type === 'sale' || v.type === 'purchase') ? E.invoiceStatus(db, v) : null;
  const back = ui.from || 'dashboard';
  let wa = '';
  if (v.type === 'sale' && active) { const txt = `Dear ${p ? p.name : 'Customer'},\nInvoice ${v.no} dated ${dt(v.date)} from ${S().businessName}.\nAmount: ${inr(v.total)}${st && st.balance > 0 ? `\nBalance due: ${inr(st.balance)}` : '\nPaid in full. Thank you!'}${S().upi && st && st.balance > 0 ? `\nPay by UPI: ${S().upi}` : ''}\nThank you for your business.`; wa = `<a class="btn" href="${waLink(p && p.mobile, txt)}" target="_blank" rel="noopener">${ic('wa')}WhatsApp</a>`; }
  const hist = db.audit.filter(a => a.voucher === v.no && a.type === v.type).slice(-6).reverse();
  const html = `<div class="page-head"><div><h2>${esc(TYPE_LABEL[v.type])} <span class="mono">${esc(v.no)}</span> ${v.status === 'cancelled' ? chip('Cancelled', 'gray') : st ? chip(st.label, statusChip(st.label)) : ''}</h2><p>${dt(v.date)}${p ? ' · ' + esc(p.name) : ''}${v.by ? ' · entered by ' + esc(v.by) : ''}${v.cancelReason ? ' · reason: ' + esc(v.cancelReason) : ''}</p></div>
  <div class="row">${btn('Back', 'nav', { d: { page: back } })}${isDoc && active ? btn('PDF / Print', 'invoice-pdf', { icon: 'download', d: { id: v.id } }) : ''}${wa}${st && active && st.balance > 0 ? btn(v.type === 'sale' ? 'Receive payment' : 'Pay supplier', 'settle-invoice', { cls: 'primary', d: { id: v.id } }) : ''}${isAdmin() && active && v.type !== 'opening' ? btn('Edit', 'edit-voucher', { d: { id: v.id } }) + btn('Cancel entry', 'cancel-voucher', { cls: 'danger', d: { id: v.id } }) : ''}</div></div>
  ${isDoc ? docPaper(v) : `<div class="card"><div class="body grid g3"><div><div class="small muted">Type</div>${esc(TYPE_LABEL[v.type])}</div><div><div class="small muted">Amount</div><span class="mono">${inr(voucherAmount(v))}</span></div><div><div class="small muted">${v.mode ? 'Mode' : 'Narration'}</div>${esc(v.mode ? v.mode.toUpperCase() : v.narr || '-')}</div>${v.narr && v.mode ? `<div style="grid-column:1/-1"><div class="small muted">Narration</div>${esc(v.narr)}</div>` : ''}</div></div>`}
  <div class="grid g2" style="margin-top:16px"><div class="card"><header><h2>Accounting entries</h2>${active ? '' : '<span class="small muted">Reversed. Not counted in the books.</span>'}</header><div class="scroll">${entriesTable(v)}</div></div>
  <div class="card"><header><h2>History</h2></header><div class="body small">${hist.length ? hist.map(a => `<div>${esc(a.action)} by ${esc(a.user)} <span class="muted">${new Date(a.t).toLocaleString('en-IN')}</span>${a.info ? ' · ' + esc(a.info) : ''}</div>`).join('') : '<span class="muted">No changes recorded.</span>'}</div></div></div>`;
  return { html, title: TYPE_LABEL[v.type] };
};
async function invoicePDF(v) {
  try {
    await loadLib(LIBS.pdf); await loadLib(LIBS.table);
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' }); const s = S(); const p = v.party ? E.party(db, v.party) : null; const R = n => nf(n);
    const W = 595, M = 40; let y = 44;
    doc.setFillColor(19, 36, 77); doc.rect(0, 0, W, 8, 'F');
    if (s.logo) { try { doc.addImage(s.logo, s.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', M, y - 14, 46, 46); } catch (e) { } }
    const lx = s.logo ? M + 56 : M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(19, 36, 77); doc.text(s.businessName, lx, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
    const addr = [s.address, [s.city, s.state, s.pincode].filter(Boolean).join(', '), [s.mobile && 'Ph ' + s.mobile, s.email].filter(Boolean).join('  |  '), [s.gstin && 'GSTIN ' + s.gstin, s.pan && 'PAN ' + s.pan].filter(Boolean).join('  |  ')].filter(Boolean);
    addr.forEach((l, i) => doc.text(l, lx, y + 13 + i * 11));
    const title = { sale: 'TAX INVOICE', purchase: 'PURCHASE BILL', creditnote: 'CREDIT NOTE', debitnote: 'DEBIT NOTE' }[v.type];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(19, 36, 77); doc.text(title, W - M, y, { align: 'right' });
    doc.setFontSize(9); doc.setTextColor(30); doc.text('No: ' + v.no, W - M, y + 14, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.text('Date: ' + dt(v.date), W - M, y + 26, { align: 'right' });
    if (v.refNo) doc.text('Supplier bill: ' + v.refNo, W - M, y + 38, { align: 'right' });
    if (v.status === 'cancelled') { doc.setTextColor(179, 38, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('CANCELLED', W - M, y + 62, { align: 'right' }); doc.setTextColor(30); }
    y += 74; doc.setDrawColor(200); doc.line(M, y - 6, W - M, y - 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(v.type === 'purchase' || v.type === 'debitnote' ? 'Supplier' : 'Bill to', M, y + 6);
    doc.setFont('helvetica', 'normal'); const bl = [p ? p.name : 'Walk-in customer', p && p.address, p && p.gstin && 'GSTIN ' + p.gstin, p && p.mobile && 'Ph ' + p.mobile].filter(Boolean); bl.forEach((l, i) => doc.text(String(l), M, y + 19 + i * 11));
    doc.setFont('helvetica', 'bold'); doc.text('Place of supply', 330, y + 6); doc.setFont('helvetica', 'normal');
    doc.text((p && p.state ? `${p.state} (${p.stateCode})` : (s.state || '')), 330, y + 19); doc.text(v.inter ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)', 330, y + 30);
    y += 19 + bl.length * 11 + 8;
    doc.autoTable({ startY: y, head: [['#', 'Description', 'HSN', 'Qty', 'Rate', 'Disc%', 'Taxable', 'GST%', 'Amount']], body: v.lines.map((l, i) => [i + 1, l.name, l.hsn || '', qf(l.qty), R(l.rate), l.disc || 0, R(l.taxable), l.gst, R(l.total)]), styles: { fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: [19, 36, 77] }, columnStyles: { 0: { cellWidth: 22 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } }, margin: { left: M, right: M } });
    y = doc.lastAutoTable.finalY + 12;
    const rows = [['Taxable value', R(v.taxable)], ...(v.inter ? [['IGST', R(v.igst)]] : [['CGST', R(v.cgst)], ['SGST', R(v.sgst)]]), ...(v.round ? [['Round off', (v.round > 0 ? '+' : '-') + R(v.round)]] : []), ['Grand total (Rs.)', R(v.total)]];
    const st = (v.type === 'sale' || v.type === 'purchase') ? E.invoiceStatus(db, v) : null; if (st) { rows.push([v.type === 'sale' ? 'Received' : 'Paid', R(st.paid)], ['Balance due', R(st.balance)]); }
    if (y + rows.length * 14 + 120 > 800) { doc.addPage(); y = 50; }
    rows.forEach((r, i) => { const last = r[0].startsWith('Grand'); doc.setFont('helvetica', last ? 'bold' : 'normal'); doc.setFontSize(last ? 11 : 9); doc.text(r[0], 360, y + i * 14); doc.text(r[1], W - M, y + i * 14, { align: 'right' }); });
    y += rows.length * 14 + 6; doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Amount in words:', M, y); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(E.inWords(v.total), 440), M + 82, y);
    y += 30;
    if (v.type === 'sale' && (s.bankName || s.upi)) { doc.setFont('helvetica', 'bold'); doc.text('Bank details', M, y); doc.setFont('helvetica', 'normal'); [s.bankName && `${s.bankName}${s.branch ? ', ' + s.branch : ''}`, s.accountNo && `A/c ${s.accountNo}${s.ifsc ? '  IFSC ' + s.ifsc : ''}`, s.upi && 'UPI ' + s.upi].filter(Boolean).forEach((l, i) => doc.text(l, M, y + 12 + i * 11)); }
    if (v.type === 'sale' || v.type === 'creditnote') { doc.setFont('helvetica', 'bold'); doc.text('For ' + s.businessName, W - M, y, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.text('Authorised signatory', W - M, y + 44, { align: 'right' }); }
    y += 62; if (v.narr) { doc.setFontSize(8.5); doc.text('Notes: ' + v.narr, M, y); y += 12; }
    if (v.type === 'sale' && s.terms) { doc.setFontSize(7.5); doc.setTextColor(100); doc.text(doc.splitTextToSize(s.terms, W - 2 * M), M, y); y += 12; }
    if (s.footer && v.type === 'sale') { doc.setFontSize(8); doc.text(s.footer, W / 2, y + 6, { align: 'center' }); }
    await saveFile(fileStem(`${v.type === 'sale' ? 'Invoice' : TYPE_LABEL[v.type]}_${v.no}`) + '.pdf', doc.output('arraybuffer'));
  } catch (e) { toast(e.message || 'Could not build the PDF.', 'err'); }
}

/* ---------- simple voucher forms (modal) ---------- */
function openInvoicesFor(partyId, type) {
  return db.vouchers.filter(v => v.type === type && v.party === partyId && v.status === 'active').map(v => ({ v, st: E.invoiceStatus(db, v) })).filter(r => r.st.balance > 0.005);
}
function jRow(r = {}) { return `<tr data-jr><td><select name="acc" aria-label="Ledger">${`<option value="">Select ledger</option>` + db.accounts.slice().sort((a, b) => a.name.localeCompare(b.name)).map(a => `<option value="${a.id}" ${a.id === r.acc ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></td><td class="num"><input name="dr" type="number" min="0" step="any" value="${r.dr || ''}" data-jsum aria-label="Debit"></td><td class="num"><input name="cr" type="number" min="0" step="any" value="${r.cr || ''}" data-jsum aria-label="Credit"></td><td><button class="x" type="button" data-act="del-row">&times;</button></td></tr>`; }
function aRow(r = {}) { return `<tr data-ar><td><select name="pid" aria-label="Product">${`<option value="">Select product</option>` + db.products.map(p => `<option value="${p.id}" ${p.id === r.pid ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)} (stock ${qf(p.qty)})</option>`).join('')}</select></td><td class="num"><input name="qty" type="number" step="any" value="${r.qty || ''}" aria-label="Quantity change"></td><td class="num"><input name="rate" type="number" min="0" step="any" value="${r.rate || ''}" aria-label="Cost rate"></td><td><button class="x" type="button" data-act="del-row">&times;</button></td></tr>`; }
function jSum(sc) { let d = 0, c = 0; $$('[data-jr]', sc).forEach(tr => { d += E.num($('[name=dr]', tr).value); c += E.num($('[name=cr]', tr).value); }); const el = $('#jdiff', sc); if (el) { const diff = E.r2(d - c); el.innerHTML = `Debit ${nf(d)} · Credit ${nf(c)} · ` + (Math.abs(diff) < 0.005 ? '<span class="good">Balanced</span>' : `<span class="bad">Difference ${nf(diff)}</span>`); } }
function openVoucherForm(type, existing, preset) {
  const fy = E.getYear(db); const t = E.todayISO(); const dflt = t >= fy.start && t <= fy.end ? t : fy.end; const v = existing || preset || {}; const date = v.date || dflt;
  const modeSel = f => field('Mode', `<select name="mode" id="vMode">${opts([['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank transfer']], v.mode || 'cash')}</select>`);
  const bankSel = bankAccounts().length > 1 ? field('Bank account', `<select name="bankId">${opts(bankAccounts().map(b => [b.id, b.name]), v.bankId || 'BANK')}</select>`) : '';
  let body = '', title = (existing ? 'Edit ' : 'New ') + TYPE_LABEL[type].toLowerCase();
  if (type === 'receipt' || type === 'payment') {
    const want = type === 'receipt' ? 'customer' : 'supplier';
    const parties = db.parties.filter(p => p.type === want).sort((a, b) => a.name.localeCompare(b.name));
    const pid = v.party || '';
    const invs = pid ? openInvoicesFor(pid, type === 'receipt' ? 'sale' : 'purchase') : [];
    body = `<div class="grid g2">${field(want === 'customer' ? 'Received from' : 'Paid to', `<select name="party" id="vParty" data-agp="${type}">${opts(parties.map(p => [p.id, p.name]), pid, 'Select ' + want)}</select>`, { req: 1 })}${field('Date', `<input type="date" name="date" value="${date}">`, { req: 1 })}
    ${field('Amount (₹)', `<input type="number" name="amount" id="vAmt" min="0" step="any" value="${v.amount || ''}">`, { req: 1 })}${modeSel()}${bankSel}${field('Against invoice (optional)', `<select name="against" id="againstSel2">${opts(invs.map(r => [r.v.id, `${r.v.no} · balance ${nf(r.st.balance)}`]), v.against, 'On account / not linked')}</select>`)}</div><div style="margin-top:14px">${field('Narration', `<textarea name="narr">${esc(v.narr || '')}</textarea>`)}</div><div class="small muted" style="margin-top:8px">${type === 'receipt' ? 'Debits cash or bank and credits the customer ledger.' : 'Debits the supplier ledger and credits cash or bank.'}</div>`;
  } else if (type === 'contra') {
    const cb = cashBankAccounts().map(a => [a.id, a.name]);
    body = `<div class="grid g2">${field('From', `<select name="fromAcc">${opts(cb, v.fromAcc || 'CASH')}</select>`, { req: 1 })}${field('To', `<select name="toAcc">${opts(cb, v.toAcc || 'BANK')}</select>`, { req: 1 })}${field('Amount (₹)', `<input type="number" name="amount" min="0" step="any" value="${v.amount || ''}">`, { req: 1 })}${field('Date', `<input type="date" name="date" value="${date}">`, { req: 1 })}</div><div style="margin-top:14px">${field('Narration', `<textarea name="narr">${esc(v.narr || '')}</textarea>`)}</div><div class="small muted" style="margin-top:8px">For cash deposits, withdrawals and bank-to-bank transfers.</div>`;
  } else if (type === 'expense') {
    const ex = db.accounts.filter(a => E.nature(db, a.id) === 'E' && !['COGS', 'ROUNDOFF', 'STOCK_ADJ'].includes(a.id));
    body = `<div class="grid g2">${field('Category', `<select name="expAcc">${opts(ex.map(a => [a.id, a.name]), v.expAcc || 'EXP_RENT')}</select>`, { req: 1 })}${field('Date', `<input type="date" name="date" value="${date}">`, { req: 1 })}${field('Amount (₹)', `<input type="number" name="amount" min="0" step="any" value="${v.amount || ''}">`, { req: 1 })}${modeSel()}${bankSel}</div><div style="margin-top:14px">${field('Description', `<textarea name="narr" placeholder="For example: October shop rent">${esc(v.narr || '')}</textarea>`)}</div><div class="small muted" style="margin-top:8px">Need a new category? Add an expense ledger under Ledger Accounts.</div>`;
  } else if (type === 'journal') {
    const rows = (v.jlines && v.jlines.length ? v.jlines : [{}, {}]);
    body = `<div class="grid g2">${field('Date', `<input type="date" name="date" value="${date}">`, { req: 1 })}</div><div class="scroll" style="margin-top:12px"><table class="lines" style="min-width:520px"><thead><tr><th>Ledger</th><th class="num">Debit</th><th class="num">Credit</th><th></th></tr></thead><tbody id="jBody">${rows.map(jRow).join('')}</tbody></table></div><div class="row sp" style="margin-top:8px">${btn('Add line', 'add-jrow', { icon: 'plus' })}<span id="jdiff" class="small"></span></div><div style="margin-top:14px">${field('Narration', `<textarea name="narr">${esc(v.narr || '')}</textarea>`)}</div>`;
  } else if (type === 'adjust') {
    body = `<div class="grid g2">${field('Date', `<input type="date" name="date" value="${date}">`, { req: 1 })}${field('Reason', `<input name="narr" placeholder="Damaged, counting difference, found stock…" value="${esc(v.narr || '')}">`)}</div><div class="scroll" style="margin-top:12px"><table class="lines" style="min-width:520px"><thead><tr><th>Product</th><th class="num">Qty change (+/-)</th><th class="num">Cost rate (for increases)</th><th></th></tr></thead><tbody id="aBody">${aRow()}</tbody></table></div><div style="margin-top:8px">${btn('Add line', 'add-arow', { icon: 'plus' })}</div><div class="small muted" style="margin-top:8px">Use a positive quantity to add stock and a negative quantity to remove it. Decreases are valued at average cost.</div>`;
    title = 'Stock adjustment';
  }
  const sc = openModal(title, body, { size: type === 'journal' || type === 'adjust' ? 'wide' : '', ok: existing ? 'Save changes' : 'Post entry' });
  if (type === 'journal') jSum(sc);
  sc._onSubmit = () => {
    const f = formData($('form', sc)); const input = { type, date: f.date, narr: f.narr };
    if (type === 'receipt' || type === 'payment') Object.assign(input, { party: f.party, amount: f.amount, mode: f.mode, bankId: f.bankId, against: f.against });
    if (type === 'contra') Object.assign(input, { fromAcc: f.fromAcc, toAcc: f.toAcc, amount: f.amount });
    if (type === 'expense') Object.assign(input, { expAcc: f.expAcc, amount: f.amount, mode: f.mode, bankId: f.bankId });
    if (type === 'journal') input.jlines = $$('[data-jr]', sc).map(tr => ({ acc: $('[name=acc]', tr).value, dr: $('[name=dr]', tr).value, cr: $('[name=cr]', tr).value }));
    if (type === 'adjust') input.lines = $$('[data-ar]', sc).map(tr => ({ pid: $('[name=pid]', tr).value, qty: $('[name=qty]', tr).value, rate: $('[name=rate]', tr).value })).filter(l => l.pid);
    const r = mutate(() => existing ? E.editVoucher(db, existing.id, input, ui.user.name) : E.postVoucher(db, input, ui.user.name));
    if (r && r !== true) { closeModal(sc); toast(`${TYPE_LABEL[type]} ${r.no} posted.`); if (existing) { ui.vid = r.id; go('view'); } else render(); }
  };
}

/* ---------- customers & suppliers (khata) ---------- */
PAGES.parties = () => {
  const f = ui.f.parties = ui.f.parties || { tab: 'customer' }; const fy = E.getYear(db); const cust = f.tab === 'customer';
  const list = db.parties.filter(p => p.type === f.tab).sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ p, s: E.partySummary(db, p.id, null, fy.end) }));
  const totalBal = E.r2(list.reduce((s, r) => s + r.s.closing, 0));
  const rep = { title: cust ? 'Customer Khata' : 'Supplier Khata', period: 'up to ' + dt(fy.end), cols: [{ h: 'Name' }, { h: 'Mobile' }, { h: 'GSTIN' }, { h: 'Opening', t: 'money' }, { h: 'Total debit', t: 'money' }, { h: 'Total credit', t: 'money' }, { h: cust ? 'Amount received' : 'Amount paid', t: 'money' }, { h: 'Remaining balance', t: 'money' }, { h: 'Dr/Cr' }], rows: list.map(({ p, s }) => [p.name, p.mobile, p.gstin, s.opening, s.debit, s.credit, cust ? s.received : s.paid, Math.abs(s.closing), s.closing > 0.004 ? 'Dr' : s.closing < -0.004 ? 'Cr' : '']) };
  const html = `<div class="page-head"><div><h2>Customers & suppliers</h2><p>A khata for every party: opening balance, debits, credits and what remains to collect or pay.</p></div>${btn('Add ' + (cust ? 'customer' : 'supplier'), 'party-form', { cls: 'primary', icon: 'plus', d: { ptype: f.tab } })}</div>
  <div class="tabs" role="tablist">${[['customer', 'Customers'], ['supplier', 'Suppliers']].map(([k, l]) => `<button role="tab" aria-selected="${f.tab === k}" data-act="tab" data-key="parties" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><span class="l">${cust ? 'Customers' : 'Suppliers'}</span><span class="v">${list.length}</span></div><div class="card kpi"><span class="l">${cust ? 'To collect' : 'To pay'}</span><span class="v ${cust ? '' : ''}">${inr(Math.abs(list.reduce((s, r) => s + (cust ? Math.max(0, r.s.closing) : Math.max(0, -r.s.closing)), 0)))}</span><span class="s">Total outstanding</span></div><div class="card kpi"><span class="l">${cust ? 'Advance received' : 'Advance paid'}</span><span class="v">${inr(Math.abs(list.reduce((s, r) => s + (cust ? Math.min(0, r.s.closing) : Math.min(0, -r.s.closing)), 0)))}</span></div></div>
  <div class="card"><header>${searchBox('partyTbl', 'Search name, mobile or GSTIN')}${exportBtns('parties', rep)}</header>${list.length ? `<div class="scroll"><table class="tbl" id="partyTbl"><thead><tr><th>Name</th><th>Mobile</th><th>GSTIN</th><th class="num">Opening</th><th class="num">Total debit</th><th class="num">Total credit</th><th class="num">${cust ? 'Received' : 'Paid'}</th><th class="num">Remaining</th></tr></thead><tbody>${list.map(({ p, s }) => `<tr class="click" data-act="open-party" data-id="${p.id}"><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.address || '')}</div></td><td>${esc(p.mobile)}</td><td class="mono">${esc(p.gstin)}</td><td class="num mono">${nf(s.opening)}</td><td class="num mono">${nf(s.debit)}</td><td class="num mono">${nf(s.credit)}</td><td class="num mono">${nf(cust ? s.received : s.paid)}</td><td class="num mono ${(cust ? s.closing > 0.004 : s.closing < -0.004) ? 'bad' : ''}">${drcr(s.closing)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>No ${cust ? 'customers' : 'suppliers'} yet</b>Add one to start a khata.</div>`}</div>`;
  return { html, title: 'Customers & Suppliers' };
};
function partyForm(type, existing) {
  const p = existing || { type, openingType: type === 'customer' ? 'Dr' : 'Cr' };
  const sc = openModal(existing ? 'Edit ' + p.type : 'New ' + type, `<div class="grid g2">${field('Name', `<input name="name" value="${val(p, 'name')}" required>`, { req: 1, cls: '' })}${field('Mobile', `<input name="mobile" inputmode="numeric" maxlength="10" value="${val(p, 'mobile')}">`)}
  ${field('GSTIN', `<input name="gstin" maxlength="15" style="text-transform:uppercase" value="${val(p, 'gstin')}" placeholder="Optional for unregistered buyers">`, { hint: 'The state is read from the first two digits. It decides CGST/SGST or IGST.' })}${field('State', `<select name="stateCode">${stateOpts(p.stateCode)}</select>`)}
  ${field('Email', `<input name="email" type="email" value="${val(p, 'email')}">`)}${field('Address', `<input name="address" value="${val(p, 'address')}">`)}
  ${field('Opening balance (₹)', `<input name="opening" type="number" min="0" step="any" value="${p.opening || ''}">`)}${field('Opening balance type', `<select name="openingType">${opts([['Dr', p.type === 'customer' || type === 'customer' ? 'Dr: they owe you' : 'Dr: they owe you (advance paid)'], ['Cr', 'Cr: you owe them']], p.openingType)}</select>`)}</div>`, { ok: existing ? 'Save changes' : 'Add' });
  sc._onSubmit = () => { const f = formData($('form', sc)); const r = mutate(() => E.saveParty(db, { ...f, id: existing && existing.id, type: p.type || type }, ui.user.name), existing ? 'Party updated.' : 'Party added.'); if (r) { closeModal(sc); if (ui.afterParty) { const cb = ui.afterParty; ui.afterParty = null; cb(r); } else render(); } };
}
PAGES.party = () => {
  const p = E.party(db, ui.pid); if (!p) return { html: '<div class="empty"><b>Party not found</b></div>' };
  const fy = E.getYear(db); const f = ui.f.khata = ui.f.khata && ui.f.khataPid === p.id ? ui.f.khata : { from: '', to: '' }; ui.f.khataPid = p.id;
  const s = E.partySummary(db, p.id, f.from || null, f.to || fy.end); const cust = p.type === 'customer';
  let bal = s.opening; const rows = s.rows.map(r => [r.date, r.no, TYPE_LABEL[r.type] || r.type, r.particulars, r.dr, r.cr, drcr(r.bal)]);
  const rep = { title: p.name + ' - Khata', period: `${f.from ? dt(f.from) : 'start'} to ${dt(f.to || fy.end)}`, cols: [{ h: 'Date', t: 'date' }, { h: 'Voucher' }, { h: 'Type' }, { h: 'Particulars' }, { h: 'Debit', t: 'money' }, { h: 'Credit', t: 'money' }, { h: 'Balance' }], rows, foot: ['', '', '', 'Closing', s.debit, s.credit, drcr(s.closing)] };
  const msg = `Dear ${p.name}, your outstanding balance with ${S().businessName} is ${inr(Math.abs(s.closing))}${S().upi ? '. You can pay by UPI: ' + S().upi : ''}. Please arrange payment. Thank you.`;
  const owes = cust ? s.closing > 0.004 : s.closing < -0.004;
  const sm = (l, v, c) => `<div class="card kpi"><span class="l">${l}</span><span class="v ${c || ''}">${v}</span></div>`;
  const html = `<div class="page-head"><div><h2>${esc(p.name)} ${chip(cust ? 'Customer' : 'Supplier')}</h2><p>${esc(p.address || '')}${p.mobile ? ' · ' + esc(p.mobile) : ''}${p.gstin ? ' · GSTIN ' + esc(p.gstin) : ''}${p.state ? ' · ' + esc(p.state) : ''}</p></div>
  <div class="row">${btn('Back', 'nav', { d: { page: 'parties' } })}${btn('Edit', 'party-form', { d: { id: p.id } })}${btn(cust ? 'Receive payment' : 'Make payment', 'voucher-form', { cls: 'primary', d: { type: cust ? 'receipt' : 'payment', party: p.id } })}${btn(cust ? 'New invoice' : 'New bill', 'new-doc', { d: { type: cust ? 'sale' : 'purchase', party: p.id } })}${cust && owes ? `<a class="btn" href="${waLink(p.mobile, msg)}" target="_blank" rel="noopener">${ic('wa')}Reminder</a>` : ''}${isAdmin() ? btn('Delete', 'delete-party', { cls: 'danger', d: { id: p.id } }) : ''}</div></div>
  <div class="grid g4" style="margin-bottom:16px">${sm('Opening balance', drcr(s.opening))}${sm('Total debit', inr(s.debit))}${sm('Total credit', inr(s.credit))}${sm(cust ? 'Amount received' : 'Amount paid', inr(cust ? s.received : s.paid), 'good')}</div>
  <div class="banner ${owes ? 'bad' : 'good'}" style="margin-bottom:16px"><div><b>Remaining balance: ${drcr(s.closing)}</b><div class="small">${Math.abs(s.closing) < 0.005 ? 'Settled. Nothing outstanding.' : cust ? (s.closing > 0 ? 'This customer owes you.' : 'You hold an advance from this customer.') : (s.closing < 0 ? 'You owe this supplier.' : 'You have paid this supplier in advance.')}</div></div></div>
  <div class="card"><header><div class="row">${dateFilter('khata', { from: '', to: '' })}</div>${exportBtns('khata', rep)}</header><div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Particulars</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>${f.from ? `<tr><td colspan="6" class="muted">Balance brought forward</td><td class="num mono">${drcr(s.opening)}</td></tr>` : ''}${s.rows.map(r => `<tr class="click" data-act="view-voucher" data-id="${r.v.id}"><td class="nowrap">${dt(r.date)}</td><td class="mono">${esc(r.no)}</td><td>${esc(TYPE_LABEL[r.type] || r.type)}</td><td>${esc(r.particulars)}${r.narr ? `<div class="small muted">${esc(r.narr)}</div>` : ''}</td><td class="num mono">${r.dr ? nf(r.dr) : ''}</td><td class="num mono">${r.cr ? nf(r.cr) : ''}</td><td class="num mono">${drcr(r.bal)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">Closing balance</td><td class="num mono">${nf(s.debit)}</td><td class="num mono">${nf(s.credit)}</td><td class="num mono">${drcr(s.closing)}</td></tr></tfoot></table></div></div>`;
  return { html, title: 'Party Khata' };
};

/* ---------- inventory ---------- */
function productForm(existing) {
  const p = existing || { gst: 18, unit: 'Pcs' };
  const sc = openModal(existing ? 'Edit product' : 'New product', `<div class="grid g2">${field('Product name', `<input name="name" value="${val(p, 'name')}">`, { req: 1 })}${field('Product code', `<input name="code" value="${val(p, 'code')}">`, { req: 1 })}
  ${field('Category', `<input name="category" list="catList" value="${val(p, 'category')}"><datalist id="catList">${[...new Set(db.products.map(x => x.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}${field('Brand', `<input name="brand" value="${val(p, 'brand')}">`)}
  ${field('HSN code', `<input name="hsn" value="${val(p, 'hsn')}" placeholder="e.g. 87141090">`)}${field('Unit', `<input name="unit" value="${val(p, 'unit')}">`)}
  ${field('Purchase price (₹)', `<input name="buy" type="number" min="0" step="any" value="${p.buy || ''}">`)}${field('Selling price (₹)', `<input name="sell" type="number" min="0" step="any" value="${p.sell || ''}">`)}
  ${field('GST %', `<select name="gst">${S().gstRates.map(r => `<option value="${r}" ${+r === +p.gst ? 'selected' : ''}>${r}%</option>`).join('')}</select>`)}${field('Minimum stock level', `<input name="min" type="number" min="0" step="any" value="${p.min || ''}">`)}
  ${field('Barcode', `<input name="barcode" value="${val(p, 'barcode')}" placeholder="Scan or type">`, { hint: 'Scan it on the invoice screen to add the item.' })}
  ${existing ? `<div class="notice info" style="align-self:end">Stock on hand: <b>${qf(p.qty)}</b>. Change it with Stock adjustment.</div>` : `${field('Opening quantity', `<input name="openQty" type="number" min="0" step="any">`)}${field('Opening cost rate (₹)', `<input name="openRate" type="number" min="0" step="any" placeholder="Defaults to purchase price">`)}`}</div>`, { ok: existing ? 'Save changes' : 'Add product' });
  sc._onSubmit = () => { const f = formData($('form', sc)); const r = mutate(() => E.saveProduct(db, { ...f, id: existing && existing.id }, ui.user.name), existing ? 'Product updated.' : 'Product added.'); if (r) { closeModal(sc); render(); } };
}
PAGES.products = () => {
  const f = ui.f.products = ui.f.products || { tab: 'items', cat: '', low: false }; const fy = E.getYear(db);
  const stockVal = E.r2(db.products.reduce((s, p) => s + p.value, 0)); const low = db.products.filter(p => p.qty <= p.min && p.min > 0);
  let body = '';
  if (f.tab === 'items') {
    const cats = [...new Set(db.products.map(p => p.category).filter(Boolean))].sort();
    const list = db.products.filter(p => (!f.cat || p.category === f.cat) && (!f.low || (p.qty <= p.min && p.min > 0))).sort((a, b) => a.name.localeCompare(b.name));
    const rep = { title: 'Stock Report', period: 'as on ' + dt(E.todayISO()), cols: [{ h: 'Code' }, { h: 'Product' }, { h: 'Category' }, { h: 'Brand' }, { h: 'HSN' }, { h: 'GST %', t: 'qty' }, { h: 'Purchase price', t: 'money' }, { h: 'Selling price', t: 'money' }, { h: 'Qty', t: 'qty' }, { h: 'Min', t: 'qty' }, { h: 'Avg cost', t: 'money' }, { h: 'Stock value', t: 'money' }], rows: list.map(p => [p.code, p.name, p.category, p.brand, p.hsn, p.gst, p.buy, p.sell, p.qty, p.min, p.qty > 0 ? E.r2(p.value / p.qty) : 0, p.value]), foot: ['', 'Total', '', '', '', '', '', '', sumBy(list, p => p.qty), '', '', sumBy(list, p => p.value)] };
    body = `<div class="card"><header><div class="row">${searchBox('prodTbl', 'Search name, code or barcode')}<select data-f="products.cat" style="width:auto" aria-label="Category">${opts(cats.map(c => [c, c]), f.cat, 'All categories')}</select><label class="row small" style="gap:6px"><input type="checkbox" data-f="products.low" ${f.low ? 'checked' : ''}> Low stock only</label></div>${exportBtns('stock', rep)}</header>
    ${list.length ? `<div class="scroll"><table class="tbl" id="prodTbl"><thead><tr><th>Code</th><th>Product</th><th>Category</th><th class="num">Buy ₹</th><th class="num">Sell ₹</th><th class="num">GST</th><th class="num">In stock</th><th class="num">Min</th><th class="num">Stock value</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td class="mono">${esc(p.code)}</td><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.brand || '')}${p.barcode ? ' · ' + esc(p.barcode) : ''}</div></td><td>${esc(p.category)}</td><td class="num mono">${nf(p.buy)}</td><td class="num mono">${nf(p.sell)}</td><td class="num mono">${p.gst}%</td><td class="num mono">${qf(p.qty)} <span class="muted small">${esc(p.unit)}</span></td><td class="num mono">${qf(p.min)}</td><td class="num mono">${nf(p.value)}</td><td data-sort>${p.qty <= 0 ? chip('Out of stock', 'bad') : (p.min > 0 && p.qty <= p.min) ? chip('Low', 'warn') : chip('OK', 'good')}</td><td class="nowrap">${btn('Edit', 'product-form', { cls: 'sm', d: { id: p.id } })}${isAdmin() ? btn('Delete', 'delete-product', { cls: 'sm danger', d: { id: p.id } }) : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>${db.products.length ? 'No products match' : 'No products yet'}</b>${db.products.length ? 'Change the filters.' : 'Add your first product to start tracking stock.'}</div>`}</div>`;
  } else if (f.tab === 'profit') {
    const m = {};
    for (const v of E.live(db)) { if (v.fy !== fy.id || (v.type !== 'sale' && v.type !== 'creditnote')) continue; const sg = v.type === 'sale' ? 1 : -1; for (const l of v.lines) { const r = m[l.pid] || (m[l.pid] = { qty: 0, sales: 0, cost: 0 }); r.qty += sg * l.qty; r.sales += sg * l.taxable; r.cost += sg * l.cost; } }
    const rows = Object.entries(m).map(([pid, r]) => { const p = E.prod(db, pid); return [p ? p.code : '', p ? p.name : '', E.r3(r.qty), E.r2(r.sales), E.r2(r.cost), E.r2(r.sales - r.cost), r.sales ? E.r2((r.sales - r.cost) / r.sales * 100) : 0]; }).sort((a, b) => b[5] - a[5]);
    const rep = { title: 'Product-wise Profit', period: 'FY ' + fy.id, cols: [{ h: 'Code' }, { h: 'Product' }, { h: 'Qty sold', t: 'qty' }, { h: 'Sales (excl. GST)', t: 'money' }, { h: 'Cost of goods', t: 'money' }, { h: 'Profit', t: 'money' }, { h: 'Margin %', t: 'money' }], rows, foot: ['', 'Total', '', sumBy(rows, r => r[3]), sumBy(rows, r => r[4]), sumBy(rows, r => r[5]), ''] };
    body = `<div class="card"><header><h2>Product-wise profit, FY ${fy.id}</h2>${exportBtns('pprofit', rep)}</header>${dataTable(rep, { emptyTitle: 'No sales yet', empty: 'Profit per product appears after you sell items.' })}</div>`;
  } else {
    const g = {}; db.products.forEach(p => { const k = p.category || 'Uncategorised'; const r = g[k] || (g[k] = { items: 0, qty: 0, value: 0 }); r.items++; r.qty += p.qty; r.value += p.value; });
    const rows = Object.entries(g).map(([k, r]) => [k, r.items, E.r3(r.qty), E.r2(r.value)]).sort((a, b) => b[3] - a[3]);
    const rep = { title: 'Stock Valuation', period: 'as on ' + dt(E.todayISO()), cols: [{ h: 'Category' }, { h: 'Products', t: 'qty' }, { h: 'Quantity', t: 'qty' }, { h: 'Value at average cost', t: 'money' }], rows, foot: ['Total', db.products.length, sumBy(rows, r => r[2]), stockVal] };
    body = `<div class="card"><header><h2>Stock valuation</h2>${exportBtns('sval', rep)}</header>${dataTable(rep, { emptyTitle: 'No stock' })}<div class="body small muted">Stock is valued at weighted average cost. The total equals the Stock-in-Trade ledger in your balance sheet (${inr(E.balanceAt(db, 'STOCK', fy.end))}).</div></div>`;
  }
  const html = `<div class="page-head"><div><h2>Inventory & stock</h2><p>Stock moves automatically with every purchase, sale and return.</p></div><div class="row">${btn('Stock adjustment', 'voucher-form', { d: { type: 'adjust' } })}${btn('Add product', 'product-form', { cls: 'primary', icon: 'plus' })}</div></div>
  <div class="grid g4" style="margin-bottom:16px"><div class="card kpi"><span class="l">Stock value</span><span class="v">${inr(stockVal)}</span></div><div class="card kpi"><span class="l">Products</span><span class="v">${db.products.length}</span></div><div class="card kpi"><span class="l">Units in stock</span><span class="v">${qf(E.r3(db.products.reduce((s, p) => s + p.qty, 0)))}</span></div><div class="card kpi"><span class="l">Low or out of stock</span><span class="v ${low.length ? 'warn' : ''}">${low.length}</span></div></div>
  <div class="tabs" role="tablist">${[['items', 'Products'], ['profit', 'Product-wise profit'], ['valuation', 'Stock valuation']].map(([k, l]) => `<button role="tab" aria-selected="${f.tab === k}" data-act="tab" data-key="products" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
  return { html, title: 'Inventory' };
};
