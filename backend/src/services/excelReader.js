const ExcelJS = require('exceljs');

// Kolom hasil rekap beserta kemungkinan nama header di file Excel
const FIELD_ORDER = [
  'uraian',
  'pagu_revisi',
  'lock_pagu',
  'periode_lalu',
  'periode_ini',
  'sampai_periode',
  'persentase',
  'sisa_anggaran',
];

const FIELD_ALIASES = {
  uraian: ['uraian', 'uraian kegiatan', 'nama program', 'keterangan'],
  pagu_revisi: ['pagu revisi', 'pagu dipa revisi', 'pagu'],
  lock_pagu: ['lock pagu', 'lock', 'blokir'],
  periode_lalu: ['periode lalu', 's d periode lalu', 'sd periode lalu', 'realisasi periode lalu'],
  periode_ini: ['periode ini', 'realisasi periode ini'],
  sampai_periode: ['sampai periode', 'sampai dengan periode', 's d periode ini', 'sd periode ini', 's d periode', 'sd periode'],
  persentase: ['persentase', 'prosentase', 'persen', '%'],
  sisa_anggaran: ['sisa anggaran', 'sisa'],
};

async function loadWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

// Mengambil nilai primitif dari sel (formula, rich text, hyperlink, error)
function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) {
      const r = v.result;
      if (r && typeof r === 'object' && !(r instanceof Date)) return null; // error formula
      return r === undefined ? null : r;
    }
    if ('text' in v) return v.text;
    if ('error' in v) return null;
    return null;
  }
  return v;
}

function isEmptyValue(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function toText(v) {
  if (isEmptyValue(v)) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

const round2 = (n) => Math.round(n * 100) / 100;

// Mendukung angka biasa dan teks berformat Indonesia ("Rp 1.234.567,89", "(100)", "12,5%")
function toNumber(v) {
  if (isEmptyValue(v) || v instanceof Date) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null;
  let s = String(v).trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/rp/gi, '').replace(/%/g, '').replace(/\s+/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (s === '' || !/^[\d.,]+$/.test(s)) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return round2(negative ? -n : n);
}

// Persentase: jika sel diformat "%" (nilai 0.25 tampil 25%), kalikan 100
function toPercent(cell) {
  const v = cellValue(cell);
  let n = toNumber(v);
  if (n !== null && typeof v === 'number' && /%/.test(cell.numFmt || '')) n = round2(v * 100);
  return n;
}

function normalizeHeader(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9% ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mencocokkan teks header ke nama kolom; alias terpanjang yang cocok menang
function matchField(norm) {
  let best = null;
  let bestLen = 0;
  for (const field of FIELD_ORDER) {
    for (const alias of FIELD_ALIASES[field]) {
      const hit = norm === alias || (alias.length > 3 && norm.includes(alias));
      if (hit && alias.length > bestLen) {
        best = field;
        bestLen = alias.length;
      }
    }
  }
  return best;
}

function colToNum(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

// Daftar merged cells worksheet: [{top,left,bottom,right}]
function getMerges(worksheet) {
  if (worksheet.__merges) return worksheet.__merges;
  let list = [];
  try {
    if (worksheet._merges) {
      list = Object.values(worksheet._merges).map((m) => m.model).filter(Boolean);
    } else {
      for (const ref of worksheet.model.merges || []) {
        const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref);
        if (m) list.push({ left: colToNum(m[1]), top: Number(m[2]), right: colToNum(m[3]), bottom: Number(m[4]) });
      }
    }
  } catch (e) {
    list = [];
  }
  worksheet.__merges = list;
  return list;
}

function mergeRangeAt(worksheet, row, col) {
  return getMerges(worksheet).find((m) => row >= m.top && row <= m.bottom && col >= m.left && col <= m.right) || null;
}

// Membaca struktur header: mendukung header bertingkat (nama kolom tersebar di beberapa baris)
// dan merged cells. Hasil:
//  columns    : kolom utama tiap field (kolom paling kiri dari header)
//  detectCols : kolom utama dari baris header terbaik saja (dipakai deteksi warna, tidak berubah)
//  spans      : rentang kolom sebenarnya [kiri, kanan] tiap field, mengikuti merged cell header
//  headerRow  : baris header terbaik; bottomRow : baris terbawah area header
function findHeader(worksheet) {
  const limit = Math.min(worksheet.rowCount, 30);

  const scan = (r) => {
    const columns = {};
    const headers = {};
    worksheet.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      const text = toText(cellValue(cell));
      if (!text) return;
      headers[c] = text;
      const field = matchField(normalizeHeader(text));
      if (field && !columns[field]) columns[field] = c;
    });
    return { columns, headers };
  };

  let best = null;
  for (let r = 1; r <= limit; r += 1) {
    const s = scan(r);
    const score = Object.keys(s.columns).length;
    if (score >= 2 && (!best || score > best.score)) best = { ...s, score, headerRow: r };
  }

  if (!best) {
    const columns = {};
    const spans = {};
    FIELD_ORDER.forEach((field, i) => {
      columns[field] = i + 1;
      spans[field] = [i + 1, i + 1];
    });
    return { headerRow: 0, bottomRow: 0, columns, detectCols: { ...columns }, spans, headers: {} };
  }

  const detectCols = { ...best.columns };
  const columns = { ...best.columns };
  const rowOf = {};
  Object.keys(columns).forEach((f) => { rowOf[f] = best.headerRow; });

  // Header bertingkat: cari field yang belum ketemu pada baris di sekitar header
  for (let r = Math.max(1, best.headerRow - 3); r <= Math.min(limit, best.headerRow + 3); r += 1) {
    if (r === best.headerRow) continue;
    const s = scan(r);
    for (const field of FIELD_ORDER) {
      if (!columns[field] && s.columns[field]) {
        columns[field] = s.columns[field];
        rowOf[field] = r;
      }
    }
    for (const [c, text] of Object.entries(s.headers)) {
      if (!best.headers[c]) best.headers[c] = text;
    }
  }

  const spans = {};
  let bottomRow = best.headerRow;
  for (const field of Object.keys(columns)) {
    const c = columns[field];
    const r = rowOf[field];
    const m = mergeRangeAt(worksheet, r, c);
    spans[field] = m ? [m.left, m.right] : [c, c];
    bottomRow = Math.max(bottomRow, m ? m.bottom : r);
  }

  return { headerRow: best.headerRow, bottomRow, columns, detectCols, spans, headers: best.headers };
}

module.exports = {
  FIELD_ORDER,
  loadWorkbook,
  cellValue,
  isEmptyValue,
  toText,
  toNumber,
  toPercent,
  findHeader,
  mergeRangeAt,
};
