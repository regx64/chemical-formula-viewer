import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../data/library';
import { hillFormula } from './formula';
import { isError, libraryMolecule, resolveOffline, type Resolved } from './resolve';
import { buildFromComposition } from './builder';
import { parseSmiles } from './smiles';
import { parseFormula } from './formula';

const ok = (q: string): Resolved => {
  const r = resolveOffline(q, { allowGenerated: true });
  if (!r || isError(r)) throw new Error(`failed: ${q} ${JSON.stringify(r)}`);
  return r;
};

describe('resolveOffline', () => {
  it('finds library entries by name, alias and formula', () => {
    expect(ok('water').name).toBe('Water');
    expect(ok('H2O').name).toBe('Water');
    expect(ok('C2H6O').name).toBe('Ethanol');
    expect(ok('C2H6O').alternatives.map((a) => a.label)).toContain('Dimethyl ether');
    expect(ok('C60').name).toBe('Buckminsterfullerene');
    expect(ok('NaCl').name).toBe('Sodium chloride');
    expect(ok('table salt').name).toBe('Sodium chloride');
  });
  it('treats SMILES-looking strings as SMILES', () => {
    expect(hillFormula(ok('CCO').composition)).toBe('C2H6O');
    expect(hillFormula(ok('c1ccncc1').composition)).toBe('C5H5N');
    expect(ok('CO').name).toBe('Carbon monoxide');
  });
  it('returns null for unknown names (to be tried online)', () => {
    expect(resolveOffline('morphine', { allowGenerated: true })).toBeNull();
  });
  it('generates structures for unknown formulas', () => {
    const r = ok('C5H12O');
    expect(r.source).toBe('generated');
    expect(hillFormula(r.composition)).toBe('C5H12O');
  });
  it('embeds every library entry', () => {
    for (const e of LIBRARY) {
      const m = libraryMolecule(e);
      expect(m.atoms.length).toBeGreaterThan(0);
      for (const a of m.atoms) expect(Number.isFinite(a.x + a.y + a.z)).toBe(true);
    }
  });
});

describe('buildFromComposition', () => {
  const cases: [string, number?][] = [
    ['C2H6O'], ['C6H6'], ['C6H12O6'], ['H2SO4'], ['SO2'], ['HNO3'], ['CH2O'], ['C2H2'], ['CCl4'],
    ['C8H18'], ['C3H6'], ['S8'], ['N2O'], ['HClO4'], ['PCl5'], ['XeF4'], ['C4H10'], ['C3H8O3'], ['C2H4O2'],
    ['HCN'], ['N2H4'], ['H2O2'], ['C7H8'], ['CH5N'], ['H3PO4'],
  ];
  it.each(cases)('builds a closed-shell structure for %s', (f) => {
    const p = parseFormula(f);
    const built = buildFromComposition(p.composition, p.charge, parseSmiles);
    expect(built.kind).toBe('covalent');
    expect(built.defects).toBe(0);
    const comp: Record<string, number> = {};
    for (const a of built.mol.atoms) comp[a.el] = (comp[a.el] ?? 0) + 1;
    expect(comp).toEqual(p.composition);
  });
  it.each(['CaCO3', 'Ca(OH)2', 'Fe2O3', 'MgCl2', 'Na2SO4', 'NH4NO3', 'KMnO4', 'AgNO3', 'Al2(SO4)3'])(
    'recognises ionic %s',
    (f) => {
      const p = parseFormula(f);
      const built = buildFromComposition(p.composition, p.charge, parseSmiles);
      expect(built.kind).toBe('ionic');
      const net = built.mol.atoms.reduce((s, a) => s + a.charge, 0);
      expect(net).toBe(0);
    },
  );
  it('builds metal clusters and ions', () => {
    expect(buildFromComposition({ Fe: 1 }, 0, parseSmiles).kind).toBe('metal');
    const so4 = parseFormula('SO4^2-');
    const b = buildFromComposition(so4.composition, so4.charge, parseSmiles);
    expect(b.defects).toBe(0);
  });
});
