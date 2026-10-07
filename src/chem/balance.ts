import type { Composition } from './formula';

/* Exact rational linear algebra (BigInt) for balancing chemical equations. */

interface Frac {
  n: bigint;
  d: bigint;
}

const abs = (x: bigint) => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
const lcm = (a: bigint, b: bigint) => (a === 0n || b === 0n ? 0n : abs(a * b) / gcd(a, b));

function frac(n: bigint, d: bigint = 1n): Frac {
  if (d === 0n) throw new Error('division by zero');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const fsub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const fmul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const fdiv = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
const isZero = (a: Frac) => a.n === 0n;

/** Basis of the null space of an integer matrix (each vector rational → scaled to integers). */
export function nullSpace(matrix: number[][]): bigint[][] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const m: Frac[][] = matrix.map((r) => r.map((x) => frac(BigInt(x))));
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = r;
    while (p < rows && isZero(m[p][c])) p++;
    if (p === rows) continue;
    [m[r], m[p]] = [m[p], m[r]];
    const pv = m[r][c];
    for (let k = 0; k < cols; k++) m[r][k] = fdiv(m[r][k], pv);
    for (let i = 0; i < rows; i++) {
      if (i === r || isZero(m[i][c])) continue;
      const f = m[i][c];
      for (let k = 0; k < cols; k++) m[i][k] = fsub(m[i][k], fmul(f, m[r][k]));
    }
    pivots.push(c);
    r++;
  }
  const free = [...Array(cols).keys()].filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const v: Frac[] = Array.from({ length: cols }, () => frac(0n));
    v[f] = frac(1n);
    pivots.forEach((pc, i) => (v[pc] = frac(-m[i][f].n, m[i][f].d)));
    const L = v.reduce((acc, x) => lcm(acc, x.d), 1n);
    let ints = v.map((x) => (x.n * L) / x.d);
    const g = ints.reduce((acc, x) => gcd(acc, x), 0n) || 1n;
    ints = ints.map((x) => x / g);
    return ints;
  });
}

export interface BalanceInput {
  composition: Composition;
  charge: number;
}

export type BalanceResult =
  | { ok: true; coefficients: number[] }
  | { ok: false; reason: string };

/**
 * Smallest positive integer coefficients so that atoms and charge are conserved.
 * reactants come first, then products.
 */
export function balance(reactants: BalanceInput[], products: BalanceInput[]): BalanceResult {
  const species = [...reactants, ...products];
  const elements = [...new Set(species.flatMap((s) => Object.keys(s.composition)))];
  const sign = (i: number) => (i < reactants.length ? 1 : -1);
  for (const el of elements) {
    const onLeft = reactants.some((s) => s.composition[el]);
    const onRight = products.some((s) => s.composition[el]);
    if (onLeft !== onRight) {
      return { ok: false, reason: `${el} appears only on the ${onLeft ? 'reactant' : 'product'} side.` };
    }
  }
  const matrix = elements.map((el) => species.map((s, i) => (s.composition[el] ?? 0) * sign(i)));
  if (species.some((s) => s.charge)) matrix.push(species.map((s, i) => s.charge * sign(i)));
  const basis = nullSpace(matrix);
  if (!basis.length) return { ok: false, reason: 'No combination of coefficients conserves every atom.' };

  const positive = (v: bigint[]) => {
    if (v.every((x) => x < 0n)) v = v.map((x) => -x);
    return v.every((x) => x > 0n) ? v : null;
  };
  if (basis.length === 1) {
    const v = positive(basis[0]);
    if (!v) return { ok: false, reason: 'Balancing would require a species to switch sides.' };
    return { ok: true, coefficients: v.map(Number) };
  }
  // several independent reactions mixed together: search small positive combinations
  let best: bigint[] | null = null;
  let bestSum = Infinity;
  const k = basis.length;
  const limit = k > 3 ? 4 : 8;
  const coef = new Array(k).fill(-limit);
  const total = Math.pow(2 * limit + 1, k);
  for (let it = 0; it < total; it++) {
    let rem = it;
    for (let j = 0; j < k; j++) {
      coef[j] = (rem % (2 * limit + 1)) - limit;
      rem = Math.floor(rem / (2 * limit + 1));
    }
    const v = basis[0].map((_, idx) => basis.reduce((s, b, j) => s + b[idx] * BigInt(coef[j]), 0n));
    if (!v.every((x) => x > 0n)) continue;
    const g = v.reduce((a, x) => gcd(a, x), 0n);
    const reduced = v.map((x) => x / g);
    const sum = reduced.reduce((a, x) => a + Number(x), 0);
    if (sum < bestSum) {
      bestSum = sum;
      best = reduced;
    }
  }
  if (!best) return { ok: false, reason: 'Could not find positive coefficients.' };
  return { ok: true, coefficients: best.map(Number) };
}
