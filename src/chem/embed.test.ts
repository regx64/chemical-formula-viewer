import { describe, expect, it } from 'vitest';
import { parseSmiles } from './smiles';
import { embed, idealBondLength } from './embed';
import { angleDeg, dist } from './geometry';
import type { Molecule, Vec3 } from './types';

const p = (m: Molecule, i: number): Vec3 => [m.atoms[i].x, m.atoms[i].y, m.atoms[i].z];

function maxBondError(m: Molecule): number {
  let worst = 0;
  for (const b of m.bonds) {
    const d = dist(p(m, b.a), p(m, b.b));
    worst = Math.max(worst, Math.abs(d - idealBondLength(m.atoms[b.a].el, m.atoms[b.b].el, b.order)));
  }
  return worst;
}

function anglesAround(m: Molecule, center: number): number[] {
  const nbs = m.bonds.filter((b) => b.a === center || b.b === center).map((b) => (b.a === center ? b.b : b.a));
  const out: number[] = [];
  for (let i = 0; i < nbs.length; i++)
    for (let j = i + 1; j < nbs.length; j++) out.push(angleDeg(p(m, nbs[i]), p(m, center), p(m, nbs[j])));
  return out.sort((a, b) => a - b);
}

describe('embed', () => {
  it('methane is tetrahedral', () => {
    const m = embed(parseSmiles('C'));
    for (const a of anglesAround(m, 0)) expect(a).toBeCloseTo(109.47, 0);
  });
  it('water is bent at ~104.5°', () => {
    const m = embed(parseSmiles('O'));
    expect(anglesAround(m, 0)[0]).toBeCloseTo(104.5, 0);
  });
  it('CO2 is linear', () => {
    const m = embed(parseSmiles('O=C=O'));
    expect(anglesAround(m, 1)[0]).toBeGreaterThan(178);
  });
  it('XeF4 is square planar', () => {
    const m = embed(parseSmiles('F[Xe](F)(F)F'));
    const a = anglesAround(m, 1);
    expect(a.slice(0, 4).every((x) => Math.abs(x - 90) < 2)).toBe(true);
    expect(a.slice(4).every((x) => Math.abs(x - 180) < 2)).toBe(true);
  });
  it('SF6 is octahedral', () => {
    const m = embed(parseSmiles('FS(F)(F)(F)(F)F'));
    const a = anglesAround(m, 1);
    expect(a.filter((x) => Math.abs(x - 90) < 2)).toHaveLength(12);
    expect(a.filter((x) => Math.abs(x - 180) < 2)).toHaveLength(3);
  });
  it('benzene is planar with regular bonds', () => {
    const m = embed(parseSmiles('c1ccccc1'));
    expect(maxBondError(m)).toBeLessThan(0.03);
    const zs = m.atoms.map((a) => Math.abs(a.z));
    expect(Math.max(...zs)).toBeLessThan(0.05);
  });
  it('caffeine and cholesterol embed with small bond errors', () => {
    for (const s of [
      'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
      'CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C',
    ]) {
      const m = embed(parseSmiles(s));
      expect(maxBondError(m)).toBeLessThan(0.08);
    }
  });
});
