const { loadWorkbook, cellValue, isEmptyValue, toNumber, toPercent, findHeader, mergeRangeAt } = require('./excelReader');

const MONEY_FIELDS = ['pagu_revisi', 'lock_pagu', 'periode_lalu', 'periode_ini', 'sampai_periode', 'sisa_anggaran'];
const NUMERIC_FIELDS = [...MONEY_FIELDS, 'persentase'];

// Jenis baris ditentukan dari pola kode uraian. Urutan penting: pola yang lebih spesifik lebih dulu.
const TIPE_RULES = [
  ['PROGRAM', /^[A-Z]{2}$/], //            EC
  ['KEGIATAN', /^[A-Z]{2}\.\d{3,4}$/], //  EC.7911
  ['KRO', /^[A-Z]{3}$/], //                AEF
  ['RO', /^[A-Z]{3}\.\d{3}$/], //          AEF.110
  ['KOMPONEN', /^\d{3}$/], //              051
  ['SUBKOMPONEN', /^\d{3}\.[0-9A-Z]{1,3}$/], // 051.0A
  ['AKUN', /^\d{6}$/], //                  521211 (belanja)
];

const KODE_RE = /^[A-Z0-9]{1,8}(?:\.[A-Z0-9]{1,8})*$/;
const TOTAL_RE = /^jumlah\s+seluruhnya\b/i;

// Batas kolom DECIMAL di database: persentase (10,2) dan uang (20,2)
const MAX_PERCENT = 99999999;
const MAX_MONEY = 999999999999999999;

const round2 = (n) => Math.round(n * 100) / 100;

function colLetter(n) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

// Sel gabungan: ambil nilai dari sel induk (master)
const resolve = (cell) => cell.master || cell;

function tipeOf(kode) {
  const hit = TIPE_RULES.find(([, re]) => re.test(kode));
  return hit ? hit[0] : 'LAINNYA';
}

