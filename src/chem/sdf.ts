import type { Atom, Bond, Molecule } from './types';

const CHARGE_CODES: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

/** Parse the first record of a V2000 MDL molfile / SDF. */
export function parseSdf(text: string): Molecule {
  const lines = text.replace(/\r/g, '').split('\n');
  const counts = lines[3];
  if (!counts || !/V2000/.test(counts)) throw new Error('Only V2000 molfiles are supported');
  const nAtoms = Number(counts.slice(0, 3));
  const nBonds = Number(counts.slice(3, 6));
  const atoms: Atom[] = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i];
    const x = Number(l.slice(0, 10));
    const y = Number(l.slice(10, 20));
    const z = Number(l.slice(20, 30));
    const el = l.slice(31, 34).trim();
    const code = Number(l.slice(36, 39)) || 0;
    atoms.push({ el, x, y, z, charge: CHARGE_CODES[code] ?? 0 });
  }
  const bonds: Bond[] = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i];
    const a = Number(l.slice(0, 3)) - 1;
    const b = Number(l.slice(3, 6)) - 1;
    const t = Number(l.slice(6, 9));
    bonds.push({ a, b, order: t === 4 ? 1.5 : t >= 1 && t <= 3 ? t : 1 });
  }
  for (let i = 4 + nAtoms + nBonds; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('M  END')) break;
    if (l.startsWith('M  CHG')) {
      const parts = l.slice(6).trim().split(/\s+/).map(Number);
      for (let k = 1; k + 1 < parts.length; k += 2) atoms[parts[k] - 1].charge = parts[k + 1];
    }
  }
  return { atoms, bonds };
}

/** True when every atom has z ≈ 0 (a 2D depiction rather than a conformer). */
export function isFlat(mol: Molecule): boolean {
  return mol.atoms.every((a) => Math.abs(a.z) < 1e-4);
}
