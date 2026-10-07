import { useState } from 'react';
import { energyProfile } from '../../chem/thermo';
import { signed } from '../primitives';
import { useWidth } from '../useWidth';

const H = 210;
const M = { top: 22, right: 16, bottom: 30, left: 44 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function EnergyChart({ ea, dH, s, catalystEa }: { ea: number; dH: number; s: number; catalystEa?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const iw = width - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const lo = Math.min(0, dH);
  const hi = Math.max(ea, dH, 0);
  const pad = (hi - lo) * 0.12 || 10;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const x = (u: number) => M.left + u * iw;
  const y = (e: number) => M.top + ih - ((e - y0) / (y1 - y0)) * ih;
  const path = (barrier: number) => {
    let d = '';
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      d += `${i ? 'L' : 'M'}${x(u).toFixed(1)},${y(energyProfile(u, barrier, dH)).toFixed(1)}`;
    }
    return d;
  };
  const ticks = niceTicks(y0, y1);
  const eNow = energyProfile(s, ea, dH);
  const hoverE = hover !== null ? energyProfile(hover, ea, dH) : 0;
  const hoverCat = hover !== null && catalystEa !== undefined ? energyProfile(hover, catalystEa, dH) : null;

  return (
    <div className="chart" ref={ref}>
      {catalystEa !== undefined && (
        <div className="chart-legend">
          <span>
            <i style={{ background: 'var(--accent)' }} /> Uncatalysed
          </span>
          <span>
            <i style={{ background: 'var(--violet)' }} /> Catalysed (Eₐ × 0.55)
          </span>
        </div>
      )}
      <svg
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label={`Energy profile: activation energy ${Math.round(ea)} kJ/mol, enthalpy change ${Math.round(dH)} kJ/mol`}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const u = (e.clientX - r.left - M.left) / iw;
          setHover(u >= 0 && u <= 1 ? u : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} className="tick" x={M.left - 8} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        ))}
        <text className="tick" x={M.left} y={H - 8}>
          Reaction coordinate →
        </text>
        <text className="tick" x={M.left - 38} y={M.top - 10}>
          kJ/mol
        </text>
        {/* reactant / product levels */}
        <line x1={x(0)} x2={x(0.62)} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 4" />
        <line x1={x(0.4)} x2={x(1)} y1={y(dH)} y2={y(dH)} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 4" />
        {catalystEa !== undefined && <path d={path(catalystEa)} fill="none" stroke="var(--violet)" strokeWidth={2} strokeDasharray="5 4" />}
        <path d={path(ea)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {/* Eₐ: dashed TS level + arrow on the left shoulder, label in the free space above the reactant plateau */}
        <line x1={x(0.24)} x2={x(0.5)} y1={y(ea)} y2={y(ea)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" />
        <line x1={x(0.26)} x2={x(0.26)} y1={y(0) - 2} y2={y(ea) + 7} stroke="var(--text-3)" markerEnd="url(#arrow)" />
        <text x={x(0.26) - 6} y={(y(0) + y(ea)) / 2 + 4} fill="var(--text-2)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="end">
          Eₐ {Math.round(ea)}
        </text>
        {/* ΔH: reactant level carried across, arrow down/up to the products */}
        <line x1={x(0.62)} x2={x(0.95)} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" />
        {Math.abs(y(dH) - y(0)) > 14 && (
          <line x1={x(0.93)} x2={x(0.93)} y1={y(0) + (dH < 0 ? 2 : -2)} y2={y(dH) + (dH < 0 ? -7 : 7)} stroke="var(--text-3)" markerEnd="url(#arrow)" />
        )}
        <text x={x(0.91)} y={(y(0) + y(dH)) / 2 + 4} fill="var(--text-2)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="end">
          ΔH {signed(dH, 0)}
        </text>
        <text x={x(0.01)} y={y(0) + (dH < 0 ? 16 : -8)} fill="var(--text-3)" fontSize="10.5">
          Reactants
        </text>
        <text x={x(0.99)} y={y(dH) + (dH < 0 ? 16 : -8)} fill="var(--text-3)" fontSize="10.5" textAnchor="end">
          Products
        </text>
        <text x={x(0.5)} y={y(ea) - 9} fill="var(--text-3)" fontSize="10.5" textAnchor="middle">
          Transition state ‡
        </text>
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--text-3)" />
          </marker>
          <radialGradient id="dotglow">
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#6ef0d4" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* playhead */}
        <circle cx={x(s)} cy={y(eNow)} r={12} fill="url(#dotglow)" opacity={0.6} />
        <circle cx={x(s)} cy={y(eNow)} r={5} fill="#fff" stroke="var(--core)" strokeWidth={2} />
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="rgba(255,255,255,0.25)" />
            <circle cx={x(hover)} cy={y(hoverE)} r={4} fill="var(--accent)" stroke="var(--core)" strokeWidth={2} />
          </g>
        )}
        <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" />
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(x(hover) + 10, width - 170), top: 10 }}>
          <div className="row">
            <span>Energy vs reactants</span>
            <span className="mono">{signed(hoverE, 0)} kJ/mol</span>
          </div>
          {hoverCat !== null && (
            <div className="row">
              <span>Catalysed</span>
              <span className="mono">{signed(hoverCat, 0)} kJ/mol</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
