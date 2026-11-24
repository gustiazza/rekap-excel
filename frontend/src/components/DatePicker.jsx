import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { input, inputInvalid } from '../utils/ui';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const POPUP_W = 288; // sama dengan w-72
const GAP = 6;
const MARGIN = 8;

const pad = (n) => String(n).padStart(2, '0');
const toStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
}

function todayStr() {
  const t = new Date();
  return toStr(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * Pemilih tanggal kustom.
 * value/min/max : string 'YYYY-MM-DD' (kosong = belum dipilih / tanpa batas)
 * onChange      : (string) => void, mengirim '' saat dihapus
 * align         : 'left' | 'right' (sisi popup terhadap tombol)
 *
 * Popup dirender lewat portal dengan posisi fixed, jadi tidak terpotong oleh induk yang overflow-hidden
 * (mis. popup form). Jika ruang di bawah kurang, popup membuka ke atas.
 */
export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pilih tanggal',
  align = 'left',
  disabled = false,
  invalid = false,
  className = '',
  ariaLabel,
}) {
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days'); // 'days' | 'months'
  const [view, setView] = useState({ y: 2026, m: 0 });
  const [pos, setPos] = useState(null);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const today = todayStr();
  const isOutOfRange = (str) => Boolean((min && str < min) || (max && str > max));

  const openPicker = () => {
    if (disabled) return;
    const base = parse(value) || parse(today);
    setView({ y: base.y, m: base.m });
    setMode('days');
    setPos(null);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const pick = (str) => {
    onChange(str);
    close();
    triggerRef.current?.focus();
  };

  // Hitung posisi popup terhadap tombol (koordinat layar)
  const place = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const h = popupRef.current ? popupRef.current.offsetHeight : 380;

    let left = align === 'right' ? r.right - POPUP_W : r.left;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - POPUP_W - MARGIN));

    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    let top = spaceBelow >= h || spaceBelow >= spaceAbove ? r.bottom + GAP : r.top - GAP - h;
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN));

    setPos({ top, left });
  };

  // Tinggi popup berubah saat bulan/mode berganti, jadi posisi dihitung ulang
  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, view]);

  // Ikuti tombol saat layar diubah ukurannya atau area di dalamnya digulir
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tutup saat klik di luar (popup ada di luar rootRef karena memakai portal)
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      const inside = rootRef.current?.contains(e.target) || popupRef.current?.contains(e.target);
      if (!inside) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const onKeyDown = (e) => {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      triggerRef.current?.focus();
    }
  };

  const shiftMonth = (delta) =>
    setView((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { y, m };
    });

  const label = selected ? `${selected.d} ${SHORT[selected.m]} ${selected.y}` : '';

  // Kisi hari: kosong di awal (minggu dimulai Senin), lalu tanggal 1..N
  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const navBtn =
    'grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700';

  const popup = (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={ariaLabel || 'Pilih tanggal'}
      style={{
        position: 'fixed',
        top: pos ? pos.top : 0,
        left: pos ? pos.left : 0,
        width: POPUP_W,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="z-[60] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
    >
      {/* HEADER */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={mode === 'days' ? 'Bulan sebelumnya' : 'Tahun sebelumnya'}
          onClick={() => (mode === 'days' ? shiftMonth(-1) : setView((v) => ({ ...v, y: v.y - 1 })))}
          className={navBtn}
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'days' ? 'months' : 'days'))}
          className="rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700"
        >
          {mode === 'days' ? `${MONTHS[view.m]} ${view.y}` : view.y}
        </button>

        <button
          type="button"
          aria-label={mode === 'days' ? 'Bulan berikutnya' : 'Tahun berikutnya'}
          onClick={() => (mode === 'days' ? shiftMonth(1) : setView((v) => ({ ...v, y: v.y + 1 })))}
          className={navBtn}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {mode === 'days' ? (
        <>
          {/* NAMA HARI */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
            {DAYS.map((d) => (
              <span key={d} className="py-1.5">{d}</span>
            ))}
          </div>

          {/* TANGGAL */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;

              const str = toStr(view.y, view.m, day);
              const isSelected = str === value;
              const isToday = str === today;
              const off = isOutOfRange(str);

              return (
                <button
                  key={str}
                  type="button"
                  disabled={off}
                  aria-label={`${day} ${MONTHS[view.m]} ${view.y}`}
                  aria-pressed={isSelected}
                  onClick={() => pick(str)}
                  className={`mx-auto grid h-9 w-9 place-items-center rounded-lg text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700 ${
                    isSelected
                      ? 'bg-slate-900 font-semibold text-white'
                      : off
                        ? 'cursor-not-allowed text-slate-300'
                        : `text-slate-700 hover:bg-slate-100 ${
                            isToday ? 'font-semibold ring-1 ring-inset ring-slate-300' : ''
                          }`
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        /* PILIH BULAN */
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {SHORT.map((name, i) => {
            const first = toStr(view.y, i, 1);
            const last = toStr(view.y, i, new Date(view.y, i + 1, 0).getDate());
            const off = Boolean((max && first > max) || (min && last < min));
            const isCurrent = selected && selected.y === view.y && selected.m === i;

            return (
              <button
                key={name}
                type="button"
                disabled={off}
                onClick={() => {
                  setView((v) => ({ ...v, m: i }));
                  setMode('days');
                }}
                className={`rounded-lg py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700 ${
                  isCurrent
                    ? 'bg-slate-900 font-semibold text-white'
                    : off
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
        <button
          type="button"
          disabled={!value}
          onClick={() => pick('')}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Hapus
        </button>
        <button
          type="button"
          disabled={isOutOfRange(today)}
          onClick={() => pick(today)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Hari ini
        </button>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openPicker())}
        className={`${invalid ? inputInvalid : input} flex items-center justify-between gap-2 text-left ${
          disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : 'cursor-pointer'
        } ${open ? 'border-slate-700 ring-2 ring-slate-700/15' : ''}`}
      >
        <span className={`truncate ${label ? '' : 'text-slate-400'}`}>{label || placeholder}</span>
        <Calendar size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && createPortal(popup, document.body)}
    </div>
  );
}