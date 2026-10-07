import type { ReactNode } from 'react';
import { formulaTokens } from '../chem/formula';

export function Bezel({ children, className = '', tight = false }: { children: ReactNode; className?: string; tight?: boolean }) {
  return (
    <section className={`bezel ${tight ? 'tight' : ''} ${className}`}>
      <div className="core">{children}</div>
    </section>
  );
}

export function Formula({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {formulaTokens(text).map((t, i) =>
        t.kind === 'sub' ? <sub key={i}>{t.text}</sub> : t.kind === 'sup' ? <sup key={i}>{t.text}</sup> : <span key={i}>{t.text}</span>,
      )}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden />
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="mono">{display}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function signed(n: number, digits = 1): string {
  const s = fmt(Math.abs(n), digits);
  return (n < 0 ? '−' : n > 0 ? '+' : '') + s;
}

/** Scientific notation with a real superscript, e.g. 1.2 × 10⁴⁵ */
export function Sci({ value }: { value: number }) {
  if (!Number.isFinite(value)) return <>{value > 0 ? '> 10³⁰⁰' : '—'}</>;
  if (value === 0) return <>&lt; 10⁻³⁰⁰</>;
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 3) return <>{fmt(value, exp < 0 ? 3 : 2)}</>;
  const mant = value / 10 ** exp;
  return (
    <>
      {mant.toFixed(2)} × 10<sup>{exp < 0 ? '−' + Math.abs(exp) : exp}</sup>
    </>
  );
}
