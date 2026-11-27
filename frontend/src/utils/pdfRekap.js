import { fmtNum, fmtPct } from './format';
import { DEFAULT_COLUMNS, lainFields, pegawaiFields } from '../components/RekapTables';
import { LEVEL_COLORS, THEME, groupColor, rgb } from './tableTheme';
import { longDate, refDateOf, targetLabel } from './refDate';

/*
 * PDF rekap Dashboard (satker, Realisasi Akrual dan Realisasi SP2D per jenis belanja) dan PDF Rekap BRMP Perkebunan.
 * Lebar halaman A4 lanskap (297 mm). Pada PDF rekap Dashboard, tinggi halaman disesuaikan dengan isi tabel supaya
 * tidak ada ruang kosong di bawahnya; bila tabel lebih tinggi dari A4, dipakai halaman A4 biasa.
 * Judul memuat tanggal acuan (filter "Sampai tanggal", atau hari ini). Sumber data tepat di bawah tabel (jam tetap 15.30 WIB).
 * Library PDF dimuat saat tombol ditekan supaya tidak membebani halaman lain.
 */

const TOTAL_LABEL = 'Lingkup BRMP Perkebunan';
const BRMP_NAME = 'Pusat Perakitan dan Modernisasi Pertanian Perkebunan';
const SOURCE_TIME = '15.30 WIB';

const PAGE_W = 297;
const A4_H = 210;
const MIN_H = 70;
const BOTTOM_MARGIN = 14;
const SIDE = 10;

const C = {
  text: [51, 65, 85],
  strong: [15, 23, 42],
  muted: [100, 116, 139],
  line: [148, 163, 184],
  white: [255, 255, 255],
  title: [6, 95, 50],
  red: [220, 38, 38],
  green: [5, 150, 105],
};

const GREEN_HEAD = rgb(THEME.green.head);
const GREEN_TOTAL = rgb(THEME.green.total);
const MATRIX_TOTAL = rgb(THEME.matrix.total);
const MATRIX_SATKER = rgb(THEME.matrix.satker);

const money = (v) => (v === null || v === undefined ? '-' : fmtNum(v, 2));
const pct = (v) => (v === null || v === undefined ? '-' : fmtPct(v));
const gapText = (v) => (v === null || v === undefined ? '-' : `${Number(v) > 0 ? '+' : ''}${fmtNum(v, 2)}%`);

const sourceText = (basis, ref) => `Sumber Data: SAKTI basis ${basis} per ${longDate(ref)} pukul ${SOURCE_TIME}`;

const baseStyles = (size) => ({
  font: 'helvetica',
  fontSize: size,
  textColor: C.text,
  lineColor: C.line,
  lineWidth: 0.3,
  cellPadding: { top: 2.2, bottom: 2.2, left: 1.6, right: 1.6 },
  valign: 'middle',
  halign: 'center',
  overflow: 'linebreak',
});

// Judul kolom: latar berwarna, huruf putih tebal
const headStyles = (size, fill = GREEN_HEAD) => ({
  fillColor: fill,
  textColor: C.white,
  fontStyle: 'bold',
  fontSize: size,
  halign: 'center',
  valign: 'middle',
});

/* ------------------------------------------------------------------ */
/* JUDUL HALAMAN                                                       */
/* ------------------------------------------------------------------ */

// Judul (hijau tebal, rata tengah, boleh beberapa baris) dan subjudul hitam tebal bila ada.
// startY = posisi awal tabel, dekat di bawah judul.
const TOP = 11;
const LINE = 6.2;
const SUB_LINE = 6.2;
const GAP = 4.5;

function headerSpec(titleLines, subtitle) {
  const lastTitle = TOP + (titleLines.length - 1) * LINE;
  const subY = subtitle ? lastTitle + SUB_LINE : null;
  return { titleLines, subtitle, subY, startY: (subtitle ? subY : lastTitle) + GAP };
}

const drawHeader = (doc, spec) => () => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.title);
  spec.titleLines.forEach((t, i) => doc.text(t, PAGE_W / 2, TOP + i * LINE, { align: 'center' }));
  if (spec.subtitle) {
    doc.setFontSize(10.5);
    doc.setTextColor(...C.strong);
    doc.text(spec.subtitle, PAGE_W / 2, spec.subY, { align: 'center' });
  }
};

