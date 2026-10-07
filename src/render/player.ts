import type { Mechanism } from '../chem/mechanism';
import { energyProfile } from '../chem/thermo';
import type { Vec3 } from '../chem/types';
import type { SceneBond, SceneFrame } from './stage';

/* Timeline of the reaction animation, t ∈ [0, 1]. */
export const PHASES = [
  { until: 0.18, label: 'Reactants approach' },
  { until: 0.42, label: 'Collision · old bonds stretch' },
  { until: 0.56, label: 'Activated complex ‡' },
  { until: 0.74, label: 'New bonds form' },
  { until: 1.0, label: 'Products separate' },
] as const;

export function phaseAt(t: number): string {
  return (PHASES.find((p) => t <= p.until) ?? PHASES[PHASES.length - 1]).label;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeInOutQuint = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
};
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Map animation time to the reaction coordinate used by the energy profile. */
export function reactionCoordinate(t: number): number {
  if (t < 0.18) return (t / 0.18) * 0.15;
  if (t < 0.74) return 0.15 + ((t - 0.18) / 0.56) * 0.7;
  return 0.85 + ((t - 0.74) / 0.26) * 0.15;
}

function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function mechanismFrame(m: Mechanism, t: number, clock: number, ea: number, dH: number): SceneFrame {
  const n = m.elements.length;
  const s = reactionCoordinate(t);
  const e = energyProfile(s, ea, dH);
  const peak = Math.max(ea, Math.abs(dH), 1);
  const excitation = Math.max(0, e) / peak;
  const amp = 0.035 + 0.12 * excitation;
  const atoms = new Array(n);
  for (let i = 0; i < n; i++) {
    // the activated complex sits part-way between the colliding reactants and the products
    const complex = lerp3(m.contact[i], m.formed[i], 0.42);
    const lag = hash(i) * 0.3;
    let p: Vec3;
    if (t < 0.18) p = lerp3(m.start[i], m.contact[i], easeInOutQuint(t / 0.18));
    else if (t < 0.42) p = lerp3(m.contact[i], complex, smooth(((t - 0.18) / 0.24 - lag * 0.5) / (1 - lag * 0.5)));
    else if (t < 0.56) p = complex;
    else if (t < 0.74) p = lerp3(complex, m.formed[i], easeInOutQuint(((t - 0.56) / 0.18 - lag * 0.4) / (1 - lag * 0.4)));
    else if (t < 0.82) p = m.formed[i];
    else p = lerp3(m.formed[i], m.end[i], easeInOutQuint((t - 0.82) / 0.18));
    const ph = hash(i + 17) * Math.PI * 2;
    const f = 9 + hash(i + 3) * 6;
    p = [
      p[0] + Math.sin(clock * f + ph) * amp,
      p[1] + Math.sin(clock * f * 1.13 + ph * 1.7) * amp,
      p[2] + Math.sin(clock * f * 0.87 + ph * 2.3) * amp,
    ];
    atoms[i] = { el: m.elements[i], pos: p, charge: m.charges[i] };
  }
  const bonds: SceneBond[] = [];
  for (const b of m.bonds) {
    if (b.from !== null && b.to !== null) {
      bonds.push({ a: b.a, b: b.b, order: t < 0.6 ? b.from : b.to, strength: 1 });
    } else if (b.from !== null) {
      // breaking: thins out while the atoms pull apart; a ghost remains through the activated complex
      const strength = 1 - 0.75 * smooth((t - 0.22) / 0.2) - 0.25 * smooth((t - 0.56) / 0.1);
      if (strength > 0.02) bonds.push({ a: b.a, b: b.b, order: b.from, strength });
    } else if (b.to !== null) {
      // forming: a faint partial bond appears in the complex, then strengthens
      const strength = 0.3 * smooth((t - 0.38) / 0.1) + 0.7 * smooth((t - 0.56) / 0.16);
      if (strength > 0.02) bonds.push({ a: b.a, b: b.b, order: b.to, strength });
    }
  }
  const glow = Math.exp(-(((s - 0.5) / 0.085) ** 2)) * Math.min(1, 0.35 + ea / 250);
  return { atoms, bonds, glow };
}
