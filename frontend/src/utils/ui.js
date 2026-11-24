// Kelas Tailwind yang dipakai ulang
const inputBase =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2';
export const input = `${inputBase} border-slate-300 focus:border-slate-700 focus:ring-slate-700/15`;
export const inputInvalid = `${inputBase} border-red-500 focus:border-red-500 focus:ring-red-500/20`;
const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
export const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700`;
export const btnSmall = 'rounded-md px-2.5 py-1 text-xs font-semibold transition';
export const card = 'rounded-xl border border-slate-200 bg-white';
export const th = 'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500';
export const td = 'px-4 py-3 text-sm text-slate-700';
