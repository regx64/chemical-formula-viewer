import { describe, expect, it } from 'vitest';
import { REACTION_PRESETS } from '../data/reactions';
import { balance, nullSpace } from './balance';
import { splitSpecies } from './equation';
import { parseFormula } from './formula';
import { hungarian } from './mechanism';
import { buildReaction } from './reaction';

const b = (r: string[], p: string[]) => {
  const f = (s: string) => {
    const x = parseFormula(s);
    return { composition: x.composition, charge: x.charge };
  };
  return balance(r.map(f), p.map(f));
};

describe('balance', () => {
  it('balances classic equations', () => {
    expect(b(['CH4', 'O2'], ['CO2', 'H2O'])).toEqual({ ok: true, coefficients: [1, 2, 1, 2] });
    expect(b(['C8H18', 'O2'], ['CO2', 'H2O'])).toEqual({ ok: true, coefficients: [2, 25, 16, 18] });
    expect(b(['Fe2O3', 'Al'], ['Al2O3', 'Fe'])).toEqual({ ok: true, coefficients: [1, 2, 1, 2] });
    expect(b(['KMnO4', 'HCl'], ['KCl', 'MnCl2', 'H2O', 'Cl2'])).toEqual({ ok: true, coefficients: [2, 16, 2, 2, 8, 5] });
    expect(b(['Cu', 'NO3^-', 'H^+'], ['Cu^2+', 'NO', 'H2O'])).toEqual({ ok: true, coefficients: [3, 2, 8, 3, 2, 4] });
  });
  it('rejects impossible equations', () => {
    expect(b(['H2'], ['O2']).ok).toBe(false);
  });
  it('null space of a simple matrix', () => {
    expect(nullSpace([[1, -1]])).toEqual([[1n, 1n]]);
  });
});

describe('splitSpecies', () => {
  it('handles charges and compact input', () => {
    expect(splitSpecies('NH4+ + OH-')).toEqual(['NH4+', 'OH-']);
    expect(splitSpecies('H2+O2')).toEqual(['H2', 'O2']);
    expect(splitSpecies('NH4++OH-')).toEqual(['NH4+', 'OH-']);
  });
});

describe('hungarian', () => {
  it('finds the optimal assignment', () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
  });
});

describe('buildReaction', () => {
  it('predicts and balances combustion with formation-enthalpy thermodynamics', () => {
    const r = buildReaction('CH4 + O2');
    if (!r.ok) throw new Error(r.error);
    expect(r.reaction.predicted).toBe(true);
    expect(r.reaction.products.map((p) => p.text)).toEqual(['CO2', 'H2O']);
    expect(r.reaction.thermo.method).toBe('formation');
    expect(r.reaction.thermo.dH).toBeCloseTo(-890.3, 0);
    expect(r.reaction.mechanism?.elements).toHaveLength(9);
  });
  it('neutralisation enthalpy is about −55.8 kJ', () => {
    const r = buildReaction('HCl(aq) + NaOH(aq) -> NaCl(aq) + H2O(l)');
    if (!r.ok) throw new Error(r.error);
    expect(r.reaction.thermo.dH).toBeCloseTo(-55.8, 0);
  });
  it.each([
    ['Zn + HCl', ['ZnCl2', 'H2']],
    ['Na + H2O', ['NaOH', 'H2']],
    ['AgNO3 + NaCl', ['NaNO3', 'AgCl']],
    ['CaCO3', ['CaO', 'CO2']],
    ['Mg + O2', ['MgO']],
    ['H2SO4 + NaOH', ['Na2SO4', 'H2O']],
    ['Zn + CuSO4', ['ZnSO4', 'Cu']],
    ['Cl2 + NaBr', ['NaCl', 'Br2']],
    ['HCl + CaCO3', ['CaCl2', 'H2O', 'CO2']],
    ['N2 + H2', ['NH3']],
    ['ethanol + oxygen', ['CO2', 'H2O']],
  ])('predicts %s', (input, expected) => {
    const r = buildReaction(input);
    if (!r.ok) throw new Error(r.error);
    expect(r.reaction.products.map((p) => p.text).sort()).toEqual([...expected].sort());
  });
  it('reports no reaction for copper in HCl', () => {
    const r = buildReaction('Cu + HCl');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.noReaction).toBe(true);
  });
  it('flags wrong user coefficients', () => {
    const r = buildReaction('H2 + O2 -> 2H2O');
    if (!r.ok) throw new Error(r.error);
    expect(r.reaction.rebalanced).toBe(true);
    expect(r.reaction.reactants.map((s) => s.coefficient)).toEqual([2, 1]);
  });
  it.each(REACTION_PRESETS.map((p) => [p.title, p.equation]))('preset %s builds with a mechanism', (_t, eq) => {
    const r = buildReaction(eq);
    if (!r.ok) throw new Error(r.error);
    expect(r.reaction.mechanism).not.toBeNull();
    expect(r.reaction.thermo.method).not.toBe('none');
  });
});
