import { AlertCircle } from 'lucide-react';

export default function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}

      {error ? (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </label>
  );
}