import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtNum, fmtPct, fmtRpShort } from '../utils/format';
import { btnGhost, btnPrimary, card, input } from '../utils/ui';
import { Skeleton } from '../components/Skeleton';
import Select from '../components/Select';
import useManualInput from '../components/ManualInput';
import DatePicker from '../components/DatePicker';
import { BelanjaMatrixTable, GroupRekapTable, RekapSection, SatkerRekapTable } from '../components/RekapTables';
import BrmpRekapTable from '../components/BrmpRekapTable';
import SatkerChart from '../components/SatkerChart';


/* ------------------------------------------------------------------ */
/* IKON                                                                */
/* ------------------------------------------------------------------ */

function Icon({ type, className = 'h-5 w-5' }) {
  const props = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'wallet') {
    return (
      <svg {...props}>
        <path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h13" />
        <path d="M3 5v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4" />
        <path d="M17 12h5v4h-5a2 2 0 0 1 0-4z" />
      </svg>
    );
  }

  if (type === 'check') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    );
  }

  if (type === 'percent') {
    return (
      <svg {...props}>
        <path d="M19 5 5 19" />
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
      </svg>
    );
  }

  if (type === 'building') {
    return (
      <svg {...props}>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
    );
  }

  if (type === 'upload') {
    return (
      <svg {...props}>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </svg>
    );
  }

  if (type === 'arrow') {
    return (
      <svg {...props}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* KARTU STATISTIK                                                     */
/* ------------------------------------------------------------------ */

function DashboardStat({ label, value, icon, description, accent = 'navy', loading = false }) {
  const iconClass =
    accent === 'gold'
      ? 'bg-amber-50 text-amber-600 ring-amber-100'
      : 'bg-slate-100 text-slate-700 ring-slate-200';

  return (
    <div
      className={`${card} relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>

          <p className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-900">
            {loading ? <Skeleton as="span" className="h-9 w-24" /> : value}
          </p>

          {description && <p className="mt-1.5 text-xs text-slate-400">{description}</p>}
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${iconClass}`}>
          <Icon type={icon} className="h-5 w-5" />
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 h-1 w-full ${accent === 'gold' ? 'bg-amber-400' : 'bg-slate-700'}`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HALAMAN                                                             */
/* ------------------------------------------------------------------ */

const EMPTY_FILTER = { date_from: '', date_to: '' };

export default function Dashboard() {
  const { user } = useAuth();

  const [filters, setFilters] = useState(EMPTY_FILTER);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Tabel program dan belanja: '' = jumlah seluruh satker (hanya lihat); satu satker = pagu total dapat diubah langsung
  const [groupSatker, setGroupSatker] = useState('');
  const [groupData, setGroupData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [brmp, setBrmp] = useState(null); // rekap khusus BRMP Perkebunan
  const [brmpPdfBusy, setBrmpPdfBusy] = useState(false);
  const [brmpSearch, setBrmpSearch] = useState('');

  const isAdmin = user.role === 'ADMIN';
  const showBrmp = isAdmin || (user.satker?.name || '').trim().toLowerCase() === 'brmp perkebunan';
  const canEditSatker = (id) => isAdmin || user.satker?.id === Number(id);

  const manual = useManualInput({
    onSaved: (msg) => {
      setNotice(msg);
      setReloadKey((k) => k + 1);
    },
  });

  const loading = !data;

  // Filter tanggal memuat ulang seluruh rekap; tabel lama tetap tampil (redup) selama memuat
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    setRefreshing(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));

    api
      .get('/dashboard', { params })
      .then((r) => {
        if (!alive) return;
        setData(r.data);
        setError('');
      })
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setRefreshing(false));

    return () => {
      alive = false;
    };
  }, [filters, reloadKey]);

  // Rekap program dan belanja untuk satker yang dipilih
  useEffect(() => {
    if (!groupSatker) {
      setGroupData(null);
      return undefined;
    }
    let alive = true;
    const params = { satker_id: groupSatker, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) };
    api
      .get('/dashboard/group', { params })
      .then((r) => alive && setGroupData(r.data))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [groupSatker, filters, reloadKey]);

  // Rekap khusus BRMP Perkebunan mengikuti filter tanggal
  useEffect(() => {
    if (!showBrmp) return undefined;
    let alive = true;
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    api
      .get('/dashboard/brmp', { params })
      .then((r) => alive && setBrmp(r.data))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [showBrmp, filters, reloadKey]);

  const changeGroupSatker = (v) => {
    setGroupData(null);
    setGroupSatker(v);
  };

  const setFilter = (key, value) =>
    setFilters((f) => {
      const next = { ...f, [key]: value };

      // Rentang tanggal tidak boleh terbalik
      if (next.date_from && next.date_to && next.date_from > next.date_to) {
        if (key === 'date_from') next.date_to = '';
        else next.date_from = '';
      }
      return next;
    });

  if (error && !data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const totals = data?.totals;

  const groupMode = Boolean(groupSatker);
  const groupLoading = groupMode ? !groupData : loading;
  const perProgram = groupMode ? groupData?.per_program : data?.per_program;
  const perBelanja = groupMode ? groupData?.per_belanja : data?.per_belanja;
  const groupCanEdit = groupMode && canEditSatker(groupSatker);
  const groupName = data?.per_satker?.find((r) => String(r.satker.id) === String(groupSatker))?.satker.name || '';
  const satkerOptions = [
    { value: '', label: 'Semua Satker (Jumlah)' },
    ...(data?.per_satker || []).map((r) => ({ value: String(r.satker.id), label: r.satker.name })),
  ];

  const groupManual = (jenis, labelPrefix) =>
    groupMode
      ? {
          canEdit: groupCanEdit,
          edit: (r) =>
            manual.edit({ satkerId: Number(groupSatker), jenis, kode: r.kode, label: `${labelPrefix} ${r.uraian || r.kode}`, current: r.pagu_total }),
          history: (r) =>
            manual.history({ satkerId: Number(groupSatker), jenis, kode: r.kode, label: `${labelPrefix} ${r.uraian || r.kode}` }),
        }
      : undefined;
  const filtered = Boolean(filters.date_from || filters.date_to);

  const downloadBrmpPdf = async () => {
    if (!brmp || brmpPdfBusy) return;
    setBrmpPdfBusy(true);
    try {
      const { downloadBrmpPdf: build } = await import('../utils/pdfRekap');
      await build(brmp);
    } catch (e) {
      setError('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      setBrmpPdfBusy(false);
    }
  };

  // PDF mengikuti data yang sedang tampil (filter tanggal ikut berlaku)
  const downloadPdf = async () => {
    if (!data || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { downloadRekapPdf } = await import('../utils/pdfRekap');
      await downloadRekapPdf(data);
    } catch (e) {
      setError('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      setPdfBusy(false);
    }
  };

  const statCards = [
    {
      label: 'Pagu Total',
      icon: 'building',
      description: 'Dari seluruh satker',
      value: fmtRpShort(totals?.pagu_total),
    },
    {
      label: 'Pagu Efektif',
      icon: 'wallet',
      accent: 'gold',
      description: 'Dari seluruh satker',
      value: fmtRpShort(totals?.pagu_efektif),
    },
    {
      label: 'Realisasi Akrual',
      icon: 'check',
      description: `${fmtPct(totals?.persentase_akrual)} dari pagu efektif`,
      value: fmtRpShort(totals?.realisasi_akrual),
    },
    {
      label: 'Realisasi SP2D',
      icon: 'percent',
      accent: 'gold',
      description: `${fmtPct(totals?.persentase_sp2d)} dari pagu efektif`,
      value: fmtRpShort(totals?.realisasi_sp2d),
    },
  ];

  return (
    <div className="space-y-7" aria-busy={loading || refreshing}>
      {/* HEADER */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>

          <p className="mt-1 text-sm text-slate-500">
            Selamat datang kembali, <span className="font-medium text-slate-700">{user.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={`${btnGhost} h-11 px-5`} onClick={downloadPdf} disabled={loading || pdfBusy}>
            {pdfBusy ? 'Membuat PDF…' : 'Download PDF'}
          </button>

          <Link to="/upload" className={`${btnPrimary} h-11 px-5 shadow-sm`}>
            <Icon type="upload" className="h-4 w-4" />
            Upload Excel
          </Link>
        </div>
      </section>

      {/* FILTER TANGGAL */}
      <section className={`${card} flex flex-wrap items-center gap-3 p-4`}>
        <p className="mr-auto text-sm text-slate-500">
          {filtered
            ? 'Menampilkan file terbaru tiap satker pada rentang tanggal upload ini.'
            : 'Menampilkan file terbaru tiap satker. Pilih tanggal untuk melihat kondisi pada waktu tertentu.'}
        </p>

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

        {filtered && (
          <button type="button" className={btnGhost} onClick={() => setFilters(EMPTY_FILTER)}>
            Atur ulang
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="shrink-0 font-semibold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* STATISTIK */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((c) => (
          <DashboardStat key={c.label} {...c} loading={loading} />
        ))}
      </section>

      <div className={`space-y-7 transition-opacity ${refreshing && !loading ? 'opacity-60' : ''}`}>
        {/* REKAP PER SATKER */}
        <RekapSection
          title="Rekap per Satker"
          subtitle="Pagu efektif dan Realisasi Akrual dari file Akrual terbaru, Realisasi SP2D dari file SP2D terbaru. Pagu Total dan % Target SP2D dapat diisi langsung dengan mengklik selnya."
        >
          <SatkerRekapTable
            rows={data?.per_satker}
            total={data?.totals}
            loading={loading}
            refDate={data?.ref}
            manual={{ canEdit: canEditSatker, canEditTotal: isAdmin, edit: manual.edit, history: manual.history }}
          />
        </RekapSection>

        {/* GRAFIK PERBANDINGAN PER SATKER */}
        <RekapSection
          title="Grafik Perbandingan per Satker"
          subtitle="Pagu Efektif, Realisasi SP2D, dan Target SP2D (Rp) tiap satker. Gap di atas tiap satker adalah % SP2D dikurangi % Target SP2D."
        >
          <SatkerChart rows={data?.per_satker} loading={loading} />
        </RekapSection>

        {/* REALISASI AKRUAL PER SATKER PER JENIS BELANJA */}
        <RekapSection
          title="Realisasi Akrual per Satker per Jenis Belanja"
          subtitle="Pagu efektif dan realisasi dari baris akun (kode 6 digit) file Akrual. Pagu Total dapat diisi langsung dengan mengklik selnya."
        >
          <BelanjaMatrixTable
            kategori="AKRUAL"
            data={data?.belanja_akrual}
            loading={loading}
            manual={{ canEdit: canEditSatker, edit: manual.edit, history: manual.history }}
          />
        </RekapSection>

        {/* REALISASI SP2D PER SATKER PER JENIS BELANJA */}
        <RekapSection
          title="Realisasi SP2D per Satker per Jenis Belanja"
          subtitle="Realisasi dari baris akun file SP2D; Pagu Efektif tetap dari file Akrual. Pagu Total dapat diinput langsung, sama dengan tabel di atas."
        >
          <BelanjaMatrixTable
            kategori="SP2D"
            data={data?.belanja_sp2d}
            loading={loading}
            manual={{ canEdit: canEditSatker, edit: manual.edit, history: manual.history }}
          />
        </RekapSection>

        {/* PILIHAN SATKER UNTUK TABEL PROGRAM DAN BELANJA */}
        <section className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
          <p className="min-w-0 flex-1 text-sm text-slate-500">
            {groupMode
              ? groupCanEdit
                ? `Menampilkan ${groupName}. Klik angka Pagu Total untuk mengisi atau mengubahnya.`
                : `Menampilkan ${groupName}. Anda hanya dapat melihat satker ini.`
              : 'Tabel program dan belanja di bawah menjumlahkan seluruh satker. Pilih satu satker untuk mengisi Pagu Total.'}
          </p>
          <Select
            className="w-full sm:w-80"
            ariaLabel="Satker untuk rekap program dan belanja"
            searchable
            searchPlaceholder="Cari satker..."
            options={satkerOptions}
            value={groupSatker}
            onChange={changeGroupSatker}
          />
        </section>

        {/* REKAP PER PROGRAM */}
        <RekapSection
          title="Rekap per Program"
          subtitle={groupMode ? `Baris Program (kode dua huruf, mis. EC) ${groupName}` : 'Baris Program (kode dua huruf) dari seluruh Satker.'}
          actions={
            groupCanEdit ? (
              <button type="button" className={btnGhost} onClick={() => manual.addProgram(Number(groupSatker))}>
                Tambah program
              </button>
            ) : null
          }
        >
          <GroupRekapTable
            firstLabel="Program"
            rows={perProgram?.rows}
            total={perProgram?.total}
            loading={groupLoading}
            empty="Belum ada data program. Upload laporan terlebih dahulu."
            manual={groupManual('PAGU_PROGRAM', 'pagu total program')}
          />
        </RekapSection>

        {/* REKAP PER BELANJA */}
        <RekapSection
          title="Rekap per Jenis Belanja"
          subtitle={groupMode ? `Baris Akun Belanja (kode 6 digit) ${groupName}, dikelompokkan menurut jenis belanja.` : 'Baris akun belanja (kode 6 digit) dikelompokkan menurut jenis belanja.'}
        >
          <GroupRekapTable
            firstLabel="Jenis Belanja"
            rows={perBelanja?.rows}
            total={perBelanja?.total}
            loading={groupLoading}
            empty="Belum ada data belanja."
            manual={groupManual('PAGU_BELANJA', 'pagu total')}
          />
        </RekapSection>

        {/* REKAP KHUSUS BRMP PERKEBUNAN */}
        {showBrmp && (
        <RekapSection
          title="Rekap BRMP Perkebunan"
          subtitle="Baris Program, RO, Komponen, dan Sub-komponen dari file Akrual dan SP2D terbaru. Pagu Total dan % Target SP2D diinput manual per baris: klik angkanya untuk mengisi."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                className={`${input} w-full sm:w-64`}
                placeholder="Cari kode atau nama"
                aria-label="Cari kode atau nama di rekap BRMP Perkebunan"
                value={brmpSearch}
                onChange={(e) => setBrmpSearch(e.target.value)}
              />
              <button type="button" className={btnGhost} onClick={downloadBrmpPdf} disabled={!brmp?.rows?.length || brmpPdfBusy}>
                {brmpPdfBusy ? 'Membuat PDF…' : 'Download PDF'}
              </button>
            </div>
          }
        >
          <BrmpRekapTable 
            data={brmp} 
            search={brmpSearch} 
            loading={!brmp}
            refDate={brmp?.ref}
            manual={{ canEdit: canEditSatker, edit: manual.edit, history: manual.history }}
          />
        </RekapSection>
        )}
      </div>

      {manual.element}

      {loading && (
        <span className="sr-only" role="status">
          Memuat dashboard…
        </span>
      )}
    </div>
  );
}