const drawSource = (doc, text, y) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.strong);
  doc.text(text, PAGE_W - SIDE, y, { align: 'right' });
};

// perPageSource: teks sumber data diulang tepat di bawah tabel pada setiap halaman
const tableBase = (doc, spec, perPageSource) => ({
  theme: 'grid',
  startY: spec.startY,
  margin: { top: spec.startY, left: SIDE, right: SIDE, bottom: BOTTOM_MARGIN + (perPageSource ? 6 : 0) },
  didDrawPage: (data) => {
    drawHeader(doc, spec)();
    if (perPageSource) drawSource(doc, perPageSource, data.cursor.y + 5);
  },
});

/* ------------------------------------------------------------------ */
/* TABEL                                                               */
/* ------------------------------------------------------------------ */

function satkerTable(autoTable, doc, data, ref, spec) {
  const head = [['No', 'Satker', 'Pagu Total (Rp)', 'Pagu Efektif (Rp)', 'Realisasi Akrual (Rp)', '% Akrual', 'Realisasi SP2D (Rp)', '% SP2D', targetLabel(ref), 'Gap']];
  const t = data.totals || {};
  const lingkup = [
    { content: TOTAL_LABEL, colSpan: 2, styles: { halign: 'left' } },
    money(t.pagu_total), money(t.pagu_efektif), money(t.realisasi_akrual), pct(t.persentase_akrual),
    money(t.realisasi_sp2d), pct(t.persentase_sp2d), pct(t.target_sp2d), gapText(t.gap),
  ];
  const rows = (data.per_satker || []).map((r, i) => [
    String(i + 1), r.satker.name, money(r.pagu_total), money(r.pagu_efektif), money(r.realisasi_akrual), pct(r.persentase_akrual),
    money(r.realisasi_sp2d), pct(r.persentase_sp2d), pct(r.target_sp2d), gapText(r.gap),
  ]);
  const gaps = [t.gap, ...(data.per_satker || []).map((r) => r.gap)];

  autoTable(doc, {
    ...tableBase(doc, spec),
    head,
    body: [lingkup, ...rows],
    styles: baseStyles(8),
    headStyles: headStyles(7.5),
    columnStyles: {
      0: { cellWidth: 9 },
      1: { halign: 'left', cellWidth: 52 },
      5: { cellWidth: 17 }, 7: { cellWidth: 17 }, 8: { cellWidth: 30 }, 9: { cellWidth: 18 },
    },
    didParseCell: (h) => {
      if (h.section !== 'body') return;
      if (h.row.index === 0) {
        h.cell.styles.fillColor = GREEN_TOTAL;
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.textColor = C.strong;
      }
      if (h.column.index === 9) {
        const v = gaps[h.row.index];
        if (v !== null && v !== undefined) {
          h.cell.styles.textColor = Number(v) < 0 ? C.red : C.green;
          h.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
}

function matrixTable(autoTable, doc, matrix, kategori, spec) {
  const real = kategori === 'SP2D' ? 'SP2D' : 'Akrual';
  const columns = matrix?.columns ?? DEFAULT_COLUMNS;
  const groups = columns.map((c, gi) => ({
    ...c,
    fill: rgb(groupColor(c.kode, gi)),
    fields: c.kode === '51' ? pegawaiFields(real) : lainFields(real),
  }));
  const value = (f, v) => (f.type === 'pct' ? pct(v) : money(v));

  const head1 = [
    { content: 'No', rowSpan: 2, styles: { fillColor: MATRIX_SATKER } },
    { content: 'Satker', rowSpan: 2, styles: { fillColor: MATRIX_SATKER, halign: 'left' } },
    ...groups.map((g) => ({ content: g.label, colSpan: g.fields.length, styles: { fillColor: g.fill, fontSize: 7.5 } })),
  ];
  const head2 = groups.flatMap((g) => g.fields.map((f) => ({ content: f.label, styles: { fillColor: g.fill } })));

  const flat = groups.flatMap((g) => g.fields.map((f) => ({ g, f })));
  const total = matrix?.total?.belanja || {};
  const lingkup = [
    { content: TOTAL_LABEL, colSpan: 2, styles: { halign: 'left' } },
    ...flat.map(({ g, f }) => value(f, total[g.kode]?.[f.key])),
  ];
  const rows = (matrix?.rows || []).map((r, i) => [
    String(i + 1), r.satker.name, ...flat.map(({ g, f }) => value(f, r.belanja[g.kode]?.[f.key])),
  ]);

  // Lebar kolom: angka uang dan persen dibagi menurut perbandingan, sisanya untuk No dan Satker
  const nMoney = flat.filter(({ f }) => f.type !== 'pct').length;
  const nPct = flat.length - nMoney;
  const avail = 297 - 20 - 8 - 36;
  const unit = avail / (nMoney + nPct * 0.65);
  const columnStyles = { 0: { cellWidth: 8 }, 1: { halign: 'left', cellWidth: 36 } };
  flat.forEach(({ f }, i) => {
    columnStyles[i + 2] = { cellWidth: f.type === 'pct' ? unit * 0.65 : unit };
  });

  autoTable(doc, {
    ...tableBase(doc, spec),
    head: [head1, head2],
    body: [lingkup, ...rows],
    styles: { ...baseStyles(6), cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 } },
    headStyles: headStyles(6),
    columnStyles,
    didParseCell: (h) => {
      if (h.section === 'body' && h.row.index === 0) {
        h.cell.styles.fillColor = MATRIX_TOTAL;
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.textColor = C.strong;
      }
    },
  });
}

// Rekap BRMP Perkebunan (tanpa kolom No): baris judul lalu Program, RO, Komponen, Sub-komponen dengan warna berbeda tiap tingkat
const LEVEL_FILL = Object.fromEntries(Object.entries(LEVEL_COLORS).map(([k, hex]) => [k, rgb(hex)]));
const LEVEL_INDENT = { PROGRAM: 0, RO: 1, KOMPONEN: 2, SUBKOMPONEN: 3 };

function brmpTable(autoTable, doc, data, ref, spec, source) {
  const top = data.top || {};
  const rows = data.rows || [];
  const head = [[
    'Kode', 'Program / RO / Komponen / Sub Komponen', 'Pagu Total (Rp)', 'Pagu Efektif (Rp)', 'Realisasi Akrual (Rp)', '% Akrual',
    'Realisasi SP2D (Rp)', '% SP2D', 'Sisa Anggaran dari Realisasi Akrual (Rp)', targetLabel(ref), 'Gap',
  ]];
  const judul = [
    { content: BRMP_NAME, colSpan: 2, styles: { halign: 'left' } },
    money(top.pagu_total), money(top.pagu_efektif), money(top.realisasi_akrual), pct(top.persentase_akrual),
    money(top.realisasi_sp2d), pct(top.persentase_sp2d), money(top.sisa_anggaran), pct(top.target_sp2d), gapText(top.gap),
  ];
  const body = rows.map((r) => [
    r.kode, r.uraian, money(r.pagu_total), money(r.pagu_efektif), money(r.realisasi_akrual), pct(r.persentase_akrual),
    money(r.realisasi_sp2d), pct(r.persentase_sp2d), money(r.sisa_anggaran), pct(r.target_sp2d), gapText(r.gap),
  ]);
  const gaps = [top.gap, ...rows.map((r) => r.gap)];
  const levels = [null, ...rows.map((r) => r.level)];

  autoTable(doc, {
    ...tableBase(doc, spec, source),
    head,
    body: [judul, ...body],
    styles: { ...baseStyles(6.8), cellPadding: { top: 1.7, bottom: 1.7, left: 1.6, right: 1.6 } },
    headStyles: headStyles(6.4),
    columnStyles: {
      0: { halign: 'left', cellWidth: 19 },
      1: { halign: 'left', cellWidth: 70 },
      2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 24 }, 5: { cellWidth: 13 },
      6: { cellWidth: 24 }, 7: { cellWidth: 13 }, 8: { cellWidth: 26 }, 9: { cellWidth: 26 }, 10: { cellWidth: 13 },
    },
    didParseCell: (h) => {
      if (h.section === 'head') {
        if (h.column.index === 1) h.cell.styles.halign = 'left';
        return;
      }
      const level = levels[h.row.index];
      if (h.row.index === 0) {
        h.cell.styles.fillColor = GREEN_TOTAL;
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.textColor = C.strong;
      } else {
        h.cell.styles.fillColor = LEVEL_FILL[level] || LEVEL_FILL.SUBKOMPONEN;
        h.cell.styles.textColor = level === 'SUBKOMPONEN' || level === 'KOMPONEN' ? C.text : C.strong;
        h.cell.styles.fontStyle = level === 'PROGRAM' || level === 'RO' ? 'bold' : 'normal';
        if (h.column.index === 1) {
          h.cell.styles.cellPadding = { top: 1.7, bottom: 1.7, left: 1.6 + (LEVEL_INDENT[level] || 0) * 3.2, right: 1.6 };
        }
      }
      if (h.column.index === 10) {
        const v = gaps[h.row.index];
        if (v !== null && v !== undefined) {
          h.cell.styles.textColor = Number(v) < 0 ? C.red : C.green;
          h.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
}

/* ------------------------------------------------------------------ */
/* PEMBUATAN DOKUMEN                                                   */
/* ------------------------------------------------------------------ */

async function loadLibs() {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const make = (height) => new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W, height] });
  return { make, autoTable: autoTableModule.default };
}

// Tinggi halaman yang pas dengan satu tabel: tabel diukur dulu di halaman A4. Bila muat satu halaman, tinggi
// disesuaikan (ruang untuk teks sumber data dan nomor halaman di bawahnya); bila lebih, dipakai A4 biasa.
function fitHeight(lib, section) {
  const probe = lib.make(A4_H);
  section.draw(probe, lib.autoTable);
  if (probe.getNumberOfPages() > 1) return A4_H;
  return Math.max(MIN_H, Math.ceil(probe.lastAutoTable.finalY + 18));
}

// sections: [{ source, draw(doc, autoTable) }]; fit: sesuaikan tinggi halaman dengan isi tabel
function buildPdf(lib, sections, { fit, filename }) {
  const heights = sections.map((s) => (fit ? fitHeight(lib, s) : A4_H));
  const pageHeight = [];
  let doc;

  sections.forEach((s, i) => {
    if (i === 0) doc = lib.make(heights[0]);
    else doc.addPage([PAGE_W, heights[i]], 'landscape');

    const from = doc.getNumberOfPages();
    s.draw(doc, lib.autoTable);
    const to = doc.getNumberOfPages();
    for (let p = from; p <= to; p += 1) pageHeight[p] = heights[i];

    // Sumber data tepat di bawah tabel (bila belum digambar per halaman oleh tabelnya)
    if (!s.perPage) drawSource(doc, s.source, doc.lastAutoTable.finalY + 5);
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`Halaman ${i} dari ${total}`, PAGE_W / 2, pageHeight[i] - 5, { align: 'center' });
  }
  doc.save(filename);
}

export async function downloadRekapPdf(data) {
  const lib = await loadLibs();
  const ref = data.ref || refDateOf();
  const when = longDate(ref);
  const name = 'Realisasi Anggaran lingkup BRMP Perkebunan';
  const subtitle = 'Berdasarkan Satker Per Jenis Belanja';

  const specSatker = headerSpec([name, `per ${when}`]);
  const specAkrual = headerSpec([name, `Basis Akrual per ${when}`], subtitle);
  const specSp2d = headerSpec([name, `Basis SP2D per ${when}`], subtitle);

  buildPdf(
    lib,
    [
      { source: sourceText('Akrual dan SP2D', ref), draw: (doc, at) => satkerTable(at, doc, data, ref, specSatker) },
      { source: sourceText('Akrual', ref), draw: (doc, at) => matrixTable(at, doc, data.belanja_akrual, 'AKRUAL', specAkrual) },
      { source: sourceText('SP2D', ref), draw: (doc, at) => matrixTable(at, doc, data.belanja_sp2d, 'SP2D', specSp2d) },
    ],
    { fit: true, filename: `rekap-satker-${ref}.pdf` }
  );
}

// PDF rekap khusus BRMP Perkebunan (lebar A4 lanskap, mengikuti filter tanggal)
export async function downloadBrmpPdf(data) {
  const lib = await loadLibs();
  const ref = data.ref || refDateOf();
  const src = sourceText('Akrual dan SP2D', ref);
  const spec = headerSpec(['Realisasi Anggaran BRMP Perkebunan', `per ${longDate(ref)}`]);

  buildPdf(
    lib,
    [{ source: src, perPage: true, draw: (doc, at) => brmpTable(at, doc, data, ref, spec, src) }],
    { fit: false, filename: `rekap-brmp-perkebunan-${ref}.pdf` }
  );
}