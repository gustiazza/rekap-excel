import { SkeletonRows } from './Skeleton';
import { GapCell, ManualCell } from './RekapTables';
import { fmtNum, fmtPct } from '../utils/format';
import { card, td, th } from '../utils/ui';

/*
 * Rekap khusus BRMP Perkebunan: baris Program, RO, Komponen dan Sub-komponen.
 * Pagu Total dan % Target SP2D diinput manual per baris (klik angkanya); kolom lain dari file Akrual / SP2D.
 * manual (opsional): { canEdit(satkerId), edit(spec), history(spec) }
 */

const dash = <span className="text-slate-400">-</span>;
const money = (v) => (v === null || v === undefined ? dash : fmtNum(v, 2));
const pct = (v) => (v === null || v === undefined ? dash : fmtPct(v));

const hc = `${th} !whitespace-normal !px-3 text-center leading-tight`;
const num = `${td} !px-3 whitespace-nowrap text-center tabular-nums`;

// No, Kode, Uraian, Pagu Total, Pagu Efektif, Realisasi Akrual, % Akrual, Realisasi SP2D, % SP2D, Sisa Anggaran, % Target, Gap
const WIDTHS = [44, 100, 320, 148, 148, 148, 88, 148, 88, 164, 104, 92];
const MIN_WIDTH = WIDTHS.reduce((a, b) => a + b, 0);

// Tampilan tiap tingkat: warna latar, ketebalan huruf, dan menjorok uraian
const LEVEL = {
  PROGRAM: { row: 'bg-slate-100 font-semibold text-slate-900', indent: 0 },
  RO: { row: 'bg-slate-50 font-medium text-slate-900', indent: 1 },
  KOMPONEN: { row: 'bg-white font-medium text-slate-800', indent: 2 },
  SUBKOMPONEN: { row: 'bg-white text-slate-700', indent: 3 },
};

function Message({ children }) {
  return (
    <tr>
      <td colSpan={WIDTHS.length} className={`${td} py-8 text-center text-slate-500`}>
        {children}
      </td>
    </tr>
  );
}

export default function BrmpRekapTable({ data, loading = false, manual, search = '' }) {
  const satker = data?.satker;
  const top = data?.top;
  const rows = data?.rows ?? [];
  const editable = Boolean(satker && manual?.canEdit(satker.id));
  
  const q = search.trim().toLowerCase();
  const keep = new Set();
  if (q) {
    rows.forEach((r) => {
      if (!`${r.kode} ${r.uraian || ''}`.toLowerCase().includes(q)) return;
      const parts = r.key.split('|');
      for (let n = 1; n <= parts.length; n += 1) keep.add(parts.slice(0, n).join('|'));
    });
  }
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => !q || keep.has(r.key));

  const cell = (row, jenis, kode, value, show, label, current) => (
    <ManualCell
      value={value}
      show={show}
      editable={editable}
      onEdit={manual && (() => manual.edit({ satkerId: satker.id, jenis, kode, label: `${label} ${row}`, current }))}
      onHistory={manual && (() => manual.history({ satkerId: satker.id, jenis, kode, label: `${label[0].toUpperCase()}${label.slice(1)} ${row}` }))}
    />
  );

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-slate-100" style={{ minWidth: MIN_WIDTH }}>
          <colgroup>
            {WIDTHS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <th className={hc}>No</th>
              <th className={`${th} text-left`}>Kode</th>
              <th className={`${th} text-left`}>Program / RO / Komponen / Sub Komponen</th>
              <th className={hc}>Pagu Total (Rp)</th>
              <th className={hc}>Pagu Efektif (Rp)</th>
              <th className={hc}>Realisasi Akrual (Rp)</th>
              <th className={hc}>% Akrual</th>
              <th className={hc}>Realisasi SP2D (Rp)</th>
              <th className={hc}>% SP2D</th>
              <th className={hc}>Sisa Anggaran dari Realisasi Akrual (Rp)</th>
              <th className={hc}>% Target SP2D</th>
              <th className={hc}>Gap</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && <SkeletonRows rows={6} cols={WIDTHS.length} />}

            {!loading && !satker && <Message>Satker "BRMP Perkebunan" belum ada di daftar satker.</Message>}

            {!loading && satker && rows.length === 0 && (
              <Message>Belum ada file Akrual atau SP2D BRMP Perkebunan pada rentang tanggal ini.</Message>
            )}

            {!loading && satker && rows.length > 0 && visible.length === 0 && (
              <Message>Tidak ada baris yang cocok dengan "{search.trim()}".</Message>
            )}

            {/* BARIS JUDUL: TOTAL SATKER (angka sama dengan tabel Rekap per satker) */}
            {!loading && satker && top && rows.length > 0 && (
              <tr className="bg-amber-50 font-semibold text-slate-900">
                <td className={`${td} text-left`} colSpan={3}>
                  {satker.name}
                </td>
                <td className={num}>
                  {cell(satker.name, 'PAGU_SATKER', '', top.pagu_total, (v) => fmtNum(v, 2), 'pagu total', top.pagu_total)}
                </td>
                <td className={num}>{money(top.pagu_efektif)}</td>
                <td className={num}>{money(top.realisasi_akrual)}</td>
                <td className={num}>{pct(top.persentase_akrual)}</td>
                <td className={num}>{money(top.realisasi_sp2d)}</td>
                <td className={num}>{pct(top.persentase_sp2d)}</td>
                <td className={num}>{money(top.sisa_anggaran)}</td>
                <td className={num}>
                  {cell(satker.name, 'TARGET_SP2D', '', top.target_sp2d, (v) => fmtPct(v), '% target SP2D', top.target_sp2d)}
                </td>
                <td className={num}>
                  <GapCell value={top.gap} />
                </td>
              </tr>
            )}

            {!loading &&
              satker &&
              visible.map(({ r, i }) => {
                const lv = LEVEL[r.level] || LEVEL.SUBKOMPONEN;
                return (
                  <tr key={`${r.key}-${i}`} className={lv.row}>
                    <td className={`${td} text-center font-normal text-slate-500`}>{i + 1}</td>
                    <td className={`${td} text-left whitespace-nowrap`}>{r.kode}</td>
                    <td className={`${td} text-left`} style={{ paddingLeft: 16 + lv.indent * 16 }}>
                      {r.uraian}
                    </td>
                    <td className={num}>
                      {cell(r.uraian, 'PAGU_REKAP', r.key, r.pagu_total, (v) => fmtNum(v, 2), 'pagu total', r.pagu_total)}
                    </td>
                    <td className={num}>{money(r.pagu_efektif)}</td>
                    <td className={num}>{money(r.realisasi_akrual)}</td>
                    <td className={num}>{pct(r.persentase_akrual)}</td>
                    <td className={num}>{money(r.realisasi_sp2d)}</td>
                    <td className={num}>{pct(r.persentase_sp2d)}</td>
                    <td className={num}>{money(r.sisa_anggaran)}</td>
                    <td className={num}>
                      {cell(r.uraian, 'TARGET_REKAP', r.key, r.target_sp2d, (v) => fmtPct(v), '% target SP2D', r.target_sp2d)}
                    </td>
                    <td className={num}>
                      <GapCell value={r.gap} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}