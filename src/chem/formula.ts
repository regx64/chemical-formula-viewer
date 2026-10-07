import { ELEMENT_BY_SYMBOL, element } from './elements';

export type Composition = Record<string, number>;

export interface ParsedFormula {
  /** Normalized text as typed (sub/superscripts converted to ASCII) without coefficient/state */
  text: string;
  composition: Composition;
  charge: number;
  state?: Phase;
}

export type Phase = 's' | 'l' | 'g' | 'aq';

export class FormulaError extends Error {}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Convert unicode sub/superscripts and dot variants into a plain ASCII-ish form. */
export function normalizeFormulaText(input: string): string {
  let out = '';
  let inSup = false;
  for (const ch of input.trim()) {
    const si = SUB.indexOf(ch);
    const pi = SUP.indexOf(ch);
    if (si >= 0) {
      out += String(si);
      inSup = false;
    } else if (pi >= 0 || ch === '⁺' || ch === '⁻') {
      if (!inSup) out += '^';
      inSup = true;
      out += pi >= 0 ? String(pi) : ch === '⁺' ? '+' : '-';
    } else {
      inSup = false;
      out += ch === '·' || ch === '•' || ch === '∙' || ch === '*' ? '.' : ch === '−' ? '-' : ch;
    }
  }
  return out;
}

const STATE_RE = /\((s|l|g|aq)\)\s*$/i;

/** Parse a single species, e.g. "CuSO4·5H2O", "SO4^2-", "NH4+", "Ca(OH)2(aq)". */
export function parseFormula(raw: string): ParsedFormula {
  let s = normalizeFormulaText(raw).replace(/\s+/g, '');
  if (!s) throw new FormulaError('Empty formula');
  let state: Phase | undefined;
  const sm = s.match(STATE_RE);
  if (sm) {
    state = sm[1].toLowerCase() as Phase;
    s = s.slice(0, sm.index);
  }

  // charge: "^2-", "^{2-}", "^-2", trailing "+", "++", "-" or "2-"/"3+" after a caret only
  let charge = 0;
  const caret = s.match(/\^\{?(\d*)([+-])(\d*)\}?$/);
  if (caret) {
    const mag = Number(caret[1] || caret[3] || 1);
    charge = caret[2] === '+' ? mag : -mag;
    s = s.slice(0, caret.index);
  } else {
    const signs = s.match(/([+-]+)$/);
    if (signs) {
      const run = signs[1];
      if (/^(\+*|-*)$/.test(run)) {
        charge = run[0] === '+' ? run.length : -run.length;
        s = s.slice(0, signs.index);
      }
    }
  }
  if (!s) throw new FormulaError('Missing formula body');

  const composition: Composition = {};
  const parts = s.split('.');
  for (let pi = 0; pi < parts.length; pi++) {
    let part = parts[pi];
    let mult = 1;
    const lead = part.match(/^(\d+)/);
    if (lead && pi > 0) {
      mult = Number(lead[1]);
      part = part.slice(lead[1].length);
    }
    if (!part) throw new FormulaError(`Malformed hydrate segment in "${raw}"`);
    const comp = parseGroup(part, raw);
    for (const [el, n] of Object.entries(comp)) composition[el] = (composition[el] ?? 0) + n * mult;
  }
  return { text: s + (charge ? chargeSuffix(charge) : ''), composition, charge, state };
}

function chargeSuffix(charge: number): string {
  const mag = Math.abs(charge);
  return '^' + (mag === 1 ? '' : mag) + (charge > 0 ? '+' : '-');
}

function parseGroup(s: string, raw: string): Composition {
  let i = 0;
  const stack: Composition[] = [{}];
  const closers: string[] = [];
  const readNumber = (): number => {
    const m = s.slice(i).match(/^\d+/);
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push({});
      closers.push(ch === '(' ? ')' : ch === '[' ? ']' : '}');
      i++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (closers.pop() !== ch) throw new FormulaError(`Unbalanced "${ch}" in "${raw}"`);
      i++;
      const n = readNumber();
      const group = stack.pop()!;
      const top = stack[stack.length - 1];
      for (const [el, c] of Object.entries(group)) top[el] = (top[el] ?? 0) + c * n;
    } else if (/[A-Z]/.test(ch)) {
      let sym = ch;
      const lower = i + 1 < s.length && /[a-z]/.test(s[i + 1]) ? s[i + 1] : '';
      if (lower && ELEMENT_BY_SYMBOL[ch + lower]) sym = ch + lower;
      else if (!ELEMENT_BY_SYMBOL[ch]) throw new FormulaError(`Unknown element "${ch + lower}" in "${raw}"`);
      i += sym.length;
      // reject things like "Co" vs "CO" mixups only when the lowercase letter is not an element continuation
      if (i < s.length && /[a-z]/.test(s[i])) {
        throw new FormulaError(`Unknown element "${sym + s[i]}" in "${raw}"`);
      }
      const n = readNumber();
      const top = stack[stack.length - 1];
      top[sym] = (top[sym] ?? 0) + n;
    } else {
      throw new FormulaError(`Unexpected "${ch}" in "${raw}"`);
    }
  }
  if (closers.length) throw new FormulaError(`Unclosed bracket in "${raw}"`);
  return stack[0];
}

