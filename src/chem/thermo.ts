import { R, THERMO } from '../data/thermo';
import { hillFormula, type Composition, type Phase } from './formula';
import type { Molecule } from './types';

export interface ThermoSpecies {
  composition: Composition;
  charge: number;
  state?: Phase;
  coefficient: number;
  side: 'reactant' | 'product';
  molecule?: Molecule;
}

export interface ThermoResult {
  method: 'formation' | 'bond-enthalpy' | 'none';
  /** kJ per mole of reaction as written */
  dH?: number;
  /** J/(mol·K) */
  dS?: number;
  /** kJ/mol at T */
  dG?: number;
  K?: number;
  T: number;
  phases: (Phase | undefined)[];
  missing: string[];
}

export function lookupThermo(composition: Composition, charge: number, state?: Phase) {
  if (charge) return null;
  const entry = THERMO[hillFormula(composition)];
  if (!entry) return null;
  const phase = state && entry.phases[state] ? state : (Object.keys(entry.phases)[0] as Phase);
  const v = entry.phases[phase];
  if (!v) return null;
  return { name: entry.name, phase, dHf: v[0], S: v[1] };
}

/** Average bond enthalpies (kJ/mol), gas phase. Order 1.5 = aromatic. */
const BOND_ENERGY: Record<string, number> = {
  'H-H:1': 436, 'C-H:1': 413, 'C-C:1': 348, 'C-C:2': 614, 'C-C:3': 839, 'C-C:1.5': 518,
  'C-O:1': 358, 'C-O:2': 799, 'C-O:3': 1072, 'H-O:1': 463, 'O-O:1': 146, 'O-O:2': 498,
  'N-N:1': 163, 'N-N:2': 418, 'N-N:3': 945, 'H-N:1': 391, 'C-N:1': 293, 'C-N:2': 615, 'C-N:3': 891,
  'C-N:1.5': 508, 'N-O:1': 201, 'N-O:2': 607, 'H-S:1': 339, 'C-S:1': 259, 'S-S:1': 266, 'O-S:2': 523,
  'O-S:1': 265, 'Cl-H:1': 431, 'Cl-Cl:1': 242, 'C-Cl:1': 328, 'F-H:1': 567, 'F-F:1': 155, 'C-F:1': 485,
  'Br-H:1': 366, 'Br-Br:1': 193, 'C-Br:1': 276, 'H-I:1': 299, 'I-I:1': 151, 'C-I:1': 240,
  'H-P:1': 322, 'Cl-P:1': 326, 'O-P:1': 335, 'O-P:2': 544, 'O-Si:1': 452, 'H-Si:1': 318, 'C-Si:1': 301,
  'B-F:1': 646, 'B-H:1': 389, 'Cl-O:1': 203, 'F-O:1': 190, 'F-N:1': 272, 'Cl-N:1': 200, 'F-S:1': 327,
};

function bondKey(a: string, b: string, order: number): string {
  const [x, y] = [a, b].sort();
  return `${x}-${y}:${order}`;
}

export function moleculeBondEnthalpy(mol: Molecule): { total: number; missing: string[] } {
  let total = 0;
  const missing: string[] = [];
  for (const b of mol.bonds) {
    if (b.order === 0) {
      missing.push('ionic');
      continue;
    }
    const k = bondKey(mol.atoms[b.a].el, mol.atoms[b.b].el, b.order);
    const e = BOND_ENERGY[k];
    if (e === undefined) missing.push(k.replace(':1.5', ' (aromatic)').replace(/:(\d)/, ' (order $1)'));
    else total += e;
  }
  return { total, missing };
}

export function reactionThermo(species: ThermoSpecies[], T = 298.15): ThermoResult {
  const sign = (s: ThermoSpecies) => (s.side === 'reactant' ? -1 : 1);
  const looked = species.map((s) => lookupThermo(s.composition, s.charge, s.state));
  const phases = looked.map((l, i) => l?.phase ?? species[i].state);
  if (looked.every(Boolean)) {
    let dH = 0;
    let dS = 0;
    species.forEach((s, i) => {
      dH += sign(s) * s.coefficient * looked[i]!.dHf;
      dS += sign(s) * s.coefficient * looked[i]!.S;
    });
    const dG = dH - (T * dS) / 1000;
    const lnK = (-dG * 1000) / (R * T);
    return { method: 'formation', dH, dS, dG, K: Math.exp(Math.max(-700, Math.min(700, lnK))), T, phases, missing: [] };
  }
  // fall back to bond enthalpies when every species is a covalent molecule with known bond types
  const missing = new Set<string>();
  let broken = 0;
  let formed = 0;
  for (const s of species) {
    if (!s.molecule) {
      missing.add(hillFormula(s.composition, s.charge));
      continue;
    }
    const { total, missing: m } = moleculeBondEnthalpy(s.molecule);
    m.forEach((x) => missing.add(x));
    if (s.side === 'reactant') broken += s.coefficient * total;
    else formed += s.coefficient * total;
  }
  if (!missing.size) {
    return { method: 'bond-enthalpy', dH: broken - formed, T, phases, missing: [] };
  }
  return { method: 'none', T, phases, missing: [...missing] };
}

/**
 * Activation energy estimate (kJ/mol) when no literature value is supplied:
 * an Evans–Polanyi-style relation Ea ≈ E0 + α·ΔH, kept above the endothermic floor.
 */
export function estimateActivation(dH: number | undefined): number {
  const h = dH ?? 0;
  const ea = 75 + 0.3 * Math.max(-600, Math.min(600, h));
  return Math.max(Math.max(15, h + 15), Math.min(250, ea));
}

/** Smooth schematic potential-energy curve along the reaction coordinate s ∈ [0,1]. */
export function energyProfile(s: number, ea: number, dH: number): number {
  const ease = (u: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, u)))) / 2;
  if (s <= 0.15) return 0;
  if (s <= 0.5) return ea * ease((s - 0.15) / 0.35);
  if (s <= 0.85) return ea + (dH - ea) * ease((s - 0.5) / 0.35);
  return dH;
}
