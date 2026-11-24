import { btnGhost } from '../utils/ui';

export default function Pagination({ pagination, onChange }) {
  if (!pagination) return null;
  const { page, total_pages: totalPages, total } = pagination;
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
      <p className="text-sm text-slate-500">{total.toLocaleString('id-ID')} data</p>
      <div className="flex items-center gap-2">
        <button className={btnGhost} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Sebelumnya
        </button>
        <span className="text-sm text-slate-600">
          Halaman {page} dari {totalPages}
        </span>
        <button className={btnGhost} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Berikutnya
        </button>
      </div>
    </div>
  );
}
