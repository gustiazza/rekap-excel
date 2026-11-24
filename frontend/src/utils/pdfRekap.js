import { fmtNum, fmtPct } from './format';
import { DEFAULT_COLUMNS, lainFields, pegawaiFields } from '../components/RekapTables';

/*
 * PDF rekap Dashboard: Rekap per satker, Realisasi Akrual dan Realisasi SP2D per satker per jenis belanja.
 * A4 lanskap, tiap tabel mulai di halaman baru. Judul dan tanggal cetak tampil di setiap halaman.
 * Library PDF dimuat saat tombol ditekan supaya tidak membebani halaman lain.
 */

const TZ = 'Asia/Jakarta';
const TOTAL_LABEL = 'Lingkup BRMP Perkebunan';

// Warna disamakan dengan tabel di layar (Tailwind slate/amber)
const C = {
  text: [51, 65, 85],
  strong: [15, 23, 42],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  headBg: [248, 250, 252],
  total: [255, 251, 235],
  g0: [241, 245, 249],
  g1: [226, 232, 240],
  g2: [254, 243, 199],
  red: [220, 38, 38],
  green: [5, 150, 105],
};

const money = (v) => (v === null || v === undefined ? '-' : fmtNum(v, 2));
const pct = (v) => (v === null || v === undefined ? '-' : fmtPct(v));
const gapText = (v) => (v === null || v === undefined ? '-' : `${Number(v) > 0 ? '+' : ''}${fmtNum(v, 2)}%`);

const printedAt = () =>
  `Dicetak: ${new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })} WIB`;

const baseStyles = (size) => ({
  font: 'helvetica',
  fontSize: size,
  textColor: C.text,
  lineColor: C.line,
  lineWidth: 0.1,
  cellPadding: { top: 2.2, bottom: 2.2, left: 1.6, right: 1.6 },
  valign: 'middle',
  halign: 'center',
  overflow: 'linebreak',
});

const headStyles = (size) => ({
  fillColor: C.headBg,
  textColor: C.muted,
  fontStyle: 'bold',
  fontSize: size,
  halign: 'center',
  valign: 'middle',
});

/* ------------------------------------------------------------------ */

function satkerTable(autoTable, doc, data, drawHeader) {
  const head = [['No', 'Satker', 'Pagu Total (Rp)', 'Pagu Efektif (Rp)', 'Realisasi Akrual (Rp)', '% Akrual', 'Realisasi SP2D (Rp)', '% SP2D', '% Target SP2D', 'Gap']];
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
    head,
    body: [lingkup, ...rows],
    theme: 'grid',
    startY: 24,
    margin: { top: 24, left: 10, right: 10, bottom: 14 },
    styles: baseStyles(8),
    headStyles: headStyles(7.5),
    columnStyles: {
      0: { cellWidth: 9 },
      1: { halign: 'left', cellWidth: 54 },
      5: { cellWidth: 17 }, 7: { cellWidth: 17 }, 8: { cellWidth: 20 }, 9: { cellWidth: 20 },
    },
    didParseCell: (h) => {
      if (h.section !== 'body') return;
      if (h.row.index === 0) {
        h.cell.styles.fillColor = C.total;
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
    didDrawPage: drawHeader,
  });
}

/* ------------------------------------------------------------------ */

function matrixTable(autoTable, doc, matrix, kategori, drawHeader) {
  const real = kategori === 'SP2D' ? 'SP2D' : 'Akrual';
  const columns = matrix?.columns ?? DEFAULT_COLUMNS;
  const groups = columns.map((c) => ({ ...c, fields: c.kode === '51' ? pegawaiFields(real) : lainFields(real) }));
  const value = (f, v) => (f.type === 'pct' ? pct(v) : money(v));

  const head1 = [
    { content: 'No', rowSpan: 2 },
    { content: 'Satker', rowSpan: 2, styles: { halign: 'left' } },
    ...groups.map((g, gi) => ({
      content: g.label,
      colSpan: g.fields.length,
      styles: { fillColor: gi === 2 ? C.g2 : gi === 1 ? C.g1 : C.g0, textColor: C.strong },
    })),
  ];
  const head2 = groups.flatMap((g) => g.fields.map((f) => f.label));

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
  const avail = 297 - 20 - 8 - 38;
  const unit = avail / (nMoney + nPct * 0.65);
  const columnStyles = { 0: { cellWidth: 8 }, 1: { halign: 'left', cellWidth: 38 } };
  flat.forEach(({ f }, i) => {
    columnStyles[i + 2] = { cellWidth: f.type === 'pct' ? unit * 0.65 : unit };
  });

  autoTable(doc, {
    head: [head1, head2],
    body: [lingkup, ...rows],
    theme: 'grid',
    startY: 24,
    margin: { top: 24, left: 10, right: 10, bottom: 14 },
    styles: baseStyles(6.4),
    headStyles: headStyles(6.2),
    columnStyles,
    didParseCell: (h) => {
      if (h.section === 'head' && h.row.index === 0) h.cell.styles.fontSize = 7;
      if (h.section === 'body' && h.row.index === 0) {
        h.cell.styles.fillColor = C.total;
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.textColor = C.strong;
      }
    },
    didDrawPage: drawHeader,
  });
}

