import { findLibraryByName, libraryMolecule, compositionOf } from './resolve';
import { FormulaError, hillFormula, normalizeFormulaText, parseFormula, type ParsedFormula } from './formula';

export interface SpeciesInput {
  /** formula text without coefficient or state, e.g. "H2O", "SO4^2-" */
  text: string;
  coefficient?: number;
  parsed: ParsedFormula;
  /** set when the user typed a compound name */
  name?: string;
}

export interface EquationInput {
  reactants: SpeciesInput[];
  products: SpeciesInput[] | null;
  reversible: boolean;
}

export class EquationError extends Error {}

const ARROW = /\s*(<=>|<->|⇌|⇄|<-->|-->|->|→|⟶|=>|=)\s*/;

/** Split one side of an equation into species, respecting charges like "NH4+" or "SO4^2-". */
export function splitSpecies(side: string): string[] {
  const s = side.trim();
  if (!s) return [];
  if (/\s\+\s/.test(s)) return s.split(/\s+\+\s+/).map((x) => x.trim()).filter(Boolean);
  // no spaced pluses: split on "+" that is followed by the start of a new species
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1] ?? '';
    if (ch === '+' && cur && /[A-Z0-9([]/.test(next) && !/\^$/.test(cur)) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseSpecies(raw: string): SpeciesInput {
  let s = normalizeFormulaText(raw).trim();
  let coefficient: number | undefined;
  const m = s.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(?=[A-Za-z([])/);
  if (m) {
    const [a, b] = m[1].split('/');
    coefficient = b ? Number(a) / Number(b) : Number(a);
    s = s.slice(m[0].length);
  }
  try {
    const parsed = parseFormula(s);
    return { text: s.replace(/\((s|l|g|aq)\)\s*$/i, ''), coefficient, parsed };
  } catch (e) {
    // maybe a name: "methane", "ethanol (l)"
    const state = s.match(/\((s|l|g|aq)\)\s*$/i)?.[1]?.toLowerCase() as ParsedFormula['state'];
    const nameText = s.replace(/\((s|l|g|aq)\)\s*$/i, '').trim();
    const entry = findLibraryByName(nameText);
    if (entry && !entry.special) {
      const { composition, charge } = compositionOf(libraryMolecule(entry));
      const text = hillFormula(composition, charge);
      return { text, coefficient, parsed: { text, composition, charge, state }, name: entry.name };
    }
    if (/^[a-z]/.test(nameText) || /\s/.test(nameText))
      throw new EquationError(`“${nameText}” isn’t a formula or a known compound name — try its formula, e.g. C2H5OH.`);
    throw new EquationError(e instanceof FormulaError ? e.message : `Could not read “${raw}”`);
  }
}

export function parseEquation(text: string): EquationInput {
  const t = text.trim();
  if (!t) throw new EquationError('Enter reactants, e.g. “CH4 + O2” or a full equation.');
  const parts = t.split(ARROW);
  // split keeps the captured arrow at odd indexes
  if (parts.length > 3) throw new EquationError('Use a single arrow (→, ->, =, ⇌).');
  const reversible = parts.length === 3 && /<|⇌|⇄/.test(parts[1]);
  const left = splitSpecies(parts[0]);
  if (!left.length) throw new EquationError('No reactants found.');
  const reactants = left.map(parseSpecies);
  const right = parts.length === 3 ? splitSpecies(parts[2]) : [];
  return { reactants, products: right.length ? right.map(parseSpecies) : null, reversible };
}
