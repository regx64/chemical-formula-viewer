import { ELEMENT_BY_SYMBOL } from './elements';
import type { Atom, Bond, Molecule } from './types';

export class SmilesError extends Error {}

const ORGANIC = ['Cl', 'Br', 'B', 'C', 'N', 'O', 'P', 'S', 'F', 'I'];
const AROMATIC_ORGANIC = ['b', 'c', 'n', 'o', 'p', 's'];
const DEFAULT_VALENCE: Record<string, number[]> = {
  B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1],
};

interface PendingAtom extends Atom {
  implicitH: boolean;
  hCount: number;
}

/**
 * Parse a SMILES string into a molecular graph with explicit hydrogens.
 * Supports the organic subset, bracket atoms (isotope, H count, charge), branches,
 * ring closures (incl. %nn), aromatic atoms and dot-disconnected components.
 * Stereo markers are accepted but ignored (3D layout is generated afterwards).
 */
export function parseSmiles(smiles: string): Molecule {
  const atoms: PendingAtom[] = [];
  const bonds: Bond[] = [];
  const stack: number[] = [];
  const rings = new Map<number, { atom: number; order: number | null }>();
  let prev = -1;
  let pendingOrder: number | null = null;
  let i = 0;
  const s = smiles.trim();
  if (!s) throw new SmilesError('Empty SMILES');

  const addAtom = (a: PendingAtom) => {
    const idx = atoms.length;
    atoms.push(a);
    if (prev >= 0) {
      const order = pendingOrder ?? (a.aromatic && atoms[prev].aromatic ? 1.5 : 1);
      bonds.push({ a: prev, b: idx, order });
    }
    pendingOrder = null;
    prev = idx;
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      if (prev < 0) throw new SmilesError('Branch before any atom');
      stack.push(prev);
      i++;
    } else if (ch === ')') {
      if (!stack.length) throw new SmilesError('Unbalanced ")"');
      prev = stack.pop()!;
      i++;
    } else if (ch === '-' || ch === '/' || ch === '\\') {
      pendingOrder = 1;
      i++;
    } else if (ch === '=') {
      pendingOrder = 2;
      i++;
    } else if (ch === '#') {
      pendingOrder = 3;
      i++;
    } else if (ch === '$') {
      pendingOrder = 4;
      i++;
    } else if (ch === ':') {
      pendingOrder = 1.5;
      i++;
    } else if (ch === '.') {
      prev = -1;
      pendingOrder = null;
      i++;
    } else if (/\d/.test(ch) || ch === '%') {
      let num: number;
      if (ch === '%') {
        num = Number(s.slice(i + 1, i + 3));
        if (Number.isNaN(num)) throw new SmilesError('Bad %nn ring closure');
        i += 3;
      } else {
        num = Number(ch);
        i++;
      }
      if (prev < 0) throw new SmilesError('Ring closure before any atom');
      const open = rings.get(num);
      if (open) {
        const order =
          pendingOrder ?? open.order ?? (atoms[prev].aromatic && atoms[open.atom].aromatic ? 1.5 : 1);
        bonds.push({ a: open.atom, b: prev, order });
        rings.delete(num);
      } else {
        rings.set(num, { atom: prev, order: pendingOrder });
      }
      pendingOrder = null;
    } else if (ch === '[') {
      const end = s.indexOf(']', i);
      if (end < 0) throw new SmilesError('Unclosed "["');
      addAtom(parseBracket(s.slice(i + 1, end)));
      i = end + 1;
    } else if (ch === '*') {
      throw new SmilesError('Wildcard atoms are not supported');
    } else {
      const two = s.slice(i, i + 2);
      if (ORGANIC.includes(two)) {
        addAtom(organicAtom(two, false));
        i += 2;
      } else if (ORGANIC.includes(ch)) {
        addAtom(organicAtom(ch, false));
        i++;
      } else if (AROMATIC_ORGANIC.includes(ch)) {
        addAtom(organicAtom(ch.toUpperCase(), true));
        i++;
      } else {
        throw new SmilesError(`Unexpected "${ch}" at position ${i + 1}`);
      }
    }
  }
  if (stack.length) throw new SmilesError('Unclosed branch "("');
  if (rings.size) throw new SmilesError(`Unclosed ring bond ${[...rings.keys()].join(', ')}`);

  return finalize(atoms, bonds);
}