// Rekap BRMP Perkebunan: baris judul (satker) lalu Program, RO, Komponen, Sub-komponen
const LEVEL_FILL = { PROGRAM: C.g0, RO: C.headBg, KOMPONEN: null, SUBKOMPONEN: null };
const LEVEL_INDENT = { PROGRAM: 0, RO: 1, KOMPONEN: 2, SUBKOMPONEN: 3 };

function brmpTable(autoTable, doc, data, drawHeader) {
  const top = data.top || {};
  const rows = data.rows || [];
  const head = [[
    'No', 'Kode', 'Program / RO / Komponen / Sub Komponen', 'Pagu Total (Rp)', 'Pagu Efektif (Rp)', 'Realisasi Akrual (Rp)', '% Akrual',
    'Realisasi SP2D (Rp)', '% SP2D', 'Sisa Anggaran dari Realisasi Akrual (Rp)', '% Target SP2D', 'Gap',
  ]];
  const judul = [
    { content: data.satker?.name || 'BRMP Perkebunan', colSpan: 3, styles: { halign: 'left' } },
    money(top.pagu_total), money(top.pagu_efektif), money(top.realisasi_akrual), pct(top.persentase_akrual),
    money(top.realisasi_sp2d), pct(top.persentase_sp2d), money(top.sisa_anggaran), pct(top.target_sp2d), gapText(top.gap),
  ];
  const body = rows.map((r, i) => [
    String(i + 1), r.kode, r.uraian, money(r.pagu_total), money(r.pagu_efektif), money(r.realisasi_akrual), pct(r.persentase_akrual),
    money(r.realisasi_sp2d), pct(r.persentase_sp2d), money(r.sisa_anggaran), pct(r.target_sp2d), gapText(r.gap),
  ]);
  const gaps = [top.gap, ...rows.map((r) => r.gap)];
  const levels = [null, ...rows.map((r) => r.level)];

  autoTable(doc, {
    head,
    body: [judul, ...body],
    theme: 'grid',
    startY: 24,
    margin: { top: 24, left: 10, right: 10, bottom: 14 },
    styles: { ...baseStyles(6.8), cellPadding: { top: 1.7, bottom: 1.7, left: 1.6, right: 1.6 } },
    headStyles: headStyles(6.4),
    columnStyles: {
      0: { cellWidth: 8 },
      1: { halign: 'left', cellWidth: 19 },
      2: { halign: 'left', cellWidth: 70 },
      3: { cellWidth: 24 }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 }, 6: { cellWidth: 13 },
      7: { cellWidth: 24 }, 8: { cellWidth: 13 }, 9: { cellWidth: 26 }, 10: { cellWidth: 15 }, 11: { cellWidth: 13 },
    },
    didParseCell: (h) => {
      if (h.section === 'head') {
        if (h.column.index === 2) h.cell.styles.halign = 'left';
        return;
      }
      const level = levels[h.row.index];
      if (h.row.index === 0) {
        h.cell.styles.fillColor = C.total;
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.textColor = C.strong;
      } else {
        if (LEVEL_FILL[level]) h.cell.styles.fillColor = LEVEL_FILL[level];
        if (level === 'PROGRAM' || level === 'RO' || level === 'KOMPONEN') {
          h.cell.styles.fontStyle = level === 'PROGRAM' ? 'bold' : 'normal';
          if (level !== 'KOMPONEN') h.cell.styles.textColor = C.strong;
        }
        if (h.column.index === 2) {
          h.cell.styles.cellPadding = { top: 1.7, bottom: 1.7, left: 1.6 + (LEVEL_INDENT[level] || 0) * 3.2, right: 1.6 };
        }
      }
      if (h.column.index === 11) {
        const v = gaps[h.row.index];
        if (v !== null && v !== undefined) {
          h.cell.styles.textColor = Number(v) < 0 ? C.red : C.green;
          h.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: drawHeader,
  });
}

/* ------------------------------------------------------------------ */

// Grafik batang vertikal: % Realisasi Akrual, % Realisasi SP2D dan % Target SP2D per satker,
// diurutkan dari % Realisasi SP2D tertinggi. Gap = % SP2D dikurangi % Target.
const BAR = { akrual: [30, 41, 59], sp2d: [201, 162, 39], target: [203, 213, 225] };
const CHART_PER_PAGE = 8;

const hasVal = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v));

