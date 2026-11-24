import { card, td, th } from '../utils/ui';

/**
 * Blok abu-abu berdenyut sebagai pengganti konten yang sedang dimuat.
 * Animasi dimatikan otomatis bagi pengguna yang mengaktifkan "reduce motion".
 */
export function Skeleton({ className = '', as: Tag = 'div', style }) {
  // as="span" dipakai di dalam <p>; dibuat block agar kelas h-/w- berlaku
  return <Tag aria-hidden="true" style={style} className={`${Tag === 'span' ? 'block ' : ''}rounded-md bg-slate-200/80 motion-safe:animate-pulse ${className}`} />;
}

/**
 * Baris tabel pengganti. Jumlah sel harus sama dengan jumlah kolom tabel asli.
 * widths: kelas lebar per kolom, misalnya ['w-6', 'w-32', ...]
 */
export function SkeletonRows({ rows = 5, cols = 5, widths = [], center = true }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className={`${td} ${center ? 'text-center' : ''}`}>
          <Skeleton className={`h-5 ${center ? 'mx-auto' : ''} ${widths[c] || 'w-3/4'}`} />
        </td>
      ))}
    </tr>
  ));
}

/*
 * Kerangka Dashboard meniru markup Dashboard.jsx (kelas pembungkus, padding, tinggi baris).
 * Tinggi blok = line-height teks aslinya: text-xs=h-4, text-sm=h-5, text-base=h-6, text-lg=h-7, text-3xl=h-9.
 * Jika Dashboard.jsx diubah (padding, ukuran font, susunan), ubah juga bagian ini.
 */

const ArrowIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

/** Kartu statistik (sama dengan DashboardStat) */
function SkeletonStat() {
  return (
    <div className={`${card} relative overflow-hidden p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-9 w-24" />
          <Skeleton className="mt-1.5 h-4 w-36" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-200/80" />
    </div>
  );
}

/** Kartu grafik (sama dengan ChartCard di Dashboard) */
function SkeletonChartCard({ title, subtitle, className = '', height = 256 }) {
  return (
    <div className={`${card} overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-end gap-4" style={{ height }}>
          {['h-2/5', 'h-3/5', 'h-4/5', 'h-1/2', 'h-2/3', 'h-3/4'].map((h, i) => (
            <Skeleton key={i} className={`flex-1 ${h}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Kartu "Aktivitas upload terbaru" (sama dengan yang asli) */
function SkeletonRecent({ admin, rows = 5 }) {
  const cols = admin ? 5 : 4;
  return (
    <section className={card}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Aktivitas upload terbaru</h2>
          <p className="mt-1 text-xs text-slate-400">Riwayat upload terakhir dalam sistem</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          Lihat semua
          <ArrowIcon />
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead>
            <tr>
              <th className={`${th} text-left`}>File</th>
              {admin && <th className={`${th} text-center`}>Pengguna</th>}
              <th className={`${th} text-center`}>Jumlah Data</th>
              <th className={`${th} text-center`}>Tanggal</th>
              <th className={`${th} text-center`}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <td className={`${td} min-w-[280px]`}>
                  <Skeleton className="h-5 w-64 max-w-full" />
                </td>
                {Array.from({ length: cols - 1 }, (_, c) => (
                  <td key={c} className={`${td} text-center`}>
                    <Skeleton className={`mx-auto ${c === cols - 2 ? 'h-6 w-20 rounded-full' : 'h-5 w-20'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Kerangka Dashboard: header asli tetap tampil, isinya pengganti. title/subtitle boleh berupa JSX. */
export function DashboardSkeleton({ title, subtitle, admin }) {
  return (
    <div className="space-y-7" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat dashboard…</span>

      {/* HEADER */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Skeleton className="h-11 w-36 rounded-lg" />
      </section>

      {/* STATISTIK */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonStat key={i} />
        ))}
      </section>

      {/* GRAFIK (ADMIN) */}
      {admin && (
        <section className="space-y-4" aria-hidden="true">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Statistik</h2>
              <p className="mt-1 text-sm text-slate-500">Ringkasan aktivitas upload dan data setiap pengguna</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonChartCard title="Jumlah upload per pengguna" subtitle="Total file yang diupload setiap pengguna" />
            <SkeletonChartCard title="Jumlah data per pengguna" subtitle="Total data hasil rekap setiap pengguna" />
            <SkeletonChartCard
              title="Jumlah upload per bulan"
              subtitle="Perkembangan jumlah upload dari waktu ke waktu"
              className="lg:col-span-2"
            />
          </div>
        </section>
      )}

      {/* AKTIVITAS UPLOAD TERBARU */}
      <div aria-hidden="true">
        <SkeletonRecent admin={admin} />
      </div>
    </div>
  );
}

const DETAIL_COLS = ['Uraian', 'Pagu Revisi', 'Lock Pagu', 'Periode Lalu', 'Periode Ini', 'Sampai Periode', '%', 'Sisa Anggaran'];

/** Kerangka Detail Upload (sama dengan DetailUpload) */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat detail…</span>

      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <div>
          <span className="text-sm text-slate-500">← Pelaporan</span>
          <Skeleton className="h-8 w-72 max-w-full" />
        </div>
        <Skeleton className="h-[38px] w-32 rounded-lg" />
      </div>

      <dl className={`${card} grid gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4`} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-0.5 h-5 w-28" />
          </div>
        ))}
      </dl>

      <div className={card} aria-hidden="true">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <th className={th}>No</th>
                {DETAIL_COLS.map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <SkeletonRows rows={6} cols={9} center={false} widths={['w-6', 'w-48']} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
