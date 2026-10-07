import { REACTION_PRESETS, type ReactionPreset } from '../data/reactions';
import { balance } from './balance';
import { EquationError, parseEquation, parseSpecies, type SpeciesInput } from './equation';
import { compositionKey, molarMass, type Composition, type Phase } from './formula';
import { buildMechanism, type Mechanism } from './mechanism';
import { predictProducts } from './predict';
import { generated, isError, libraryByFormula, libraryMolecule } from './resolve';
import { estimateActivation, reactionThermo, type ThermoResult } from './thermo';
import type { Molecule } from './types';

export interface ReactionSpecies {
  text: string;
  name?: string;
  composition: Composition;
  charge: number;
  state?: Phase;
  coefficient: number;
  side: 'reactant' | 'product';
  molecule: Molecule;
  molarMass: number;
  color: string;
}

export interface Reaction {
  input: string;
  reactants: ReactionSpecies[];
  products: ReactionSpecies[];
  reversible: boolean;
  type?: string;
  explanation?: string;
  predicted: boolean;
  rebalanced: boolean;
  thermo: ThermoResult;
  ea: number;
  eaSource: string;
  mechanism: Mechanism | null;
  mechanismNote?: string;
  preset?: ReactionPreset;
}

export type ReactionOutcome = { ok: true; reaction: Reaction } | { ok: false; error: string; noReaction?: boolean };

/** Categorical palette (dark-mode steps), assigned in fixed order: reactants first, then products. */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

function structureFor(s: SpeciesInput): Molecule {
  const key = compositionKey(s.parsed.composition, s.parsed.charge);
  const lib = libraryByFormula(key).filter((e) => !e.special);
  if (lib.length) return libraryMolecule(lib[0]);
  const g = generated(s.parsed.composition, s.parsed.charge);
  if (isError(g)) throw new EquationError(g.error);
  // reactions need exact stoichiometry, so crystal/lattice models collapse to a single formula unit
  if (g.molecule.atoms.length !== Object.values(s.parsed.composition).reduce((a, b) => a + b, 0)) {
    const el = Object.keys(s.parsed.composition)[0];
    return { atoms: [{ el, x: 0, y: 0, z: 0, charge: 0 }], bonds: [], source: 'generated' };
  }
  return g.molecule;
}

function displayName(s: SpeciesInput): string | undefined {
  if (s.name) return s.name;
  const key = compositionKey(s.parsed.composition, s.parsed.charge);
  return libraryByFormula(key).find((e) => !e.special)?.name;
}

export function findPreset(input: string): ReactionPreset | undefined {
  const n = input.replace(/\s+/g, '');
  return REACTION_PRESETS.find((p) => p.equation.replace(/\s+/g, '') === n);
}

export function buildReaction(input: string, temperature = 298.15): ReactionOutcome {
  let parsed;
  try {
    parsed = parseEquation(input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  let products = parsed.products;
  let type: string | undefined;
  let explanation: string | undefined;
  let predicted = false;
  if (!products) {
    const p = predictProducts(parsed.reactants.map((r) => r.parsed.composition));
    if (!p) {
      return {
        ok: false,
        error: 'I could not predict products for that combination. Type the full equation with an arrow, e.g. “A + B → C + D”.',
      };
    }
    if ('noReaction' in p) return { ok: false, error: p.explanation, noReaction: true };
    products = p.products.map((t) => parseSpecies(t));
    type = p.type;
    explanation = p.explanation;
    predicted = true;
  }

  const bal = balance(
    parsed.reactants.map((s) => ({ composition: s.parsed.composition, charge: s.parsed.charge })),
    products.map((s) => ({ composition: s.parsed.composition, charge: s.parsed.charge })),
  );
  if (!bal.ok) return { ok: false, error: `This equation cannot be balanced: ${bal.reason}` };
  const all = [...parsed.reactants, ...products];
  const given = all.map((s) => s.coefficient);
  let coefficients = bal.coefficients;
  let rebalanced = false;
  if (given.some((c) => c !== undefined)) {
    // an omitted coefficient means 1; keep the user's (possibly scaled) coefficients if they balance
    const g = given.map((c) => c ?? 1);
    const ratio = g[0] / coefficients[0];
    if (g.every((c, i) => Math.abs(c - coefficients[i] * ratio) < 1e-9)) coefficients = g;
    else rebalanced = true;
  }

  let species: ReactionSpecies[];
  try {
    species = all.map((s, i) => {
      const molecule = structureFor(s);
      return {
        text: s.text,
        name: displayName(s),
        composition: s.parsed.composition,
        charge: s.parsed.charge,
        state: s.parsed.state,
        coefficient: coefficients[i],
        side: i < parsed.reactants.length ? 'reactant' : 'product',
        molecule,
        molarMass: molarMass(s.parsed.composition),
        color: SERIES[i % SERIES.length],
      } satisfies ReactionSpecies;
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const reactants = species.filter((s) => s.side === 'reactant');
  const prods = species.filter((s) => s.side === 'product');
  const thermo = reactionThermo(species, temperature);
  // reflect phase choices back so the UI shows which standard state was used
  species.forEach((s, i) => (s.state = s.state ?? thermo.phases[i]));

  const preset = findPreset(input);
  let ea: number;
  let eaSource: string;
  if (preset?.ea !== undefined) {
    ea = preset.ea;
    eaSource = preset.eaNote ? `Literature (approx.) — ${preset.eaNote}` : 'Literature (approx.)';
  } else {
    ea = estimateActivation(thermo.dH);
    eaSource = 'Estimated (Evans–Polanyi heuristic)';
  }
  if (thermo.dH !== undefined && ea < thermo.dH + 5) ea = thermo.dH + 5;

  let mechanism: Mechanism | null = null;
  let mechanismNote: string | undefined;
  const totalAtoms = reactants.reduce((s, r) => s + r.coefficient * r.molecule.atoms.length, 0);
  if (totalAtoms > 600) {
    mechanismNote = 'Too many atoms to animate (over 600). Thermodynamics and kinetics are still available.';
  } else {
    try {
      mechanism = buildMechanism(
        reactants.map((r) => ({ molecule: r.molecule, coefficient: r.coefficient })),
        prods.map((p) => ({ molecule: p.molecule, coefficient: p.coefficient })),
      );
    } catch (e) {
      mechanismNote = e instanceof Error ? e.message : String(e);
    }
  }

  if (!type) type = classify(reactants, prods, parsed.reversible);
  return {
    ok: true,
    reaction: {
      input,
      reactants,
      products: prods,
      reversible: parsed.reversible,
      type,
      explanation: explanation ?? preset?.blurb,
      predicted,
      rebalanced,
      thermo,
      ea,
      eaSource,
      mechanism,
      mechanismNote,
      preset,
    },
  };
}

function classify(r: ReactionSpecies[], p: ReactionSpecies[], reversible: boolean): string {
  const has = (list: ReactionSpecies[], f: (c: Composition) => boolean) => list.some((s) => f(s.composition));
  const isO2 = (c: Composition) => c.O === 2 && Object.keys(c).length === 1;
  if (has(r, isO2) && has(p, (c) => c.C === 1 && c.O === 2 && Object.keys(c).length === 2)) return 'Combustion';
  if (reversible) return 'Equilibrium';
  if (r.length === 1 && p.length > 1) return 'Decomposition';
  if (r.length > 1 && p.length === 1) return 'Synthesis';
  if (r.length === 2 && p.length === 2) return 'Exchange';
  return 'Reaction';
}

export function speciesLabel(s: ReactionSpecies): string {
  return s.name ?? s.text;
}
