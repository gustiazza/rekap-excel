import { SkeletonRows } from './Skeleton';
import { fmtNum, fmtPct, fmtShortDate } from '../utils/format';
import { card, td, th } from '../utils/ui';

/*
 * Tabel rekap yang dipakai bersama oleh Dashboard dan Pelaporan.
 * Aturan rata: kolom teks rata kiri; No dan kolom angka rata tengah.
 * Nilai kosong (belum ada file / belum diinput) ditampilkan "-".
 */

const num = `${td} !px-4 whitespace-nowrap text-center`;
const hc = `${th} !whitespace-normal !px-3 text-center leading-tight`;
const dash = <span className="text-slate-400">-</span>;
const money = (v) => (v === null || v === undefined ? dash : fmtNum(v, 2));

// Angka persentase dengan batang kemajuan kecil
export function PctCell({ value, width = 'w-20' }) {
  if (value === null || value === undefined) return dash;
  const pct = Number(value) || 0;
  return (
    <div className={`mx-auto ${width}`}>
      <div className="font-medium text-slate-900">{fmtPct(value)}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

// Gap = % SP2D - % target SP2D. Positif (hijau) berarti sudah melewati target, negatif (merah) masih di bawah target.
export function GapCell({ value }) {
  if (value === null || value === undefined) return dash;
  const v = Number(value);
  const cls = v < 0 ? 'text-red-600' : 'text-emerald-600';
  return (
    <span className={`font-semibold ${cls}`} title="% SP2D dikurangi % Target SP2D">
      {v > 0 ? '+' : ''}
      {fmtNum(v, 2)}%
    </span>
  );
}

export function RekapSection({ title, subtitle, actions, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

// Sel nilai input manual. Bisa diedit: klik untuk mengubah (kosong tampil "Isi"). Tidak bisa diedit: klik membuka riwayat.
export function ManualCell({ value, show, editable, onEdit, onHistory }) {
  const empty = value === null || value === undefined;
  if (!onEdit && !onHistory) return empty ? dash : show(value);
  if (empty && !editable) return dash;
  return (
    <button
      type="button"
      onClick={editable ? onEdit : onHistory}
      title={editable ? 'Klik untuk mengubah' : 'Lihat riwayat'}
      className={`rounded px-1.5 py-0.5 transition ${
        editable
          ? 'border-b border-dashed border-slate-400 hover:bg-amber-50'
          : 'hover:bg-slate-100 hover:underline'
      }`}
    >
      {empty ? <span className="font-medium text-amber-600">Isi</span> : show(value)}
    </button>
  );
}

function Shell({ minWidth, widths, children }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-slate-100" style={{ minWidth }}>
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          {children}
        </table>
      </div>
    </div>
  );
}

const EmptyRow = ({ cols, children }) => (
  <tr>
    <td colSpan={cols} className={`${td} py-8 text-center text-slate-500`}>
      {children}
    </td>
  </tr>
);

const uploadInfo = (label, u) => `${label} ${u ? fmtShortDate(u.uploaded_at) : 'belum upload'}`;

/* ------------------------------------------------------------------ */
/* REKAP PER SATKER                                                    */
/* ------------------------------------------------------------------ */

const SATKER_WIDTHS = [4, 16, 12.5, 12.5, 12.5, 8, 12.5, 8, 7, 7];

// manual (opsional): { canEdit(satkerId), edit(spec), history(spec) } membuat Pagu Total dan % Target dapat diubah langsung
// manual (opsional): { canEdit(satkerId), edit(spec), history(spec) } membuat Pagu Total dan % Target dapat diubah langsung
export function SatkerRekapTable({ rows = [], total, loading = false, skeletonRows = 5, manual, totalLabel = 'Lingkup BRMP Perkebunan' }) {
  return (
    <Shell minWidth={1320} widths={SATKER_WIDTHS}>
      <thead>
        <tr>
          <th className={hc}>No</th>
          <th className={`${th} text-left`}>Satker</th>
          <th className={hc}>Pagu Total (Rp)</th>
          <th className={hc}>Pagu Efektif (Rp)</th>
          <th className={hc}>Realisasi Akrual (Rp)</th>
          <th className={hc}>% Akrual thd Pagu Efektif</th>
          <th className={hc}>Realisasi SP2D (Rp)</th>
          <th className={hc}>% SP2D thd Pagu Efektif</th>
          <th className={hc}>% Target SP2D</th>
          <th className={hc}>Gap</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {loading && <SkeletonRows rows={skeletonRows} cols={10} />}

        {!loading && rows.length === 0 && <EmptyRow cols={10}>Belum ada satker.</EmptyRow>}

        {/* BARIS TOTAL (Lingkup) DI ATAS, SEPERTI LAPORAN EXCEL */}
        {!loading && total && rows.length > 0 && (
          <tr className="bg-amber-50 font-semibold text-slate-900">
            <td className={`${td} text-left`} colSpan={2}>
              {totalLabel}
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Akrual {total.satker_akrual}/{total.satker_total} satker · SP2D {total.satker_sp2d}/{total.satker_total} satker
              </span>
            </td>
            <td className={num}>{money(total.pagu_total)}</td>
            <td className={num}>{money(total.pagu_efektif)}</td>
            <td className={num}>{money(total.realisasi_akrual)}</td>
            <td className={`${td} text-center`}>
              <PctCell value={total.persentase_akrual} width="w-16" />
            </td>
            <td className={num}>{money(total.realisasi_sp2d)}</td>
            <td className={`${td} text-center`}>
              <PctCell value={total.persentase_sp2d} width="w-16" />
            </td>
              <td className={num}>
              <ManualCell
                value={total.target_sp2d}
                show={(v) => fmtPct(v)}
                editable={Boolean(manual?.canEditTotal)}
                onEdit={manual && (() => manual.edit({ satkerId: null, jenis: 'TARGET_LINGKUP', label: `% target SP2D ${totalLabel}`, current: total.target_sp2d }))}
                onHistory={manual && (() => manual.history({ satkerId: null, jenis: 'TARGET_LINGKUP', label: `% Target SP2D ${totalLabel}` }))}
              />
            </td>
            <td className={num}>
              <GapCell value={total.gap} />
            </td>
          </tr>
        )}

        {!loading &&
          rows.map((r, i) => (
            <tr key={r.satker.id} className="transition hover:bg-slate-50">
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={`${td} text-left`}>
                <span className="font-medium text-slate-900">{r.satker.name}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {uploadInfo('Akrual', r.upload_akrual)} · {uploadInfo('SP2D', r.upload_sp2d)}
                </span>
              </td>
              <td className={num}>
                <ManualCell
                  value={r.pagu_total}
                  show={(v) => fmtNum(v, 2)}
                  editable={Boolean(manual?.canEdit(r.satker.id))}
                  onEdit={manual && (() => manual.edit({ satkerId: r.satker.id, jenis: 'PAGU_SATKER', label: `pagu total ${r.satker.name}`, current: r.pagu_total }))}
                  onHistory={manual && (() => manual.history({ satkerId: r.satker.id, jenis: 'PAGU_SATKER', label: `Pagu total ${r.satker.name}` }))}
                />
              </td>
              <td className={num}>{money(r.pagu_efektif)}</td>
              <td className={num}>{money(r.realisasi_akrual)}</td>
              <td className={`${td} text-center`}>
                <PctCell value={r.persentase_akrual} width="w-16" />
              </td>
              <td className={num}>{money(r.realisasi_sp2d)}</td>
              <td className={`${td} text-center`}>
                <PctCell value={r.persentase_sp2d} width="w-16" />
              </td>
              <td className={num}>
                <ManualCell
                  value={r.target_sp2d}
                  show={(v) => fmtPct(v)}
                  editable={Boolean(manual?.canEdit(r.satker.id))}
                  onEdit={manual && (() => manual.edit({ satkerId: r.satker.id, jenis: 'TARGET_SP2D', label: `% target SP2D ${r.satker.name}`, current: r.target_sp2d }))}
                  onHistory={manual && (() => manual.history({ satkerId: r.satker.id, jenis: 'TARGET_SP2D', label: `% Target SP2D ${r.satker.name}` }))}
                />
              </td>
              <td className={num}>
                <GapCell value={r.gap} />
              </td>
            </tr>
          ))}
      </tbody>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* REKAP PER PROGRAM / PER BELANJA                                     */
/* ------------------------------------------------------------------ */

const GROUP_WIDTHS = [5, 25, 15, 15, 15, 12.5, 12.5];

// manual (opsional): { canEdit, edit(row), history(row) } membuat Pagu Total tiap baris dapat diubah (hanya saat satu satker dipilih)
export function GroupRekapTable({ firstLabel, rows = [], total, loading = false, skeletonRows = 3, empty, manual }) {
  return (
    <Shell minWidth={1000} widths={GROUP_WIDTHS}>
      <thead>
        <tr>
          <th className={hc}>No</th>
          <th className={`${th} text-left`}>{firstLabel}</th>
          <th className={hc}>Pagu Total (Rp)</th>
          <th className={hc}>Pagu Efektif (Rp)</th>
          <th className={hc}>Realisasi SP2D (Rp)</th>
          <th className={hc}>% thd Pagu Total</th>
          <th className={hc}>% thd Pagu Efektif</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {loading && <SkeletonRows rows={skeletonRows} cols={7} />}

        {!loading && rows.length === 0 && <EmptyRow cols={7}>{empty}</EmptyRow>}

        {!loading &&
          rows.map((r, i) => (
            <tr key={r.kode} className="transition hover:bg-slate-50">
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={`${td} text-left`}>
                <span className="font-medium text-slate-900">{r.uraian || r.kode}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{r.kode}</span>
              </td>
              <td className={num}>
                <ManualCell
                  value={r.pagu_total}
                  show={(v) => fmtNum(v, 2)}
                  editable={Boolean(manual?.canEdit)}
                  onEdit={manual && (() => manual.edit(r))}
                  onHistory={manual && (() => manual.history(r))}
                />
              </td>
              <td className={num}>{money(r.pagu_efektif)}</td>
              <td className={num}>{money(r.realisasi_sp2d)}</td>
              <td className={`${td} text-center`}>
                <PctCell value={r.persentase_pagu_total} width="w-16" />
              </td>
              <td className={`${td} text-center`}>
                <PctCell value={r.persentase_pagu_efektif} width="w-16" />
              </td>
            </tr>
          ))}
      </tbody>

      {!loading && total && rows.length > 0 && (
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className={`${td} text-left`} colSpan={2}>
              Jumlah
            </td>
            <td className={num}>{money(total.pagu_total)}</td>
            <td className={num}>{money(total.pagu_efektif)}</td>
            <td className={num}>{money(total.realisasi_sp2d)}</td>
            <td className={`${td} text-center`}>
              <PctCell value={total.persentase_pagu_total} width="w-16" />
            </td>
            <td className={`${td} text-center`}>
              <PctCell value={total.persentase_pagu_efektif} width="w-16" />
            </td>
          </tr>
        </tfoot>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* REKAP PER SATKER PER JENIS BELANJA (AKRUAL / SP2D)                  */
/* ------------------------------------------------------------------ */

// Susunan kolom tiap jenis belanja. Pegawai hanya memakai pagu efektif; Barang dan Modal memakai pagu total dan pagu efektif.
export const pegawaiFields = (real) => [
  { key: 'pagu_efektif', label: 'Pagu (Rp)', type: 'money' },
  { key: 'realisasi', label: `Realisasi ${real} (Rp)`, type: 'money' },
  { key: 'persentase_pagu_efektif', label: '%', type: 'pct' },
];
export const lainFields = (real) => [
  { key: 'pagu_total', label: 'Pagu Total (Rp)', type: 'manual' },
  { key: 'pagu_efektif', label: 'Pagu Efektif (Rp)', type: 'money' },
  { key: 'realisasi', label: `Realisasi ${real} (Rp)`, type: 'money' },
  { key: 'persentase_pagu_total', label: '% thd Pagu Total', type: 'pct' },
  { key: 'persentase_pagu_efektif', label: '% thd Pagu Efektif', type: 'pct' },
];

const MONEY_W = 148;   
const PCT_W = 92;      
const NO_W = 44;
const SATKER_W = 200; 

export const DEFAULT_COLUMNS = [
  { kode: '51', label: 'Belanja Pegawai' },
  { kode: '52', label: 'Belanja Barang' },
  { kode: '53', label: 'Belanja Modal' },
];

const cellCls = 'px-4 py-3 text-xs whitespace-nowrap text-center tabular-nums';
const subTh = 'px-3 py-2.5 text-[11px] font-semibold leading-tight text-slate-500 text-center !whitespace-normal bg-slate-50';

// kategori: 'AKRUAL' | 'SP2D'. manual (opsional): { canEdit(satkerId), edit(spec), history(spec) } untuk Pagu Total.
export function BelanjaMatrixTable({ data, kategori = 'AKRUAL', loading = false, skeletonRows = 5, manual, totalLabel = 'Lingkup BRMP Perkebunan' }) {
  const real = kategori === 'SP2D' ? 'SP2D' : 'Akrual';
  const columns = data?.columns ?? DEFAULT_COLUMNS;
  const rows = data?.rows ?? [];
  const groups = columns.map((c) => ({ ...c, fields: c.kode === '51' ? pegawaiFields(real) : lainFields(real) }));
  const colCount = 2 + groups.reduce((n, g) => n + g.fields.length, 0);
  const minWidth =
    NO_W + SATKER_W + groups.reduce((n, g) => n + g.fields.reduce((m, f) => m + (f.type === 'pct' ? PCT_W : MONEY_W), 0), 0);

  const show = (f, v) => (v === null || v === undefined ? dash : f.type === 'pct' ? fmtPct(v) : fmtNum(v, 2));

  // kolom pertama tiap kelompok diberi garis pemisah
  const sep = (idx) => (idx === 0 ? 'border-l border-slate-200' : '');

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-slate-100" style={{ minWidth }}>
          <colgroup>
            <col style={{ width: NO_W }} />
            <col style={{ width: SATKER_W }} />
            {groups.map((g) =>
              g.fields.map((f) => <col key={`${g.kode}-${f.key}`} style={{ width: f.type === 'pct' ? PCT_W : MONEY_W }} />)
            )}
          </colgroup>

          <thead>
            <tr>
              <th rowSpan={2} className={`${th} sticky left-0 z-20 bg-slate-50 text-center`}>
                No
              </th>
              <th rowSpan={2} className={`${th} sticky left-[44px] z-20 bg-slate-50 text-left`}>
                Satker
              </th>
              {groups.map((g, gi) => (
                <th
                  key={g.kode}
                  colSpan={g.fields.length}
                  className={`border-b border-l border-slate-200 px-2 py-2.5 text-center text-xs font-bold ${
                    gi === 2 ? 'bg-amber-100 text-amber-900' : gi === 1 ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {groups.map((g) =>
                g.fields.map((f, idx) => (
                  <th key={`${g.kode}-${f.key}`} className={`${subTh} ${sep(idx)}`}>
                    {f.label}
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && <SkeletonRows rows={skeletonRows} cols={colCount} />}

            {!loading && rows.length === 0 && <EmptyRow cols={colCount}>Belum ada satker.</EmptyRow>}

            {/* BARIS TOTAL (Lingkup) DI ATAS, SEPERTI LAPORAN EXCEL */}
            {!loading && data && rows.length > 0 && (
              <tr className="bg-amber-50 font-semibold text-slate-900">
                <td colSpan={2} className={`${td} sticky left-0 z-10 bg-amber-50 text-left`}>
                  {totalLabel}
                </td>
                {groups.map((g) =>
                  g.fields.map((f, idx) => (
                    <td key={`${g.kode}-${f.key}`} className={`${cellCls} ${sep(idx)}`}>
                      {show(f, data.total.belanja[g.kode]?.[f.key])}
                    </td>
                  ))
                )}
              </tr>
            )}

            {!loading &&
              rows.map((r, i) => (
                <tr key={r.satker.id} className="group">
                  <td className={`${td} sticky left-0 z-10 bg-white text-center group-hover:bg-slate-50`}>{i + 1}</td>
                  <td className={`${td} sticky left-[44px] z-10 bg-white text-left font-medium text-slate-900 group-hover:bg-slate-50`}>
                    {r.satker.name}
                  </td>
                  {groups.map((g) =>
                    g.fields.map((f, idx) => {
                      const v = r.belanja[g.kode]?.[f.key];
                      return (
                        <td key={`${g.kode}-${f.key}`} className={`${cellCls} ${sep(idx)} group-hover:bg-slate-50`}>
                          {f.type === 'manual' ? (
                            <ManualCell
                              value={v}
                              show={(x) => fmtNum(x, 2)}
                              editable={Boolean(manual?.canEdit(r.satker.id))}
                              onEdit={
                                manual &&
                                (() =>
                                  manual.edit({
                                    satkerId: r.satker.id,
                                    jenis: 'PAGU_BELANJA',
                                    kode: g.kode,
                                    label: `pagu total ${g.label} ${r.satker.name}`,
                                    current: v,
                                  }))
                              }
                              onHistory={
                                manual &&
                                (() =>
                                  manual.history({
                                    satkerId: r.satker.id,
                                    jenis: 'PAGU_BELANJA',
                                    kode: g.kode,
                                    label: `Pagu total ${g.label} ${r.satker.name}`,
                                  }))
                              }
                            />
                          ) : (
                            show(f, v)
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}