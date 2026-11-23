/* ===================== SHREE TRADERS UI: core ===================== */
const E = ENGINE;
const KEY = 'shree_traders_db_v1', KEY_PREV = 'shree_traders_db_prev', SESS = 'shree_traders_session';
const LIBS = { pdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', table: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' };
let db = null;
const ui = { user: null, page: 'dashboard', f: {}, reps: {}, draft: null, vid: null, pid: null, accId: null, storageOk: true };

/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => Math.abs(E.r2(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr = n => (n < -0.004 ? '-' : '') + '₹' + nf(n);
const qf = n => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dt = iso => iso ? `${iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '';
const drcr = b => Math.abs(b) < 0.005 ? '0.00' : `${nf(b)} ${b > 0 ? 'Dr' : 'Cr'}`;
const compact = n => { const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e7) return s + (a / 1e7).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'Cr'; if (a >= 1e5) return s + (a / 1e5).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '') + 'L'; if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K'; return s + Math.round(a); };
const S = () => db.settings;
const TYPE_LABEL = { sale: 'Sales Invoice', purchase: 'Purchase Bill', receipt: 'Receipt', payment: 'Payment', contra: 'Contra', journal: 'Journal', expense: 'Expense', creditnote: 'Credit Note', debitnote: 'Debit Note', adjust: 'Stock Adjustment', opening: 'Opening Balance' };
const isAdmin = () => ui.user && ui.user.role === 'admin';
const ICONS = {
  dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z', sales: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', purchases: 'M3 4h2l2.5 11h10L20 7H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z',
  products: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5', parties: 'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13M9 7h6', ledger: 'M5 3h14v18H5zM9 3v18M12 8h4M12 12h4', voucher: 'M4 7h16v10H4zM4 11h16M8 15h3', journal: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z', trend: 'M3 17l6-6 4 4 8-8M15 7h6v6', sheet: 'M4 4h16v16H4zM12 4v16M4 12h16', gst: 'M7 3h10l4 4v14H3V7zM8 17l8-8M9 10a1 1 0 100-2 1 1 0 000 2zM15 16a1 1 0 100-2 1 1 0 000 2z',
  expense: 'M12 3v18M16 7.5C16 6 14.2 5 12 5s-4 1-4 2.5S9.5 10 12 11s4 1.8 4 3.5S14.2 17 12 17s-4-1-4-2.5', report: 'M5 3h10l4 4v14H5zM14 3v5h5M9 13h6M9 17h6', settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14', download: 'M12 3v12M7 11l5 5 5-5M4 20h16', menu: 'M4 6h16M4 12h16M4 18h16', bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0', logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9', wa: 'M3 21l1.7-5A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4-1zM9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-2z', file: 'M6 3h8l4 4v14H6zM14 3v4h4',
};
const ic = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ICONS.file}"/></svg>`;
const btn = (label, act, o = {}) => `<button class="btn ${o.cls || ''}" data-act="${act}" ${Object.entries(o.d || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${o.dis ? 'disabled' : ''} type="button">${o.icon ? ic(o.icon) : ''}${label}</button>`;
const field = (label, input, o = {}) => `<label class="f ${o.cls || ''}">${label}${o.req ? ' <span class="req">*</span>' : ''}${input}${o.hint ? `<span class="small muted">${o.hint}</span>` : ''}</label>`;
const val = (o, k) => esc(o && o[k] != null ? o[k] : '');
const opts = (list, sel, blank) => (blank != null ? `<option value="">${esc(blank)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');
const stateOpts = sel => opts(Object.entries(E.STATES).map(([c, n]) => [c, `${n} (${c})`]), sel, 'Select state');

/* ---------- storage ---------- */
function loadDB() { try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1 && Array.isArray(d.vouchers)) return d; } } catch (e) { } return null; }
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); ui.storageOk = true; ui.saved = new Date(); }
  catch (e) { ui.storageOk = false; toast('This browser would not save the data. Download a backup now.', 'err'); }
}
function mutate(fn, okMsg) {
  try { const r = fn(); persist(); if (okMsg) toast(okMsg); return r === undefined ? true : r; }
  catch (e) { toast(e.message || String(e), 'err'); return null; }
}
async function hashPin(pin, salt) {
  try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 5381; for (const c of salt + pin) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + h; }
}

/* ---------- toast / modal ---------- */
function toast(msg, kind) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3200);
}
let modalStack = [];
function openModal(title, body, o = {}) {
  const sc = document.createElement('div'); sc.className = 'scrim';
  sc.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="x" data-act="close-modal" aria-label="Close">&times;</button></header><form class="body" novalidate data-form="${o.form || ''}">${body}</form>${o.footer === false ? '' : `<footer>${o.footer || `<button class="btn" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="button" data-act="modal-submit">${o.ok || 'Save'}</button>`}</footer>`}</div>`;
  sc.addEventListener('mousedown', e => { if (e.target === sc && !o.sticky) closeModal(sc); });
  document.body.appendChild(sc); modalStack.push(sc);
  const first = $('input:not([type=hidden]):not([disabled]), select', sc); if (first && !o.noFocus) first.focus();
  sc._onSubmit = o.onSubmit; return sc;
}
function closeModal(sc) { sc = sc || modalStack[modalStack.length - 1]; if (!sc) return; sc.remove(); modalStack = modalStack.filter(x => x !== sc); }
function formData(form) {
  const o = {}; for (const el of form.elements) { if (!el.name) continue; if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value; } return o;
}
function confirmBox(msg, okLabel, danger) {
  return new Promise(res => {
    const sc = openModal('Please confirm', `<p style="margin:0">${msg}</p>`, { size: 'narrow', sticky: true, footer: `<button class="btn" type="button" data-act="cf-no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-act="cf-yes">${okLabel || 'Confirm'}</button>` });
    sc.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'cf-yes') { closeModal(sc); res(true); } if (a.dataset.act === 'cf-no' || a.dataset.act === 'close-modal') { closeModal(sc); res(false); } }, true);
  });
}

