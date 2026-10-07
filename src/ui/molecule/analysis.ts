import { ELEMENT_BY_SYMBOL } from '../../chem/elements';
import { adjacency, atomGeometry } from '../../chem/embed';
import { molarMass, type Composition } from '../../chem/formula';
import { angleDeg, dihedralDeg, dist } from '../../chem/geometry';
import type { Molecule, Vec3 } from '../../chem/types';

const VSEPR: Record<string, string> = {
  '2-0': 'Linear',
  '2-1': 'Bent',
  '2-2': 'Bent',
  '2-3': 'Linear',
  '3-0': 'Trigonal planar',
  '3-1': 'Trigonal pyramidal',
  '3-2': 'T-shaped',
  '4-0': 'Tetrahedral',
  '4-1': 'Seesaw',
  '4-2': 'Square planar',
  '5-0': 'Trigonal bipyramidal',
  '5-1': 'Square pyramidal',
  '6-0': 'Octahedral',
  '7-0': 'Pentagonal bipyramidal',
};

export interface Shape {
  center: string;
  axe: string;
  name: string;
  angle: number;
}

/** VSEPR classification for small molecules with a single central atom. */
export function vseprShape(mol: Molecule): Shape | null {
  if (mol.atoms.length > 9 || mol.atoms.length < 3) return null;
  if (mol.bonds.some((b) => b.order === 0)) return null;
  const adj = adjacency(mol);
  const centers = adj.map((n, i) => ({ i, k: n.length })).filter((c) => c.k >= 2);
  if (centers.length !== 1) return null;
  const c = centers[0].i;
  const g = atomGeometry(mol, adj, c);
  const k = adj[c].length;
  const name = VSEPR[`${k}-${g.lp}`];
  if (!name) return null;
  const p = (i: number): Vec3 => [mol.atoms[i].x, mol.atoms[i].y, mol.atoms[i].z];
  let angle = 180;
  for (let x = 0; x < k; x++)
    for (let y = x + 1; y < k; y++) angle = Math.min(angle, angleDeg(p(adj[c][x].atom), p(c), p(adj[c][y].atom)));
  return { center: mol.atoms[c].el, axe: `AX${k > 1 ? k : ''}${g.lp ? 'E' + (g.lp > 1 ? g.lp : '') : ''}`, name, angle };
}

export function degreeOfUnsaturation(comp: Composition): number | null {
  const C = comp.C ?? 0;
  if (!C) return null;
  const known = new Set(['C', 'H', 'N', 'O', 'S', 'F', 'Cl', 'Br', 'I', 'P']);
  if (Object.keys(comp).some((e) => !known.has(e))) return null;
  const X = (comp.F ?? 0) + (comp.Cl ?? 0) + (comp.Br ?? 0) + (comp.I ?? 0);
  const v = C - ((comp.H ?? 0) + X) / 2 + ((comp.N ?? 0) + (comp.P ?? 0)) / 2 + 1;
  return v >= 0 && Number.isInteger(v * 2) ? v : null;
}

export function massPercent(comp: Composition): { el: string; count: number; pct: number }[] {
  const total = molarMass(comp);
  return Object.entries(comp)
    .map(([el, count]) => ({ el, count, pct: (100 * ELEMENT_BY_SYMBOL[el].mass * count) / total }))
    .sort((a, b) => b.pct - a.pct);
}

export interface Measurement {
  label: string;
  value: string;
}

export function measure(mol: Molecule, sel: number[]): Measurement[] {
  const p = (i: number): Vec3 => [mol.atoms[i].x, mol.atoms[i].y, mol.atoms[i].z];
  const name = (i: number) => `${mol.atoms[i].el}${i + 1}`;
  const out: Measurement[] = [];
  if (sel.length >= 2) out.push({ label: `Distance ${name(sel[0])}–${name(sel[1])}`, value: `${dist(p(sel[0]), p(sel[1])).toFixed(3)} Å` });
  if (sel.length >= 3)
    out.push({ label: `Angle ${name(sel[0])}–${name(sel[1])}–${name(sel[2])}`, value: `${angleDeg(p(sel[0]), p(sel[1]), p(sel[2])).toFixed(1)}°` });
  if (sel.length >= 4)
    out.push({
      label: `Dihedral ${sel.map(name).join('–')}`,
      value: `${dihedralDeg(p(sel[0]), p(sel[1]), p(sel[2]), p(sel[3])).toFixed(1)}°`,
    });
  return out;
}

export function boundingRadius(mol: Molecule): number {
  let r = 0;
  for (const a of mol.atoms) r = Math.max(r, Math.hypot(a.x, a.y, a.z) + (ELEMENT_BY_SYMBOL[a.el]?.vdw ?? 1.8) * 0.6);
  return r;
}
