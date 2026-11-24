import { Link } from 'react-router-dom';

// Ikon aksi (SVG sebaris, tanpa pustaka tambahan)
const PATHS = {
  detail: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9" />
      <path d="m17 6 3 3" />
    </>
  ),
  deactivate: (
    <>
      <path d="M12 3v8" />
      <path d="M6.4 6.4a8 8 0 1 0 11.2 0" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  activate: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
};

const VARIANT = {
  default: 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  primary: 'border border-slate-900 bg-slate-900 text-white hover:bg-slate-700',
  danger: 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
};

const BASE =
  'inline-flex h-8 w-8 items-center justify-center rounded-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

function Svg({ name }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Tombol ikon. `label` dipakai untuk tooltip dan pembaca layar. */
export function IconButton({ icon, label, variant = 'default', busy = false, ...rest }) {
  return (
    <button type="button" title={label} aria-label={label} className={`${BASE} ${VARIANT[variant]}`} {...rest}>
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Svg name={icon} />
      )}
    </button>
  );
}

/** Tautan berbentuk tombol ikon */
export function IconLink({ icon, label, variant = 'default', to }) {
  return (
    <Link to={to} title={label} aria-label={label} className={`${BASE} ${VARIANT[variant]}`}>
      <Svg name={icon} />
    </Link>
  );
}

// Kotak abu-abu untuk skeleton dengan ukuran yang sama persis dengan tombol ikon
export const ICON_GHOST = 'inline-block h-8 w-8 rounded-md bg-slate-200/80 motion-safe:animate-pulse';