function organicAtom(el: string, aromatic: boolean): PendingAtom {
  return { el, x: 0, y: 0, z: 0, charge: 0, aromatic, implicitH: true, hCount: 0 };
}

function parseBracket(body: string): PendingAtom {
  const m = body.match(/^(\d+)?([A-Z][a-z]?|[a-z][a-z]?)(@*)(?:TH\d|AL\d|SP\d|TB\d+|OH\d+)?(H\d*)?([+-]+\d*|[+-]\d+)?(?::\d+)?$/);
  if (!m) throw new SmilesError(`Bad bracket atom [${body}]`);
  let sym = m[2];
  let aromatic = false;
  if (/^[a-z]/.test(sym)) {
    aromatic = true;
    sym = sym[0].toUpperCase() + sym.slice(1);
  }
  if (!ELEMENT_BY_SYMBOL[sym]) throw new SmilesError(`Unknown element "${sym}"`);
  const hCount = m[4] ? (m[4].length > 1 ? Number(m[4].slice(1)) : 1) : 0;
  let charge = 0;
  if (m[5]) {
    const sign = m[5][0] === '+' ? 1 : -1;
    const rest = m[5].slice(1);
    if (/^\d+$/.test(rest)) charge = sign * Number(rest);
    else charge = sign * m[5].length;
  }
  return { el: sym, x: 0, y: 0, z: 0, charge, aromatic, implicitH: false, hCount };
}

function finalize(atoms: PendingAtom[], bonds: Bond[]): Molecule {
  const bondSum = new Array(atoms.length).fill(0);
  const aromaticBonds = new Array(atoms.length).fill(0);
  for (const b of bonds) {
    const o = b.order === 1.5 ? 1 : b.order;
    bondSum[b.a] += o;
    bondSum[b.b] += o;
    if (b.order === 1.5) {
      aromaticBonds[b.a]++;
      aromaticBonds[b.b]++;
    }
  }
  const heavyCount = atoms.length;
  const outAtoms: Atom[] = atoms.map(({ el, x, y, z, charge, aromatic }) => ({ el, x, y, z, charge, aromatic }));
  const outBonds: Bond[] = bonds.map((b) => ({ ...b }));
  for (let idx = 0; idx < heavyCount; idx++) {
    const a = atoms[idx];
    let h = a.hCount;
    if (a.implicitH) {
      const vals = DEFAULT_VALENCE[a.el] ?? [0];
      // aromatic atoms donate one bond-order unit to the π system (C, N, B, P only)
      const piBonus = a.aromatic && aromaticBonds[idx] > 0 && ['C', 'N', 'B', 'P'].includes(a.el) ? 1 : 0;
      const used = bondSum[idx] + piBonus;
      const target = vals.find((v) => v >= used) ?? used;
      h = Math.max(0, target - used);
    }
    for (let k = 0; k < h; k++) {
      outAtoms.push({ el: 'H', x: 0, y: 0, z: 0, charge: 0 });
      outBonds.push({ a: idx, b: outAtoms.length - 1, order: 1 });
    }
  }
  return { atoms: outAtoms, bonds: outBonds, source: 'smiles' };
}

/** Heuristic: does this string look like SMILES rather than a molecular formula? */
export function looksLikeSmiles(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (/[=#@\\/%]/.test(t)) return true;
  if (/[a-z]\d|^[cnos]/.test(t) && !/^[A-Z]/.test(t)) return true;
  if (/\[[^\]]*\]/.test(t) && /[A-Za-z]/.test(t)) return true;
  // ring-closure digits after aromatic lowercase or branches like C(C)C
  if (/\([A-Z]/.test(t) && /\)[A-Z]/.test(t) && !/\)\d/.test(t)) return true;
  return false;
}
