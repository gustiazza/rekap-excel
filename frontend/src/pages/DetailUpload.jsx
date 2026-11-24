import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { downloadExcel, errMsg } from '../services/api';
import StatusBadge, { KategoriBadge } from '../components/StatusBadge';
import { fmtDate, fmtNum } from '../utils/format';
import { btnGhost, card, input, td, th } from '../utils/ui';
import { Skeleton } from '../components/Skeleton';

// Label kolom realisasi mengikuti kategori file
const colsFor = (kategori) => [
  ['kode', 'Kode'],
  ['uraian', 'Uraian'],
  ['pagu_revisi', 'Pagu Efektif'],
  ['sampai_periode', kategori === 'SP2D' ? 'Realisasi SP2D' : 'Realisasi Akrual'],
  ['persentase', '%'],
];

// Baris ringkasan (total dan program) ditebalkan agar hierarki laporan mudah dibaca
const STRONG = ['TOTAL', 'PROGRAM'];

// Lebar kolom dikunci (table-fixed) agar posisi kolom sama persis antara skeleton dan data asli.
// Kolom "Uraian" memakai sisa lebar.
const COL_WIDTHS = ['w-14', 'w-28', '', 'w-40', 'w-40', 'w-24'];
const SKELETON_ROWS = 8;

function Info({ label, value, loading = false, skeleton = 'w-28', badge = false }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">
        {loading ? (
          badge ? (
            // sama dengan StatusBadge: inline-block + teks, hanya warna/teks transparan
            <span className="inline-block rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-transparent motion-safe:animate-pulse">
              Berhasil
            </span>
          ) : (
            <Skeleton as="span" className={`h-5 ${skeleton}`} />
          )
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export default function DetailUpload() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState('');

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setActionError('');
    try {
      await downloadExcel('/rekap/export', { upload_id: id }, `rekap-${id}.xlsx`);
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    api.get(`/uploads/${id}`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
        <Link to="/pelaporan" className={btnGhost}>Kembali</Link>
      </div>
    );
  }

  // Saat loading, layout yang sama tetap dirender; hanya isinya yang diganti skeleton.
  const loading = !data;
  const upload = data?.upload;
  const allRows = data?.rows ?? [];
  const notTaken = data?.not_taken_rows;
  const COLS = colsFor(upload?.kategori);

  // Pencarian kode atau uraian (tanpa membedakan huruf besar/kecil)
  const q = search.trim().toLowerCase();
  const rows = q ? allRows.filter((r) => `${r.kode || ''} ${r.uraian || ''}`.toLowerCase().includes(q)) : allRows;

  return (
    <div className="space-y-6" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="break-all text-2xl font-bold text-slate-900">
            {loading ? <Skeleton as="span" className="h-8 w-72 max-w-full" /> : upload.file_name}
          </h1>
        </div>
        {loading && <Skeleton className="h-[38px] w-[137px] rounded-lg" />}
        {!loading && allRows.length > 0 && (
          <button className={btnGhost} onClick={download} disabled={downloading}>
            {downloading ? 'Mengunduh…' : 'Download hasil'}
          </button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="shrink-0 font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      <dl className={`${card} grid gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4`}>
        <Info label="Satker" value={upload?.satker?.name} loading={loading} skeleton="w-44" />
        <Info label="Uploader" value={upload?.user.name} loading={loading} skeleton="w-36" />
        <Info label="Tanggal" value={upload && fmtDate(upload.uploaded_at)} loading={loading} skeleton="w-28" />
        <Info label="Kategori" value={upload && <KategoriBadge kategori={upload.kategori} />} loading={loading} badge />
        <Info label="Status" value={upload && <StatusBadge status={upload.upload_status} />} loading={loading} badge />
        <Info label="Total baris" value={fmtNum(upload?.total_rows, 0)} loading={loading} skeleton="w-10" />
        <Info label="Data berhasil" value={fmtNum(upload?.processed_rows, 0)} loading={loading} skeleton="w-10" />
        <Info label="Data tidak diambil" value={fmtNum(notTaken, 0)} loading={loading} skeleton="w-10" />
        <Info
          label="Status rekap"
          value={upload?.upload_status === 'FAILED' ? '-' : upload?.is_latest ? 'Terbaru' : 'Ada upload yang lebih baru'}
          loading={loading}
          skeleton="w-20"
        />
        {upload?.error_message && <Info label="Keterangan" value={upload.error_message} />}
      </dl>

      <div className={card}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <input
            type="search"
            className={`${input} min-w-[200px] flex-1 sm:max-w-sm`}
            placeholder="Cari kode atau uraian"
            aria-label="Cari kode atau uraian"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
          />
          {!loading && q && (
            <span className="text-sm text-slate-500">
              {fmtNum(rows.length, 0)} dari {fmtNum(allRows.length, 0)} baris
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed divide-y divide-slate-100">
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} className={w} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className={th}>No</th>
                {COLS.map(([k, label]) => (
                  <th
                    key={k}
                    className={`${th} ${k === 'kode' || k === 'uraian' ? 'text-left' : 'text-center'}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: SKELETON_ROWS }, (_, r) => (
                  <tr key={r} aria-hidden="true">
                    <td className={td}>
                      <Skeleton className="h-5 w-4" />
                    </td>
                    <td className={td}>
                      <Skeleton className="h-5 w-16" />
                    </td>
                    <td className={td}>
                      <Skeleton className="h-5 w-3/4" />
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-24" />
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-8" />
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-8" />
                    </td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr><td className={`${td} py-8 text-center text-slate-500`} colSpan={COLS.length + 1}>{q ? 'Tidak ada baris yang cocok dengan pencarian.' : 'Tidak ada data hasil rekap pada upload ini.'}</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className={td}>{i + 1}</td>
                  {COLS.map(([k]) => (
                    <td
                      key={k}
                      className={`${td} ${k === 'uraian' ? '' : 'whitespace-nowrap'} ${
                        k === 'kode' || k === 'uraian' ? '' : 'text-center'
                      } ${STRONG.includes(r.tipe) ? 'font-semibold text-slate-900' : ''}`}
                    >
                      {k === 'kode' ? r.kode || '-' : k === 'uraian' ? r[k] : fmtNum(r[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <span className="sr-only" role="status">
          Memuat detail…
        </span>
      )}
    </div>
  );
}
