import { card } from '../utils/ui';
import { fmtNum } from '../utils/format';

/*
 * Grafik batang per satker: Pagu Efektif, Realisasi SP2D dan Target SP2D (Rp).
 * Target SP2D (Rp) = % Target SP2D x Pagu Efektif. Urutan satker sama dengan tabel Rekap per Satker.
 * Gap (% SP2D - % Target) ditampilkan di atas tiap satker. Digambar dengan SVG, tanpa library tambahan.
 */

const COLORS = { pagu: '#1E293B', sp2d: '#C9A227', target: '#CBD5E1' };
const SERIES = [
  { key: 'pagu', label: 'Pagu Efektif' },
  { key: 'sp2d', label: 'Realisasi SP2D' },
  { key: 'target', label: 'Target SP2D' },
];

const has = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v));

// 91.202.254.000 -> "91,2 M" (miliar), "1,3 T" (triliun), "850 Jt" (juta)
const compact = (v) => {
  const n = Number(v);
  const a = Math.abs(n);
  const f = (x) => x.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  if (a >= 1e12) return `${f(n / 1e12)} T`;
  if (a >= 1e9) return `${f(n / 1e9)} M`;
  if (a >= 1e6) return `${f(n / 1e6)} Jt`;
  return f(n);
};

const niceMax = (v) => {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

// Pecah nama satker menjadi paling banyak 3 baris
function wrap(text, max, lines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  words.forEach((w) => {
    if (line && `${line} ${w}`.length > max) {
      out.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  });
  if (line) out.push(line);
  if (out.length > lines) {
    const cut = out.slice(0, lines);
    cut[lines - 1] = `${cut[lines - 1].slice(0, Math.max(1, max - 1))}…`;
    return cut;
  }
  return out;
}

const SLOT = 190;
const BAR = 36;
const GAP = 4;
const LEFT = 64;
const RIGHT = 16;
const TOP = 36;
const PLOT = 250;
const BOTTOM = 92;

export default function SatkerChart({ rows = [], loading = false }) {
  const items = (rows || [])
    .map((r) => {
      const pagu = has(r.pagu_efektif) ? Number(r.pagu_efektif) : null;
      const sp2d = has(r.realisasi_sp2d) ? Number(r.realisasi_sp2d) : null;
      const pct = has(r.target_sp2d) ? Number(r.target_sp2d) : null;
      return {
        id: r.satker.id,
        name: r.satker.name,
        pagu,
        sp2d,
        pct,
        target: pagu !== null && pct !== null ? (pagu * pct) / 100 : null,
        gap: has(r.gap) ? Number(r.gap) : null,
      };
    });

  if (loading) {
    return <div className={`${card} h-72 animate-pulse bg-slate-50`} aria-hidden="true" />;
  }

  if (items.length === 0) {
    return <div className={`${card} px-5 py-10 text-center text-sm text-slate-500`}>Belum ada data untuk digambarkan.</div>;
  }

  const peak = Math.max(...items.flatMap((i) => [i.pagu, i.sp2d, i.target].filter(has).map(Number)), 0);
  const maxY = niceMax(peak);
  const y = (v) => TOP + PLOT - (Number(v) / maxY) * PLOT;
  const width = Math.max(640, LEFT + RIGHT + items.length * SLOT);
  const height = TOP + PLOT + BOTTOM;
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => (maxY / 5) * i);
  const groupW = BAR * 3 + GAP * 2;

  return (
    <div className={`${card} p-5`}>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[s.key] }} />
            {s.label}
          </span>
        ))}
        <span className="text-slate-400">
          Rp dalam miliar (M). Target SP2D = % Target x Pagu Efektif. Urutan satker sama dengan tabel Rekap per Satker.
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Grafik batang Pagu Efektif, Realisasi SP2D dan Target SP2D per satker"
          className="mx-auto block"
          fontFamily="inherit"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#CBD5E1' : '#E2E8F0'} strokeWidth="1" />
              <text x={LEFT - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748B">
                {t === 0 ? '0' : compact(t)}
              </text>
            </g>
          ))}

          {items.map((it, i) => {
            const cx = LEFT + SLOT * i + SLOT / 2;
            const x0 = cx - groupW / 2;
            const bars = [
              { key: 'pagu', value: it.pagu, name: 'Pagu Efektif' },
              { key: 'sp2d', value: it.sp2d, name: 'Realisasi SP2D' },
              { key: 'target', value: it.target, name: 'Target SP2D' },
            ];
            const gapColor = it.gap === null ? '#64748B' : it.gap < 0 ? '#DC2626' : '#059669';
            const lines = wrap(it.name, 24);

            return (
              <g key={it.id}>
                <text x={cx} y={TOP - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill={gapColor}>
                  {it.gap === null ? 'Gap -' : `Gap ${it.gap > 0 ? '+' : ''}${fmtNum(it.gap, 2)}%`}
                </text>

                {bars.map((b, k) => {
                  if (!has(b.value)) return null;
                  const bx = x0 + k * (BAR + GAP);
                  const top = y(Math.max(0, b.value));
                  return (
                    <g key={b.key}>
                      <rect x={bx} y={top} width={BAR} height={Math.max(0, TOP + PLOT - top)} fill={COLORS[b.key]} rx="2">
                        <title>{`${it.name}\n${b.name}: Rp ${fmtNum(b.value, 2)}`}</title>
                      </rect>
                      <text x={bx + BAR / 2} y={top - 5} textAnchor="middle" fontSize="10" fill="#334155">
                        {compact(b.value)}
                      </text>
                    </g>
                  );
                })}

                <text textAnchor="middle" fontSize="12" fill="#0F172A" fontWeight="600">
                  {lines.map((l, n) => (
                    <tspan key={n} x={cx} y={TOP + PLOT + 20 + n * 15}>
                      {l}
                    </tspan>
                  ))}
                </text>
                <text x={cx} y={TOP + PLOT + 20 + 3 * 15 + 6} textAnchor="middle" fontSize="11" fill="#64748B">
                  {it.pct === null ? 'Target -' : `Target ${fmtNum(it.pct, 2)}%`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}