function satkerChart(doc, data, header) {
  const rows = [...(data.per_satker || [])].sort((a, b) => {
    const x = hasVal(a.persentase_sp2d) ? Number(a.persentase_sp2d) : -Infinity;
    const y = hasVal(b.persentase_sp2d) ? Number(b.persentase_sp2d) : -Infinity;
    return y - x;
  });
  if (!rows.length) return false;

  const pages = Math.ceil(rows.length / CHART_PER_PAGE);
  const peak = Math.max(100, ...rows.flatMap((r) => [r.persentase_akrual, r.persentase_sp2d, r.target_sp2d].filter(hasVal).map(Number)));
  const maxY = Math.ceil(peak / 20) * 20;

  const x0 = 24;
  const x1 = 287;
  const yTop = 40;
  const yBase = 160;
  const scale = (v) => yBase - (Number(v) / maxY) * (yBase - yTop);

  for (let p = 0; p < pages; p += 1) {
    if (p > 0) doc.addPage();
    const chunk = rows.slice(p * CHART_PER_PAGE, (p + 1) * CHART_PER_PAGE);
    header(p === 0 ? 'Grafik perbandingan realisasi per satker' : 'Grafik perbandingan realisasi per satker (lanjutan)')();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('Diurutkan dari % Realisasi SP2D tertinggi. Gap = % Realisasi SP2D - % Target SP2D.', 10, 21);

    // Garis bantu dan sumbu persen
    doc.setLineWidth(0.1);
    for (let v = 0; v <= maxY; v += 20) {
      doc.setDrawColor(...(v === 0 ? [203, 213, 225] : C.line));
      doc.line(x0, scale(v), x1, scale(v));
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(`${v}%`, x0 - 2, scale(v) + 1, { align: 'right' });
    }

    const slots = Math.max(4, chunk.length);
    const gw = (x1 - x0) / slots;
    const bw = Math.min(gw * 0.24, 11);

    chunk.forEach((r, i) => {
      const cx = x0 + gw * i + gw / 2;
      const bars = [
        [r.persentase_akrual, BAR.akrual],
        [r.persentase_sp2d, BAR.sp2d],
        [r.target_sp2d, BAR.target],
      ];
      bars.forEach(([v, color], k) => {
        if (!hasVal(v)) return;
        const bx = cx + (k - 1) * bw - bw / 2;
        const top = scale(Math.max(0, Number(v)));
        doc.setFillColor(...color);
        doc.rect(bx, top, bw, yBase - top, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...C.text);
        doc.text(fmtNum(v, 1), bx + bw / 2, top - 1.2, { align: 'center' });
      });

      // Gap di atas tiap satker
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      if (hasVal(r.gap)) doc.setTextColor(...(Number(r.gap) < 0 ? C.red : C.green));
      else doc.setTextColor(...C.muted);
      doc.text(hasVal(r.gap) ? `Gap ${gapText(r.gap)}` : 'Gap -', cx, yTop - 8, { align: 'center' });

      // Nama satker di bawah batang (maksimal 3 baris)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.strong);
      const lines = doc.splitTextToSize(r.satker.name, gw - 3).slice(0, 3);
      doc.text(lines, cx, yBase + 5, { align: 'center', lineHeightFactor: 1.25 });
    });

    // Legenda
    const legend = [['% Realisasi Akrual', BAR.akrual], ['% Realisasi SP2D', BAR.sp2d], ['% Target SP2D', BAR.target]];
    doc.setFontSize(8);
    const widths = legend.map(([t]) => doc.getTextWidth(t) + 9);
    let lx = (x0 + x1) / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    legend.forEach(([t, color], k) => {
      doc.setFillColor(...color);
      doc.rect(lx, 186, 3.5, 3.5, 'F');
      doc.setTextColor(...C.text);
      doc.text(t, lx + 5.5, 189);
      lx += widths[k] + 6;
    });
  }
  return true;
}

export async function downloadRekapPdf(data) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const stamp = printedAt();

  const header = (title) => () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.strong);
    doc.text(title, 10, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(stamp, width - 10, 14, { align: 'right' });
  };

  satkerTable(autoTable, doc, data, header('Rekap per satker'));
  doc.addPage();
  if (satkerChart(doc, data, header)) doc.addPage();
  matrixTable(autoTable, doc, data.belanja_akrual, 'AKRUAL', header('Realisasi Akrual per satker per jenis belanja'));
  doc.addPage();
  matrixTable(autoTable, doc, data.belanja_sp2d, 'SP2D', header('Realisasi SP2D per satker per jenis belanja'));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`Halaman ${i} dari ${pages}`, width / 2, 205, { align: 'center' });
  }

  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  doc.save(`rekap-satker-${today}.pdf`);
}

// PDF rekap khusus BRMP Perkebunan (A4 lanskap, mengikuti filter tanggal)
export async function downloadBrmpPdf(data) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const stamp = printedAt();

  const header = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.strong);
    doc.text('Rekap BRMP Perkebunan', 10, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(stamp, width - 10, 14, { align: 'right' });
  };

  brmpTable(autoTable, doc, data, header);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`Halaman ${i} dari ${pages}`, width / 2, 205, { align: 'center' });
  }

  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  doc.save(`rekap-brmp-perkebunan-${today}.pdf`);
}