// Nilai sel menjadi teks. Kode yang tersimpan sebagai angka (mis. 51 diformat 000) dikembalikan ke bentuk tampilannya.
function cellText(cell) {
  const v = cellValue(cell);
  if (isEmptyValue(v)) return '';
  if (v instanceof Date) return '';
  if (typeof v === 'number') {
    const zeros = /^0+$/.test(cell.numFmt || '') ? cell.numFmt.length : 0;
    const s = Number.isInteger(v) ? String(v) : String(v);
    return zeros && s.length < zeros ? s.padStart(zeros, '0') : s;
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

// Teks pada kolom di sebelah kiri kolom angka pertama (area kode + uraian), dari kiri ke kanan.
// Sel gabungan hanya dihitung sekali.
function readTextCells(row, limitCol) {
  const out = [];
  const seen = new Set();
  for (let c = 1; c <= limitCol; c += 1) {
    const cell = resolve(row.getCell(c));
    if (seen.has(cell.address)) continue;
    seen.add(cell.address);
    const text = cellText(cell);
    if (text) out.push({ col: c, text });
  }
  return out;
}

const compact = (t) => t.replace(/\s+/g, '').toUpperCase();
const looksLikeKode = (t) => t.length <= 14 && KODE_RE.test(compact(t));

// Menentukan kode dan uraian dari sel-sel teks pada satu baris.
// Mengembalikan null jika baris bukan baris data (tidak punya kode + uraian).
function splitKodeUraian(cells) {
  if (cells.length === 0) return null;

  if (cells.some((c) => TOTAL_RE.test(c.text))) {
    return { total: true, kode: null, uraian: cells.find((c) => TOTAL_RE.test(c.text)).text };
  }

  // Kode dan uraian di sel terpisah: kode = sel paling kiri yang berbentuk kode, uraian = sel teks berikutnya
  if (cells.length >= 2) {
    const first = cells[0];
    if (looksLikeKode(first.text)) {
      const rest = cells.slice(1);
      // uraian: sel dengan huruf terbanyak (menghindari sel kode lain/nomor)
      const best = rest.reduce((a, b) => {
        const la = (a.text.match(/\p{L}/gu) || []).length;
        const lb = (b.text.match(/\p{L}/gu) || []).length;
        return lb > la ? b : a;
      });
      if (/\p{L}/u.test(best.text)) return { total: false, kode: compact(first.text), uraian: best.text };
    }
    return null;
  }

  // Satu sel berisi "KODE uraian": hanya dipecah jika kode di depan cocok dengan pola kode yang dikenal
  const m = /^(\S+)\s+(.+)$/.exec(cells[0].text);
  if (m && TIPE_RULES.some(([, re]) => re.test(compact(m[1]))) && /\p{L}/u.test(m[2])) {
    return { total: false, kode: compact(m[1]), uraian: m[2].trim() };
  }
  return null;
}

// Angka: sel pertama pada rentang header yang berisi angka
function readNumber(row, from, to, percent = false) {
  for (let c = from; c <= to; c += 1) {
    const cell = resolve(row.getCell(c));
    const n = percent ? toPercent(cell) : toNumber(cellValue(cell));
    if (n !== null) return n;
  }
  return null;
}

// Urutan kolom angka pada laporan: Pagu Revisi, Lock Pagu, Periode Lalu, Periode Ini, s.d. Periode, %, Sisa Anggaran
const ANCHOR_ORDER = ['pagu_revisi', 'lock_pagu', 'periode_lalu', 'periode_ini', 'sampai_periode', 'persentase', 'sisa_anggaran'];

// Judul kolom yang bertingkat/digabung (atau kolom tersembunyi) bisa membuat posisi judul tidak sejajar dengan posisi angka.
// Baris "JUMLAH SELURUHNYA" berisi ketujuh angka dengan urutan yang pasti, jadi dipakai sebagai patokan posisi kolom.
// Dipakai hanya jika jumlah angkanya tepat 7; selain itu pemetaan dari judul kolom tetap dipakai.
function anchorHeader(worksheet, header, limitCol) {
  for (let r = header.bottomRow + 1; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    if (!row.hasValues) continue;
    if (!readTextCells(row, limitCol).some((c) => TOTAL_RE.test(c.text))) continue;

    // Angka pada baris total, dari kiri ke kanan (sel gabungan dihitung sekali, memakai kolom sel induknya)
    const found = [];
    const seen = new Set();
    for (let c = limitCol + 1; c <= row.cellCount; c += 1) {
      const cell = resolve(row.getCell(c));
      if (seen.has(cell.address)) continue;
      seen.add(cell.address);
      const v = cellValue(cell);
      if (typeof v === 'number' || (typeof v === 'string' && toNumber(v) !== null)) {
        found.push({ col: Number(cell.col) || c, cell });
      }
    }
    if (found.length !== ANCHOR_ORDER.length) return header;

    const columns = {};
    const spans = {};
    ANCHOR_ORDER.forEach((field, i) => {
      columns[field] = found[i].col;
      spans[field] = [found[i].col, found[i].col];
    });
    // Uraian tidak berubah
    if (header.columns.uraian) {
      columns.uraian = header.columns.uraian;
      spans.uraian = header.spans.uraian;
    }

    const changed = ANCHOR_ORDER.filter((f) => header.columns[f] !== columns[f]);
    if (changed.length) console.warn(`[excel] ${worksheet.name}: posisi kolom disesuaikan dengan baris total (${changed.join(', ')})`);
    return { ...header, columns, spans };
  }
  return header;
}

// Sel berisi angka di sebelah kanan area kode + uraian, dari kiri ke kanan. Sel gabungan dihitung sekali (sel induknya).
function numbersInOrder(row, limitCol) {
  const out = [];
  const seen = new Set();
  const last = Math.max(row.cellCount, row.actualCellCount || 0);
  for (let c = limitCol + 1; c <= last; c += 1) {
    const cell = resolve(row.getCell(c));
    if (seen.has(cell.address)) continue;
    seen.add(cell.address);
    const v = cellValue(cell);
    if (typeof v === 'number' || (typeof v === 'string' && toNumber(v) !== null)) out.push(cell);
  }
  return out;
}

function mapRow(row, header, limitCol, state) {
  const split = splitKodeUraian(readTextCells(row, limitCol));
  if (!split) return null;

    const { columns, spans } = header;
  const record = {};

  // Laporan ini menggabungkan sel secara berbeda antar baris (mis. s.d. Periode di Y:AB pada baris total, tetapi Z:AB pada
  // baris lain), sehingga posisi kolom tidak sama untuk semua baris. Urutan angkanya tetap: Pagu, Lock, Periode Lalu,
  // Periode Ini, s.d. Periode, %, Sisa. Jika baris memuat tepat tujuh angka (sel gabungan dihitung sekali), urutan itu dipakai.
  const seq = numbersInOrder(row, limitCol);
  if (seq && seq.length === ANCHOR_ORDER.length) {
    ANCHOR_ORDER.forEach((field, i) => {
      const cell = seq[i];
      const n = field === 'persentase' ? toPercent(cell) : toNumber(cellValue(cell));
      const max = field === 'persentase' ? MAX_PERCENT : MAX_MONEY;
      record[field] = n !== null && Math.abs(n) <= max ? n : null;
    });
  } else {
    for (const field of MONEY_FIELDS) {
      const n = columns[field] ? readNumber(row, ...spans[field]) : null;
      record[field] = n !== null && Math.abs(n) <= MAX_MONEY ? n : null;
    }
    const pct = columns.persentase ? readNumber(row, ...spans.persentase, true) : null;
    record.persentase = pct !== null && Math.abs(pct) <= MAX_PERCENT ? pct : null;
  }

  record.uraian = split.uraian;
  if (split.total) {
    record.kode = null;
    record.tipe = 'TOTAL';
    record.program_kode = null;
  } else {
    record.kode = split.kode;
    record.tipe = tipeOf(split.kode);
    if (record.tipe === 'PROGRAM') state.program = split.kode;
    record.program_kode = record.tipe === 'PROGRAM' ? split.kode : state.program;
  }

  // Simpan nilai asli baris untuk keperluan penelusuran
  const raw = {};
  const lastCol = Math.max(limitCol, ...NUMERIC_FIELDS.filter((f) => spans[f]).map((f) => spans[f][1]));
  for (let c = 1; c <= lastCol; c += 1) {
    const value = cellValue(resolve(row.getCell(c)));
    if (isEmptyValue(value)) continue;
    let key = header.headers[c] || `Kolom ${colLetter(c)}`;
    if (key in raw) key = `${key} (${colLetter(c)})`;
    raw[key] = value instanceof Date ? value.toISOString() : value;
  }
  record.raw_data = raw;
  return record;
}

// Membaca seluruh worksheet. Baris data dikenali dari KODE + URAIAN (tidak lagi dari warna sel).
async function processExcel(buffer) {
  const workbook = await loadWorkbook(buffer);

  let totalRows = 0;
  let skipped = 0;
  const records = [];

  workbook.eachSheet((worksheet) => {
    if (worksheet.state && worksheet.state !== 'visible') return;

    let header = findHeader(worksheet);
    const numericCols = NUMERIC_FIELDS.filter((f) => header.columns[f]).map((f) => header.spans[f][0]);
    if (numericCols.length === 0) return;
    // Area kode + uraian = semua kolom di kiri kolom angka pertama
    const limitCol = Math.min(...numericCols) - 1;
    if (limitCol < 1) return;
    header = anchorHeader(worksheet, header, limitCol);

    const state = { program: null };
    for (let r = header.bottomRow + 1; r <= worksheet.rowCount; r += 1) {
      const row = worksheet.getRow(r);
      if (!row.hasValues) continue;
      totalRows += 1;
      try {
        const record = mapRow(row, header, limitCol, state);
        if (!record) continue;
        record.sheet_name = worksheet.name;
        record.row_number = r;
        records.push(record);
      } catch (err) {
        console.error(`[excel] gagal memetakan ${worksheet.name}!${r}:`, err.message);
        skipped += 1;
      }
    }
  });

  return { totalRows, skipped, records, totals: summarize(records) };
}

// Total laporan: baris "JUMLAH SELURUHNYA". Jika tidak ada, dijumlahkan dari baris Program.
function summarize(records) {
  const sum = (rows, f) => round2(rows.reduce((a, r) => a + (r[f] || 0), 0));
  let source = 'TOTAL';
  let rows = records.filter((r) => r.tipe === 'TOTAL');
  if (rows.length === 0) {
    source = 'PROGRAM';
    rows = records.filter((r) => r.tipe === 'PROGRAM');
  }
  if (rows.length === 0) return { source: null, pagu_revisi: null, sampai_periode: null, persentase: null };

  const pagu = sum(rows, 'pagu_revisi');
  const sampai = sum(rows, 'sampai_periode');
  // Satu baris total: pakai persentase dari file; selain itu hitung dari jumlahnya
  const fromFile = source === 'TOTAL' && rows.length === 1 ? rows[0].persentase : null;
  const persentase = fromFile !== null && fromFile !== undefined ? fromFile : pagu > 0 ? round2((sampai / pagu) * 100) : null;
  return { source, pagu_revisi: pagu, sampai_periode: sampai, persentase };
}

module.exports = { processExcel, tipeOf };
