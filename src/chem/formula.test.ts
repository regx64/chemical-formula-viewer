import { describe, expect, it } from 'vitest';
import { formulaTokens, hillFormula, molarMass, parseFormula } from './formula';
import { parseSmiles } from './smiles';
import { compositionOf } from './resolve';

describe('parseFormula', () => {
  it('handles groups, hydrates and charges', () => {
    expect(parseFormula('Ca(OH)2').composition).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(parseFormula('CuSO4·5H2O').composition).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(parseFormula('K4[Fe(CN)6]').composition).toEqual({ K: 4, Fe: 1, C: 6, N: 6 });
    expect(parseFormula('SO4^2-')).toMatchObject({ composition: { S: 1, O: 4 }, charge: -2 });
    expect(parseFormula('NH4+')).toMatchObject({ composition: { N: 1, H: 4 }, charge: 1 });
    expect(parseFormula('H₂O').composition).toEqual({ H: 2, O: 1 });
    expect(parseFormula('SO₄²⁻').charge).toBe(-2);
    expect(parseFormula('NaCl(aq)').state).toBe('aq');
  });
  it('rejects nonsense', () => {
    expect(() => parseFormula('Xy2')).toThrow();
    expect(() => parseFormula('Ca(OH')).toThrow();
    expect(() => parseFormula('water')).toThrow();
  });
  it('computes molar mass and Hill formula', () => {
    expect(molarMass(parseFormula('H2O').composition)).toBeCloseTo(18.015, 2);
    expect(molarMass(parseFormula('C6H12O6').composition)).toBeCloseTo(180.156, 1);
    expect(hillFormula(parseFormula('CH3CH2OH').composition)).toBe('C2H6O');
    expect(hillFormula(parseFormula('NaCl').composition)).toBe('ClNa');
  });
  it('tokenizes for display', () => {
    expect(formulaTokens('H2SO4')).toEqual([
      { text: 'H', kind: 'normal' },
      { text: '2', kind: 'sub' },
      { text: 'SO', kind: 'normal' },
      { text: '4', kind: 'sub' },
    ]);
    expect(formulaTokens('SO4^2-').at(-1)).toEqual({ text: '2−', kind: 'sup' });
    expect(formulaTokens('2H2O')[0]).toEqual({ text: '2H', kind: 'normal' });
  });
});

describe('parseSmiles', () => {
  const formula = (s: string) => {
    const { composition, charge } = compositionOf(parseSmiles(s));
    return hillFormula(composition, charge);
  };
  it('adds implicit hydrogens', () => {
    expect(formula('CCO')).toBe('C2H6O');
    expect(formula('c1ccccc1')).toBe('C6H6');
    expect(formula('CN1C=NC2=C1C(=O)N(C(=O)N2C)C')).toBe('C8H10N4O2');
    expect(formula('CC(=O)Oc1ccccc1C(=O)O')).toBe('C9H8O4');
    expect(formula('c1ccncc1')).toBe('C5H5N');
    expect(formula('Nc1ncnc2[nH]cnc12')).toBe('C5H5N5');
    expect(formula('[NH4+]')).toBe('H4N^+');
    expect(formula('[O-]S(=O)(=O)[O-]')).toBe('O4S^2-');
    expect(formula('OS(=O)(=O)O')).toBe('H2O4S');
  });
  it('rejects malformed input', () => {
    expect(() => parseSmiles('C1CC')).toThrow();
    expect(() => parseSmiles('C(C')).toThrow();
  });
});