/* ---------- libraries & exports ---------- */
const libP = {};
function loadLib(src) {
  if (!libP[src]) libP[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete libP[src]; rej(new Error('Could not load an export library. Check your internet connection.')); }; document.head.appendChild(s); });
  return libP[src];
}
async function saveFile(name, data) {
  let d = null; try { d = window.claude && claude.use ? await claude.use('downloads') : null; } catch (e) { }
  if (d) {
    try { await d.save({ filename: name, data }); toast('Saved ' + name); } catch (e) { if (e && e.code === 'declined') return; toast('Could not save the file' + (e && e.message ? ': ' + e.message : '.'), 'err'); }
    return;
  }
  try { const blob = new Blob([data]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Downloaded ' + name); }
  catch (e) { toast('Downloads are not available in this view.', 'err'); }
}
const fileStem = s => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
const cellVal = (c, t) => (t === 'money' || t === 'qty') ? (typeof c === 'number' ? c : c) : (t === 'date' ? dt(c) : (c == null ? '' : String(c).replace(/<[^>]+>/g, '')));
async function exportRep(key, fmt) {
  const rep = ui.reps[key]; if (!rep) return;
  const stem = fileStem(`${S().businessName}_${rep.title}_${rep.period || ''}`);
  try {
    if (fmt === 'csv') {
      const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const lines = [[S().businessName], [rep.title + (rep.period ? ' (' + rep.period + ')' : '')], [], rep.cols.map(c => c.h), ...rep.rows.map(r => r.map((c, i) => cellVal(c, rep.cols[i].t))), ...(rep.foot ? [rep.foot.map((c, i) => cellVal(c, rep.cols[i].t))] : [])];
      await saveFile(stem + '.csv', '﻿' + lines.map(l => l.map(q).join(',')).join('\r\n'));
    } else if (fmt === 'xlsx') {
      await loadLib(LIBS.xlsx);
      const aoa = [[S().businessName], [rep.title + (rep.period ? ' (' + rep.period + ')' : '')], [], rep.cols.map(c => c.h), ...rep.rows.map(r => r.map((c, i) => cellVal(c, rep.cols[i].t))), ...(rep.foot ? [rep.foot.map((c, i) => cellVal(c, rep.cols[i].t))] : [])];
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = rep.cols.map(c => ({ wch: Math.max(12, Math.min(34, c.h.length + 6)) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, fileStem(rep.title).slice(0, 30) || 'Report');
      await saveFile(stem + '.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    } else {
      await loadLib(LIBS.pdf); await loadLib(LIBS.table);
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: rep.cols.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
      doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text(S().businessName, 40, 42);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text(rep.title + (rep.period ? '  |  ' + rep.period : ''), 40, 60);
      const fmtc = (c, t) => t === 'money' ? (typeof c === 'number' ? nf(c) + (c < 0 ? ' (-)' : '') : c) : cellVal(c, t);
      doc.autoTable({ startY: 74, head: [rep.cols.map(c => c.h)], body: rep.rows.map(r => r.map((c, i) => fmtc(c, rep.cols[i].t))), foot: rep.foot ? [rep.foot.map((c, i) => fmtc(c, rep.cols[i].t))] : undefined, styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [19, 36, 77] }, footStyles: { fillColor: [230, 235, 248], textColor: [19, 36, 77] }, columnStyles: Object.fromEntries(rep.cols.map((c, i) => [i, { halign: (c.t === 'money' || c.t === 'qty') ? 'right' : 'left' }])), margin: { left: 40, right: 40 } });
      await saveFile(stem + '.pdf', doc.output('arraybuffer'));
    }
  } catch (e) { toast(e.message || 'Export failed.', 'err'); }
}

/* ---------- table / report rendering ---------- */
function cellHTML(c, t) {
  if (t === 'money') return `<td class="num">${typeof c === 'number' ? (c < 0 ? `<span class="bad">${nf(c)}</span>` : nf(c)) : esc(c ?? '')}</td>`;
  if (t === 'qty') return `<td class="num">${typeof c === 'number' ? qf(c) : esc(c ?? '')}</td>`;
  if (t === 'date') return `<td class="nowrap">${dt(c)}</td>`;
  if (t === 'html') return `<td>${c ?? ''}</td>`;
  return `<td>${esc(c ?? '')}</td>`;
}
function dataTable(rep, o = {}) {
  if (!rep.rows.length) return `<div class="empty"><b>${esc(o.emptyTitle || 'Nothing to show')}</b>${esc(o.empty || 'There are no records for this selection.')}</div>`;
  return `<div class="scroll"><table class="tbl" ${o.id ? `id="${o.id}"` : ''}><thead><tr>${rep.cols.map(c => `<th class="${c.t === 'money' || c.t === 'qty' ? 'num' : ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rep.rows.map((r, ri) => `<tr ${rep.rowAttr && rep.rowAttr[ri] ? rep.rowAttr[ri] : ''}>${r.map((c, i) => cellHTML(c, rep.cols[i].t)).join('')}</tr>`).join('')}</tbody>${rep.foot ? `<tfoot><tr>${rep.foot.map((c, i) => cellHTML(c, rep.cols[i].t)).join('')}</tr></tfoot>` : ''}</table></div>`;
}
function exportBtns(key, rep) {
  ui.reps[key] = rep;
  return `<div class="row">${['pdf', 'xlsx', 'csv'].map(f => `<button class="btn sm" type="button" data-act="export" data-key="${key}" data-fmt="${f}">${ic('download')}${f === 'xlsx' ? 'Excel' : f.toUpperCase()}</button>`).join('')}</div>`;
}
const searchBox = (tid, ph) => `<input class="search" type="search" placeholder="${esc(ph || 'Search')}" data-filter="${tid}" aria-label="Search table">`;
function applyFilter(input) {
  const t = document.getElementById(input.dataset.filter); if (!t) return; const q = input.value.toLowerCase().trim();
  $$('tbody tr', t).forEach(tr => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); });
}
const dateFilter = (key, def) => {
  const f = ui.f[key] = ui.f[key] || { from: def.from, to: def.to };
  return `<div class="row"><label class="f" style="flex-direction:row;align-items:center;gap:6px">From <input type="date" data-f="${key}.from" value="${f.from || ''}" style="width:150px"></label><label class="f" style="flex-direction:row;align-items:center;gap:6px">To <input type="date" data-f="${key}.to" value="${f.to || ''}" style="width:150px"></label></div>`;
};
const fyDef = () => { const y = E.getYear(db); return { from: y.start, to: y.end }; };
const statusChip = s => ({ Paid: 'good', Partial: 'warn', Unpaid: 'bad', Cancelled: 'gray' }[s] || '');
const chip = (t, c) => `<span class="chip ${c || ''}">${esc(t)}</span>`;
const partyName = v => v.party ? (E.party(db, v.party) || {}).name || '' : (v.type === 'sale' ? 'Walk-in customer' : '');

/* ---------- charts ---------- */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function barChart(labels, series, o = {}) {
  const W = 680, H = 250, L = 52, R = 10, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
  const all = series.flatMap(s => s.values); const max = niceMax(Math.max(...all, 0)), min = Math.min(...all, 0) < 0 ? -niceMax(-Math.min(...all)) : 0;
  const y = v => T + ih - (v - min) / (max - min) * ih; const gw = iw / labels.length, bw = Math.min(22, gw / (series.length + 1));
  let g = ''; for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`; }
  let bars = '';
  labels.forEach((lb, i) => {
    const cx = L + gw * i + gw / 2; bars += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
    series.forEach((s, k) => { const v = s.values[i]; const x = cx - (series.length * bw) / 2 + k * bw; const y0 = y(0), y1 = y(v); bars += `<rect x="${x}" y="${Math.min(y0, y1)}" width="${bw - 2}" height="${Math.max(Math.abs(y1 - y0), v ? 1 : 0)}" rx="2" fill="${s.color}"><title>${esc(lb)} · ${esc(s.name)}: ${inr(v)}</title></rect>`; });
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Bar chart')}">${g}<line class="axis" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>${bars}</svg>`;
}
function lineChart(labels, values, o = {}) {
  const W = 680, H = 230, L = 52, R = 14, T = 14, B = 28, iw = W - L - R, ih = H - T - B;
  const mx = Math.max(...values, 0), mn = Math.min(...values, 0); const max = mx > 0 ? niceMax(mx) : 1, min = mn < 0 ? -niceMax(-mn) : 0;
  const x = i => L + (labels.length === 1 ? iw / 2 : iw * i / (labels.length - 1)), y = v => T + ih - (v - min) / (max - min) * ih;
  let g = ''; for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`; }
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' '); const area = `${x(0)},${y(0)} ${pts} ${x(values.length - 1)},${y(0)}`;
  const last = values.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Line chart')}">${g}<line class="axis" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/><polygon points="${area}" fill="${o.color || 'var(--c1)'}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${o.color || 'var(--c1)'}" stroke-width="2"/>${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === last ? 4 : 2.5}" fill="${o.color || 'var(--c1)'}"><title>${esc(labels[i])}: ${inr(v)}</title></circle>`).join('')}${labels.map((lb, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`).join('')}</svg>`;
}
function hbars(rows) { const mx = Math.max(...rows.map(r => r.amt), 1); return rows.map(r => `<div class="hbar"><span title="${esc(r.name)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span><div class="track"><div class="fill" style="width:${Math.max(2, r.amt / mx * 100)}%"></div></div><span class="num mono">${nf(r.amt)}</span></div>`).join(''); }

/* ---------- auth ---------- */
function fyStartDefault() { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; }
function authScreen(html) { return `<div class="auth"><div class="card"><div class="body">${html}</div></div></div>`; }
function setupScreen() {
  const y = fyStartDefault();
  return authScreen(`<h1>SHREE TRADERS</h1><p class="muted" style="margin:0 0 16px">Accounting, inventory, GST and khata for your business. Create the administrator account to begin.</p>
  <form data-form="setup" class="stack" novalidate>
    ${field('Business name', `<input name="biz" value="SHREE TRADERS" required>`, { req: 1 })}
    <div class="grid g2">${field('Owner name', `<input name="owner" autocomplete="name" required>`, { req: 1 })}${field('Admin username', `<input name="username" value="admin" autocomplete="username" required>`, { req: 1 })}</div>
    <div class="grid g2">${field('Admin PIN (4 to 8 digits)', `<input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" required>`, { req: 1 })}${field('Confirm PIN', `<input name="pin2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" required>`, { req: 1 })}</div>
    ${field('First accounting year', `<select name="fy">${[y - 1, y, y + 1].map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${E.yearRange(v).id} (1 Apr ${v} to 31 Mar ${v + 1})</option>`).join('')}</select>`, { hint: 'You can add more years later in Settings, for example 2027-28.' })}
    <button class="btn primary" type="submit" style="justify-content:center;padding:10px">Create account and start</button>
    <div class="row sp small muted"><span>Already have a backup file?</span><label class="btn sm" style="cursor:pointer">Restore backup<input type="file" accept=".json,application/json" data-act-change="restore-file" hidden></label></div>
  </form>`);
}
function loginScreen() {
  return authScreen(`<h1>${esc(S().businessName)}</h1><p class="muted" style="margin:0 0 16px">Sign in to continue.</p>
  <form data-form="login" class="stack" novalidate>
    ${field('User', `<select name="uid">${opts(db.users.map(u => [u.id, `${u.name} (${u.role})`]), db.users[0] && db.users[0].id)}</select>`)}
    ${field('PIN', `<input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" required>`)}
    <button class="btn primary" type="submit" style="justify-content:center;padding:10px">Sign in</button>
    <p class="small muted" style="margin:0">Your books are stored in this browser. The PIN keeps casual users out; download a backup regularly from Settings.</p>
  </form>`);
}
async function doSetup(f) {
  const pin = String(f.pin || '');
  if (!f.owner.trim() || !f.biz.trim()) return toast('Enter the business and owner name.', 'err');
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(f.username.trim())) return toast('Username must be 3 to 20 letters or digits.', 'err');
  if (!/^\d{4,8}$/.test(pin)) return toast('PIN must be 4 to 8 digits.', 'err');
  if (pin !== f.pin2) return toast('The two PINs do not match.', 'err');
  const d = E.newDB(); d.settings.businessName = f.biz.trim(); d.settings.ownerName = f.owner.trim();
  E.addYear(d, +f.fy);
  const salt = E.uid('s'); d.users.push({ id: E.uid('U'), name: f.owner.trim(), username: f.username.trim(), role: 'admin', salt, hash: await hashPin(pin, salt) });
  db = d; persist(); ui.user = d.users[0]; try { sessionStorage.setItem(SESS, ui.user.id); } catch (e) { }
  ui.page = 'dashboard'; render(); toast('Welcome. Start with Settings to add your GSTIN and PAN.');
}
async function doLogin(f) {
  const u = db.users.find(x => x.id === f.uid); if (!u) return toast('Choose a user.', 'err');
  if ((await hashPin(f.pin, u.salt)) !== u.hash) return toast('Wrong PIN.', 'err');
  ui.user = u; try { sessionStorage.setItem(SESS, u.id); } catch (e) { } ui.page = 'dashboard'; render();
}
function logout() { ui.user = null; try { sessionStorage.removeItem(SESS); } catch (e) { } render(); }

/* ---------- navigation & layout ---------- */
const NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'dashboard']]],
  ['Trade', [['sales', 'Sales', 'sales'], ['purchases', 'Purchases', 'purchases'], ['products', 'Inventory', 'products'], ['parties', 'Customers & Suppliers', 'parties'], ['expenses', 'Expenses', 'expense']]],
  ['Accounts', [['daybook', 'Day Book', 'book'], ['cashbook', 'Cash Book', 'book'], ['bankbook', 'Bank Book', 'book'], ['ledgers', 'Ledger Accounts', 'ledger'], ['vouchers', 'Vouchers', 'voucher'], ['journal', 'Journal Entries', 'journal', 1], ['trial', 'Trial Balance', 'scale', 1], ['pnl', 'Profit & Loss', 'trend', 1], ['bsheet', 'Balance Sheet', 'sheet', 1]]],
  ['Tax & Reports', [['gst', 'GST', 'gst', 1], ['reports', 'Reports', 'report', 1]]],
  ['Admin', [['settings', 'Settings', 'settings', 1]]],
];
const TITLES = { dashboard: 'Dashboard', sales: 'Sales', purchases: 'Purchases', products: 'Inventory & Stock', parties: 'Customers & Suppliers', party: 'Party Khata', expenses: 'Expenses', daybook: 'Day Book', cashbook: 'Cash Book', bankbook: 'Bank Book', ledgers: 'Ledger Accounts', ledger: 'Ledger', vouchers: 'Vouchers', journal: 'Journal Entries', trial: 'Trial Balance', pnl: 'Profit & Loss Account', bsheet: 'Balance Sheet', gst: 'GST & Tax', reports: 'Reports', settings: 'Settings', doc: 'Entry', view: 'Voucher' };
const PARENT = { party: 'parties', ledger: 'ledgers', doc: null, view: null };
function shell(inner, title) {
  const s = S(); const navPage = PARENT[ui.page] !== undefined ? (PARENT[ui.page] || ui.from || 'dashboard') : ui.page;
  const low = db.products.filter(p => p.qty <= p.min && p.min > 0).length;
  const initials = s.businessName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="shell"><aside class="side" aria-label="Main menu"><div class="brand"><div class="mark">${s.logo ? `<img src="${s.logo}" alt="">` : esc(initials)}</div><div><b>${esc(s.businessName)}</b><span>Accounts FY ${esc(db.fy)}</span></div></div>
  <nav class="nav">${NAV.map(([g, items]) => { const vis = items.filter(i => isAdmin() || !i[3]); return vis.length ? `<h6>${g}</h6>` + vis.map(i => `<button type="button" data-act="nav" data-page="${i[0]}" ${navPage === i[0] ? 'aria-current="page"' : ''}>${ic(i[2])}${i[1]}</button>`).join('') : ''; }).join('')}</nav></aside>
  <div class="main"><header class="top"><button class="btn burger sm" type="button" data-act="burger" aria-label="Menu">${ic('menu')}</button><h1>${esc(title || TITLES[ui.page] || '')}</h1><span class="sp"></span>
    ${low ? `<button class="btn sm" type="button" data-act="lowstock" title="Items at or below minimum stock">${ic('bell')}<span class="warn">${low}</span></button>` : ''}
    <label class="f" style="flex-direction:row;align-items:center;gap:6px"><span class="small muted">FY</span><select data-act-change="set-fy" aria-label="Financial year">${db.years.map(y => `<option value="${y.id}" ${y.id === db.fy ? 'selected' : ''}>${y.id}${y.locked ? ' (closed)' : ''}</option>`).join('')}</select></label>
    <span class="chip gray" title="Signed in">${esc(ui.user.name)} · ${ui.user.role}</span><button class="btn sm" type="button" data-act="logout" aria-label="Sign out">${ic('logout')}</button></header>
  ${ui.storageOk ? '' : `<div class="notice" style="margin:12px 24px 0">This browser is not saving data. Everything will be lost when you close the tab. Download a backup from Settings.</div>`}
  <main class="content">${inner}</main></div></div>`;
}

/* ---------- render ---------- */
const PAGES = {};
function render() {
  const app = $('#app'); closeAllModals();
  if (!db) { app.innerHTML = setupScreen(); return; }
  if (!ui.user) { app.innerHTML = loginScreen(); return; }
  const fy = E.getYear(db);
  if (!fy) { db.fy = db.years[0] && db.years[0].id; }
  let key = ui.page; if (!isAdmin() && NAV.some(g => g[1].some(i => i[0] === key && i[3]))) key = ui.page = 'dashboard';
  const pg = (PAGES[key] || PAGES.dashboard)();
  app.innerHTML = shell(pg.html, pg.title);
  document.body.classList.remove('nav-open');
  if (pg.mount) pg.mount();
}
function closeAllModals() { modalStack.forEach(m => m.remove()); modalStack = []; }
function go(page, o) { ui.page = page; if (o) Object.assign(ui, o); render(); window.scrollTo(0, 0); try { history.replaceState(null, '', '#' + page); } catch (e) { } }

/* ---------- dashboard ---------- */
PAGES.dashboard = () => {
  const d = E.dashboard(db); const fy = d.fy; const admin = isAdmin();
  const empty = !db.vouchers.some(v => v.type !== 'opening');
  const kpi = (l, v, s, cls) => `<div class="card kpi"><span class="l">${l}</span><span class="v ${cls || ''}">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
  const profit = d.pl.netProfit;
  const cm = d.curMonth;
  const exp = d.pl.indExp.concat(d.pl.directExp).filter(r => !['ROUNDOFF'].includes(r.id)).sort((a, b) => b.amt - a.amt).slice(0, 8).filter(r => r.amt > 0);
  const todayRows = d.today.map(v => ({ v })).slice(0, 12);
  const onboarding = empty ? `<div class="card" style="margin-bottom:16px"><header><h2>Get started</h2>${isAdmin() ? btn('Load sample data', 'load-sample') : ''}</header><div class="body"><p style="margin-top:0" class="muted">Your books are empty. Follow these steps, or load sample data to look around first (you can erase it later in Settings).</p><div class="row">${btn('1. Business details', 'nav', { d: { page: 'settings' } })}${btn('2. Add products', 'nav', { d: { page: 'products' } })}${btn('3. Add customers & suppliers', 'nav', { d: { page: 'parties' } })}${btn('4. Create first invoice', 'new-doc', { cls: 'primary', d: { type: 'sale' } })}</div></div></div>` : '';
  const html = `${onboarding}
  ${admin ? `<div class="banner ${profit >= 0 ? 'good' : 'bad'}" style="margin-bottom:16px"><div><b>${profit > 0 ? 'Your business is in profit' : profit < 0 ? 'Your business is running at a loss' : 'Your business is at break-even'} for FY ${fy.id}</b><div class="small">Net ${profit >= 0 ? 'profit' : 'loss'} so far: <span class="mono">${inr(Math.abs(profit))}</span> on revenue of <span class="mono">${inr(d.pl.revenue)}</span></div></div><span class="chip ${profit >= 0 ? 'good' : 'bad'}">${profit >= 0 ? 'Profit' : 'Loss'}</span></div>` : ''}
  <div class="grid g4" style="margin-bottom:16px">
    ${kpi('Total sales', inr(d.pl.netSales), `FY ${fy.id}, excl. GST, net of returns`)}${kpi('Total purchases', inr(d.purchases), 'Excl. GST, net of returns')}
    ${kpi('Receivables', inr(d.recv), 'Owed by customers')}${kpi('Payables', inr(d.pay), 'Owed to suppliers')}
    ${kpi('Stock value', inr(d.stock), `${db.products.length} products at average cost`)}${admin ? kpi('Total profit', inr(profit), `Gross profit ${inr(d.pl.gross)}`, profit >= 0 ? 'good' : 'bad') : kpi('Gross profit', 'Admin only', '')}
    ${kpi('Cash in hand', inr(d.cash), '', d.cash < 0 ? 'bad' : '')}${kpi('Bank balance', inr(d.bank), '', d.bank < 0 ? 'bad' : '')}
    ${kpi('Monthly revenue', inr(cm ? cm.revenue : 0), cm ? cm.label + ' ' + cm.from.slice(0, 4) : '')}${kpi('Monthly expenses', inr(cm ? cm.expenses : 0), cm ? cm.label + ' ' + cm.from.slice(0, 4) : '')}
    ${kpi("Today's transactions", String(d.today.length), dt(E.todayISO()))}${kpi('Low-stock items', String(d.lowStock.length), 'At or below minimum level', d.lowStock.length ? 'warn' : '')}
  </div>
  <div class="grid g2" style="margin-bottom:16px">
    <div class="card"><header><h2>Sales and purchases by month</h2><div class="legend"><span><i style="background:var(--c1)"></i>Sales</span><span><i style="background:var(--c2)"></i>Purchases</span></div></header><div class="body">${barChart(d.months.map(m => m.label), [{ name: 'Sales', color: 'var(--c1)', values: d.months.map(m => m.sales) }, { name: 'Purchases', color: 'var(--c2)', values: d.months.map(m => m.purchases) }], { label: 'Monthly sales and purchases' })}</div></div>
    ${admin ? `<div class="card"><header><h2>Profit by month</h2><span class="small muted">Sales minus cost of goods and expenses</span></header><div class="body">${lineChart(d.months.map(m => m.label), d.months.map(m => m.profit), { label: 'Monthly profit' })}</div></div>` : `<div class="card"><header><h2>Expenses by month</h2></header><div class="body">${barChart(d.months.map(m => m.label), [{ name: 'Expenses', color: 'var(--c3)', values: d.months.map(m => m.expenses) }])}</div></div>`}
  </div>
  <div class="grid g2">
    <div class="card"><header><h2>Expenses by category</h2><span class="small muted">FY ${fy.id}</span></header><div class="body">${exp.length ? hbars(exp) : '<div class="empty">No expenses recorded yet.</div>'}</div></div>
    <div class="card"><header><h2>Today's transactions</h2></header>${todayRows.length ? `<div class="scroll"><table class="tbl"><tbody>${todayRows.map(({ v }) => `<tr class="click" data-act="view-voucher" data-id="${v.id}"><td>${chip(TYPE_LABEL[v.type])}</td><td class="mono">${esc(v.no)}</td><td>${esc(partyName(v) || v.narr || '')}</td><td class="num mono">${nf(v.total != null ? v.total : (v.amount != null ? v.amount : E.sum(v.entries, e => e.dr || 0)))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing posted today.</div>'}</div>
  </div>
  ${d.lowStock.length ? `<div class="card" style="margin-top:16px"><header><h2>Low-stock alerts</h2>${btn('Open inventory', 'lowstock')}</header><div class="scroll"><table class="tbl"><thead><tr><th>Product</th><th>Code</th><th class="num">In stock</th><th class="num">Minimum</th></tr></thead><tbody>${d.lowStock.slice(0, 8).map(p => `<tr><td>${esc(p.name)}</td><td class="mono">${esc(p.code)}</td><td class="num mono ${p.qty <= 0 ? 'bad' : 'warn'}">${qf(p.qty)}</td><td class="num mono">${qf(p.min)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  return { html, title: 'Dashboard' };
};
