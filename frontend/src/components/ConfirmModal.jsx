import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  title = 'Hapus data?',
  children,
  detail,
  icon, // opsional. Kosong = ikon peringatan hanya untuk variant 'danger'
  variant = 'danger', // 'danger' (merah) atau 'primary' (gelap)
  confirmLabel = 'Ya, Hapus',
  busyLabel,
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  const danger = variant === 'danger';
  const Icon = icon === undefined ? (danger ? AlertTriangle : null) : icon;
  const loadingText = busyLabel || (danger ? 'Menghapus...' : 'Menyimpan...');

  // Tekan Esc untuk menutup
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const submit = (e) => {
    e.preventDefault();
    if (!busy) onConfirm(e);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 m-0 grid place-items-center overflow-y-auto bg-slate-900/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        role={danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <form onSubmit={submit} noValidate>
          <div className="flex items-start gap-4 p-6">
            {Icon && (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  danger ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon size={25} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>

              {detail && (
                <div className="mt-4 break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800">
                  {detail}
                </div>
              )}

              {error && (
                <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              aria-label="Tutup popup"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={busy}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-700'
              }`}
            >
              {danger && <AlertTriangle size={16} />}
              {busy ? loadingText : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}