export function molarMass(comp: Composition): number {
  let m = 0;
  for (const [el, n] of Object.entries(comp)) m += element(el).mass * n;
  return m;
}

/** Hill system ordering: C, H, then alphabetical; alphabetical when there is no carbon. */
export function hillOrder(comp: Composition): string[] {
  const els = Object.keys(comp).filter((e) => comp[e] > 0);
  if (els.includes('C')) {
    const rest = els.filter((e) => e !== 'C' && e !== 'H').sort();
    return ['C', ...(els.includes('H') ? ['H'] : []), ...rest];
  }
  return els.sort();
}

export function hillFormula(comp: Composition, charge = 0): string {
  const body = hillOrder(comp)
    .map((e) => e + (comp[e] === 1 ? '' : comp[e]))
    .join('');
  return body + (charge ? chargeSuffix(charge) : '');
}

const BEFORE_H = new Set(['B', 'C', 'N', 'P', 'Si', 'As', 'Sb', 'Ge']);

/**
 * Conventional display formula: Hill order for organics, otherwise electropositive → electronegative
 * (HCl, H2SO4, NH3, SO4^2-, XeF4, Ca(OH)2).
 */
export function conventionalFormula(comp: Composition, charge = 0): string {
  const els = Object.keys(comp).filter((e) => comp[e] > 0);
  if (comp.C && comp.H && !(comp.C === 1 && comp.H === 1 && comp.N === 1 && els.length === 3)) return hillFormula(comp, charge);
  const tail = charge ? chargeSuffix(charge) : '';
  const part = (e: string, n: number) => e + (n === 1 ? '' : n);
  if (els.length === 2 && comp.O === 1 && comp.H === 1) return 'OH' + tail;
  const metals = els.filter((e) => ELEMENT_BY_SYMBOL[e].category.includes('metal') || ELEMENT_BY_SYMBOL[e].category === 'lanthanide');
  if (metals.length === 1 && els.length === 3 && comp.O && comp.H === comp.O) {
    const n = comp.O;
    return part(metals[0], comp[metals[0]]) + (n > 1 ? `(OH)${n}` : 'OH') + tail;
  }
  const en = (e: string) => {
    const v = ELEMENT_BY_SYMBOL[e].en || 4;
    if (e === 'H' && els.some((x) => BEFORE_H.has(x))) return 3.05;
    return v;
  };
  return els.sort((a, b) => en(a) - en(b)).map((e) => part(e, comp[e])).join('') + tail;
}

export function compositionKey(comp: Composition, charge = 0): string {
  return hillFormula(comp, charge);
}

export function totalAtoms(comp: Composition): number {
  return Object.values(comp).reduce((a, b) => a + b, 0);
}

export interface FormulaToken {
  text: string;
  kind: 'normal' | 'sub' | 'sup';
}

/** Split normalized formula text into tokens for typographic rendering. */
export function formulaTokens(text: string): FormulaToken[] {
  const s = normalizeFormulaText(text);
  const out: FormulaToken[] = [];
  const push = (t: string, kind: FormulaToken['kind']) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += t;
    else out.push({ text: t, kind });
  };
  let i = 0;
  // leading coefficient
  const lead = s.match(/^(\d+(?:\/\d+)?)\s*/);
  if (lead) {
    push(lead[1], 'normal');
    i = lead[0].length;
  }
  let afterDot = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '^') {
      const m = s.slice(i + 1).match(/^\{?(\d*[+-]\d*)\}?/);
      if (m) {
        const v = m[1].replace(/^(\d*)([+-])(\d*)$/, (_a, x, sign, y) => (x || y) + (sign === '-' ? '−' : '+'));
        push(v.replace(/^1(?=[+−])/, ''), 'sup');
        i += 1 + m[0].length;
        continue;
      }
    }
    if (/\d/.test(ch) && !afterDot && i > 0) {
      push(ch, 'sub');
    } else if ((ch === '+' || ch === '-') && /^[+-]+$/.test(s.slice(i))) {
      // trailing sign run → superscript charge
      push(s.slice(i).replace(/-/g, '−'), 'sup');
      break;
    } else if (ch === '.') {
      push('·', 'normal');
      afterDot = true;
      i++;
      continue;
    } else {
      push(ch, 'normal');
    }
    if (!/\d/.test(ch)) afterDot = false;
    i++;
  }
  return out;
}
