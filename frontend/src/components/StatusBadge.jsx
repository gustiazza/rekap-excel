import { STATUS_LABEL } from '../utils/format';

const STYLES = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PARTIAL: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  FAILED: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[status] || ''}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

const KATEGORI_STYLES = {
  AKRUAL: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  SP2D: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

// Label kategori file (Akrual / SP2D)
export function KategoriBadge({ kategori }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${KATEGORI_STYLES[kategori] || ''}`}>
      {kategori === 'SP2D' ? 'SP2D' : 'Akrual'}
    </span>
  );
}
