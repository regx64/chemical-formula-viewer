import { useState } from 'react';
import type { Sample } from '../../chem/kinetics';
import { useWidth } from '../useWidth';

const H = 170;
const M = { top: 10, right: 64, bottom: 24, left: 34 };

export interface Series {
  label: string;
  color: string;
}

export function ConcentrationChart({ history, series }: { history: Sample[]; series: Series[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const tMax = Math.max(10, history.length ? history[history.length - 1].t : 0);
  const tMin = history.length ? history[0].t : 0;
  const cMax = Math.max(4, ...history.flatMap((h) => h.counts));
  const x = (t: number) => M.left + ((t - tMin) / Math.max(1e-6, tMax - tMin)) * iw;
  const y = (c: number) => M.top + ih - (c / cMax) * ih;
  const yTicks = [0, Math.round(cMax / 2), cMax];
  const last = history[history.length - 1];
  const hovered = hover !== null ? history[hover] : null;
  // direct labels at line ends (≤ 4 series), nudged apart to avoid collisions
  const labelYs = last
    ? series
        .map((_s, i) => ({ i, y: y(last.counts[i]) }))
        .sort((a, b) => a.y - b.y)
        .reduce<{ i: number; y: number }[]>((acc, cur) => {
          const prev = acc[acc.length - 1];
          acc.push({ i: cur.i, y: prev && cur.y - prev.y < 12 ? prev.y + 12 : cur.y });
          return acc;
        }, [])
    : [];

  return (
    <div className="chart" ref={ref}>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <svg
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label="Molecule counts over time"
        onMouseMove={(e) => {
          if (!history.length) return;
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const t = tMin + ((e.clientX - r.left - M.left) / iw) * (tMax - tMin);
          let best = 0;
          for (let i = 0; i < history.length; i++) if (Math.abs(history[i].t - t) < Math.abs(history[best].t - t)) best = i;
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <g className="grid">
          {yTicks.map((t) => (
            <line key={t} x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {yTicks.map((t) => (
          <text key={t} className="tick" x={M.left - 6} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        ))}
        <text className="tick" x={M.left} y={H - 6}>
          {tMin.toFixed(0)} s
        </text>
        <text className="tick" x={M.left + iw} y={H - 6} textAnchor="end">
          {tMax.toFixed(0)} s
        </text>
        {series.map((s, i) => (
          <path
            key={s.label}
            d={history.map((h, k) => `${k ? 'L' : 'M'}${x(h.t).toFixed(1)},${y(h.counts[i]).toFixed(1)}`).join('')}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {last &&
          series.length <= 4 &&
          labelYs.map(({ i, y: ly }) => (
            <text key={i} x={x(last.t) + 6} y={ly + 3} fill="var(--text-2)" fontSize="10.5" fontFamily="var(--font-mono)">
              {series[i].label.length > 8 ? series[i].label.slice(0, 7) + '…' : series[i].label}
            </text>
          ))}
        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hovered.t)} x2={x(hovered.t)} y1={M.top} y2={M.top + ih} stroke="rgba(255,255,255,0.25)" />
            {series.map((s, i) => (
              <circle key={s.label} cx={x(hovered.t)} cy={y(hovered.counts[i])} r={4} fill={s.color} stroke="var(--core)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hovered && (
        <div className="chart-tip" style={{ left: Math.min(x(hovered.t) + 12, width - 160), top: 30 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <span>t = {hovered.t.toFixed(1)} s</span>
          </div>
          {series.map((s, i) => (
            <div className="row" key={s.label}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <i style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="mono">{hovered.counts[i]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
