import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import StatusBadge, { KategoriBadge } from '../components/StatusBadge';
import { RekapSection, SatkerRekapTable } from '../components/RekapTables';
import ConfirmModal from '../components/ConfirmModal';
import Select from '../components/Select';
import DatePicker from '../components/DatePicker';
import { SkeletonRows } from '../components/Skeleton';
import { IconButton, IconLink } from '../components/ActionIcon';
import { STATUS_LABEL, fmtNum, fmtShortDate } from '../utils/format';
import { card, input, td, th } from '../utils/ui';

const EMPTY = {
  search: '',
  status: '',
  kategori: '',
  satker_id: '',
  date_from: '',
  date_to: '',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

const KATEGORI_OPTIONS = [
  { value: '', label: 'Semua kategori' },
  { value: 'AKRUAL', label: 'Akrual' },
  { value: 'SP2D', label: 'SP2D' },
];

export default function Pelaporan() {
  const { user } = useAuth();
  const admin = user.role === 'ADMIN';

  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [satkers, setSatkers] = useState([]);
  const [summary, setSummary] = useState(null); // { rows, total }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Riwayat upload (mengikuti semua filter)
  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = Object.fromEntries(
        Object.entries({ ...filters, page, limit: 10 }).filter(([, v]) => v !== '')
      );
      const res = await api.get('/uploads', { params });
      setRows(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Jumlah per satker (mengikuti filter satker dan tanggal upload)
  const loadSummary = useCallback(async () => {
    try {
      const params = Object.fromEntries(
        Object.entries({
          satker_id: filters.satker_id,
          date_from: filters.date_from,
          date_to: filters.date_to,
        }).filter(([, v]) => v !== '')
      );
      const res = await api.get('/satker/summary', { params });
      setSummary(res.data);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [filters.satker_id, filters.date_from, filters.date_to]);

  // Jeda 300 ms agar pencarian tidak memanggil API di setiap ketikan
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    api
      .get('/satker')
      .then((r) => setSatkers(r.data.data))
      .catch(() => {});
  }, []);

  const satkerOptions = [
    { value: '', label: 'Semua satker' },
    ...satkers.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const setFilter = (key, value) => {
    setPage(1);

    setFilters((f) => {
      const next = { ...f, [key]: value };

      // Rentang tanggal tidak boleh terbalik
      if (next.date_from && next.date_to && next.date_from > next.date_to) {
        if (key === 'date_from') next.date_to = '';
        else if (key === 'date_to') next.date_from = '';
      }

      return next;
    });
  };

  const askDelete = (u) => {
    setDeleteError('');
    setTarget(u);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');

    try {
      await api.delete(`/uploads/${target.id}`);
      setNotice(`Upload "${target.file_name}" berhasil dihapus.`);
      setTarget(null);
      loadSummary();

      // Jika yang dihapus adalah satu-satunya baris di halaman terakhir, mundur satu halaman
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (e) {
      setDeleteError(errMsg(e));
    } finally {
      setDeleting(false);
    }
  };

  const startNumber = pagination ? (pagination.page - 1) * pagination.limit : 0;
  const summaryRows = summary?.rows ?? [];
  const summaryLoading = !summary;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pelaporan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hasil rekap seluruh satker dan riwayat upload
          </p>
        </div>
      </div>

      {/* FILTER */}
      <div className={`${card} flex flex-wrap items-center gap-3 p-4`}>
        <Select
          className="w-full sm:w-80"
          ariaLabel="Filter satker"
          searchable
          searchPlaceholder="Cari satker..."
          options={satkerOptions}
          value={filters.satker_id}
          onChange={(v) => setFilter('satker_id', v)}
        />
        <Select
            className="w-full sm:w-44"
            ariaLabel="Filter status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
          />

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <DatePicker
            className="w-full sm:w-44"
            ariaLabel="Dari tanggal"
            placeholder="Dari tanggal"
            value={filters.date_from}
            max={filters.date_to || undefined}
            onChange={(v) => setFilter('date_from', v)}
          />

          <DatePicker
            className="w-full sm:w-44"
            ariaLabel="Sampai tanggal"
            placeholder="Sampai tanggal"
            align="right"
            value={filters.date_to}
            min={filters.date_from || undefined}
            onChange={(v) => setFilter('date_to', v)}
          />
        </div>
      </div>

      {/* NOTIFIKASI */}
      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span className="break-all">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="shrink-0 font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ERROR MEMUAT DATA */}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* REKAP PER SATKER (sama dengan Dashboard; mengikuti filter satker dan tanggal) */}
      <RekapSection
        title="Rekap per satker"
        subtitle="File terbaru tiap satker pada rentang tanggal upload yang dipilih, untuk kategori Akrual dan SP2D."
      >
        <SatkerRekapTable rows={summary?.rows} total={summary?.total} loading={summaryLoading} />
      </RekapSection>

      {/* RIWAYAT UPLOAD */}
      <section className={card} aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Riwayat upload</h2>
            <p className="mt-1 text-xs text-slate-400">
              Semua upload tetap tersimpan. Dashboard memakai file terbaru tiap satker pada masing-masing kategori.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <input
              type="search"
              className={`${input} w-full sm:w-64`}
              placeholder="Cari nama file atau pengguna"
              aria-label="Cari nama file atau pengguna"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
            <Select
              className="w-full sm:w-44"
              ariaLabel="Filter kategori"
              options={KATEGORI_OPTIONS}
              value={filters.kategori}
              onChange={(v) => setFilter('kategori', v)}
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[1000px] table-fixed divide-y divide-slate-100">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>

            <thead>
              <tr>
                <th className={`${th} text-center`}>No</th>
                <th className={`${th} text-left`}>Satker</th>
                <th className={`${th} text-left`}>Pengguna</th>
                <th className={`${th} text-left`}>File</th>
                <th className={`${th} text-center`}>Kategori</th>
                <th className={`${th} text-center`}>Jumlah Data</th>
                <th className={`${th} text-center`}>Tanggal Upload</th>
                <th className={`${th} text-center`}>Status</th>
                <th className={`${th} text-center`}>Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 && (
                <SkeletonRows rows={6} cols={9} />
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className={`${td} py-8 text-center text-slate-500`}
                  >
                    Tidak ada data yang sesuai.
                  </td>
                </tr>
              )}

              {rows.map((u, i) => (
                <tr key={u.id} className={`hover:bg-slate-50 ${loading ? 'opacity-50' : ''}`}>
                  <td className={`${td} text-center`}>{startNumber + i + 1}</td>

                  <td className={`${td} break-words text-left`} title={u.satker?.name}>
                    {u.satker ? u.satker.name : '-'}
                  </td>

                  <td className={`${td} truncate text-left`} title={u.user.name}>
                    {u.user.name}
                  </td>

                  <td
                    className={`${td} truncate text-left font-medium text-slate-900`}
                    title={u.file_name}
                  >
                    {u.file_name}
                  </td>

                  <td className={`${td} text-center`}>
                    <KategoriBadge kategori={u.kategori} />
                  </td>

                  <td className={`${td} text-center`}>{fmtNum(u.processed_rows, 0)}</td>

                  <td className={`${td} whitespace-nowrap text-center`}>
                    {fmtShortDate(u.uploaded_at)}
                  </td>

                  <td className={`${td} text-center`}>
                    <StatusBadge status={u.upload_status} />
                    {u.upload_status !== 'FAILED' && u.is_latest && (
                      <span className="mt-1 block text-[11px] font-medium text-emerald-600">Terbaru</span>
                    )}
                  </td>

                  <td className={td}>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      <IconLink to={`/pelaporan/${u.id}`} icon="detail" label="Detail" variant="primary" />

                      {admin && (
                        <IconButton icon="trash" label="Hapus" variant="danger" onClick={() => askDelete(u)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onChange={setPage} />
      </section>

      {/* POPUP HAPUS FILE UPLOAD */}
      {target && (
        <ConfirmModal
          title="Hapus file upload?"
          confirmLabel="Ya, Hapus File"
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setTarget(null)}
          detail={
            <>
              {target.file_name}
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {target.satker ? `${target.satker.name} · ` : ''}Diunggah oleh {target.user.name}
              </span>
            </>
          }
        >
          Apakah kamu yakin ingin menghapus file ini beserta{' '}
          <span className="font-semibold text-slate-800">
            {fmtNum(target.processed_rows, 0)} data rekap
          </span>
          -nya? Tindakan ini tidak dapat dibatalkan.
          {target.is_latest && (
            <span className="mt-2 block text-slate-600">
              File ini adalah yang terbaru untuk satker dan kategorinya. Jika ada upload sebelumnya,
              dashboard otomatis memakai upload tersebut.
            </span>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
