import { commonIonCharge, element, isMetal, valences } from './elements';
import type { Composition } from './formula';
import type { Atom, Bond, Molecule } from './types';

/* ------------------------------------------------------------------------------------------------
 * Formula → plausible structure.
 *
 * A molecular formula does not determine a structure (C2H6O is both ethanol and dimethyl ether),
 * so this is a chemically-informed guess used when neither the curated library nor PubChem
 * has an answer:
 *   • covalent species: build a heavy-atom skeleton (carbon chain / aromatic ring, or a central
 *     atom for inorganic species), then search valence choices (hypervalent S, P, Cl, Xe …) so that
 *     π bonds / ring closures plus hydrogens saturate every atom exactly;
 *   • ionic species (metal + non-metals): split into cations and (poly)atomic anions;
 *   • pure metals: a small face-centred-cubic cluster.
 * ---------------------------------------------------------------------------------------------- */

const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);

interface Draft {
  atoms: Atom[];
  bonds: Bond[];
}

function addAtom(d: Draft, el: string, charge = 0): number {
  d.atoms.push({ el, x: 0, y: 0, z: 0, charge });
  return d.atoms.length - 1;
}

function bondBetween(d: Draft, a: number, b: number): Bond | undefined {
  return d.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
}

function degreeOrderSum(d: Draft, i: number): number {
  return d.bonds.reduce((s, b) => s + (b.a === i || b.b === i ? b.order : 0), 0);
}

function chargedValences(el: string, charge: number): number[] {
  const base = valences(el);
  if (!charge) return base;
  const g = element(el).group;
  if (g >= 15) return base.map((v) => v + charge).filter((v) => v >= 0);
  if (g === 13) return base.map((v) => v - charge);
  return base.map((v) => v - Math.abs(charge));
}

function pathLength(d: Draft, from: number, to: number): number {
  const dist = new Map<number, number>([[from, 0]]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    if (c === to) return dist.get(c)!;
    for (const b of d.bonds) {
      const n = b.a === c ? b.b : b.b === c ? b.a : -1;
      if (n >= 0 && !dist.has(n)) {
        dist.set(n, dist.get(c)! + 1);
        q.push(n);
      }
    }
  }
  return Infinity;
}

/**
 * Given a heavy-atom skeleton, choose valences + π bonds/rings + monovalent attachments.
 * Returns the number of unsatisfied valences (0 = perfect closed-shell structure).
 */
function saturate(skeleton: Draft, mono: string[]): { draft: Draft; defects: number } {
  const heavy = skeleton.atoms.length;
  const options = skeleton.atoms.map((a, i) => {
    const deg = degreeOrderSum(skeleton, i);
    const vs = chargedValences(a.el, a.charge).filter((v) => v >= deg);
    return vs.length ? vs : [deg];
  });
  // enumerate valence combinations (bounded) in order of total "hypervalence"
  const flexible = options.map((o, i) => (o.length > 1 ? i : -1)).filter((i) => i >= 0).slice(0, 6);
  const combos: number[][] = [];
  const rec = (k: number, choice: number[]) => {
    if (k === flexible.length) {
      combos.push(choice.slice());
      return;
    }
    for (let c = 0; c < options[flexible[k]].length; c++) {
      choice.push(c);
      rec(k + 1, choice);
      choice.pop();
    }
  };
  rec(0, []);
  combos.sort((a, b) => a.reduce((s, x) => s + x, 0) - b.reduce((s, x) => s + x, 0));

  let best: { draft: Draft; defects: number } | null = null;
  for (const combo of combos.slice(0, 400)) {
    const val = options.map((o) => o[0]);
    flexible.forEach((atomIdx, k) => (val[atomIdx] = options[atomIdx][combo[k]]));
    const d: Draft = { atoms: skeleton.atoms.map((a) => ({ ...a })), bonds: skeleton.bonds.map((b) => ({ ...b })) };
    const cap = val.map((v, i) => v - degreeOrderSum(d, i));
    let free = cap.reduce((s, c) => s + c, 0);
    let increments = (free - mono.length) / 2;
    if (increments < 0) continue;
    let defects = 0;
    if (!Number.isInteger(increments)) {
      defects = 1;
      increments = Math.floor(increments);
    }
    // π bonds: prefer heteroatom double bonds to terminal atoms, then C=C, then ring closures
    for (let k = 0; k < increments; k++) {
      let pick: { a: number; b: number; score: number; ring: boolean } | null = null;
      for (const b of d.bonds) {
        if (cap[b.a] < 1 || cap[b.b] < 1 || b.order >= 3) continue;
        const ea = d.atoms[b.a].el;
        const eb = d.atoms[b.b].el;
        const termA = d.bonds.filter((x) => x.a === b.a || x.b === b.a).length === 1;
        const termB = d.bonds.filter((x) => x.a === b.b || x.b === b.b).length === 1;
        let score = 0;
        if ((termB && eb !== 'C') || (termA && ea !== 'C')) score += 8;
        if (ea === 'C' && eb === 'C') score += 4;
        score -= b.order * 3; // spread unsaturation before building triple bonds
        if (!pick || score > pick.score) pick = { a: b.a, b: b.b, score, ring: false };
      }
      if (!pick) {
        // ring closure between atoms with spare capacity, favouring 5/6-membered rings
        for (let i = 0; i < heavy; i++) {
          if (cap[i] < 1) continue;
          for (let j = i + 1; j < heavy; j++) {
            if (cap[j] < 1 || bondBetween(d, i, j)) continue;
            const len = pathLength(d, i, j);
            if (len < 2 || len === Infinity) continue;
            const score = -Math.abs(len + 1 - 6);
            if (!pick || score > pick.score) pick = { a: i, b: j, score, ring: true };
          }
        }
      }
      if (!pick) {
        defects += 2 * (increments - k);
        break;
      }
      const existing = bondBetween(d, pick.a, pick.b);
      if (existing) existing.order += 1;
      else d.bonds.push({ a: pick.a, b: pick.b, order: 1 });
      cap[pick.a]--;
      cap[pick.b]--;
      free -= 2;
    }
    // monovalent atoms: halogens onto carbon first, hydrogens onto the most electronegative spare sites
    const order = [...mono].sort((a, b) => (a === 'H' ? 1 : 0) - (b === 'H' ? 1 : 0));
    for (const m of order) {
      let target = -1;
      for (let i = 0; i < heavy; i++) {
        if (cap[i] < 1) continue;
        if (target < 0) {
          target = i;
          continue;
        }
        const ei = d.atoms[i].el;
        const et = d.atoms[target].el;
        const better =
          m === 'H'
            ? element(ei).en > element(et).en && !HALOGENS.has(ei)
            : ei === 'C' && et !== 'C';
        if (better) target = i;
      }
      if (target < 0) {
        defects++;
        continue;
      }
      const idx = addAtom(d, m);
      d.bonds.push({ a: target, b: idx, order: 1 });
      cap[target]--;
    }
    defects += cap.reduce((s, c) => s + Math.max(0, c), 0);
    if (!best || defects < best.defects) best = { draft: d, defects };
    if (defects === 0) break;
  }
  return best ?? { draft: skeleton, defects: 99 };
}

function covalent(comp: Composition, charge: number): { mol: Molecule; defects: number } {
  const counts = { ...comp };
  const nH = counts.H ?? 0;
  delete counts.H;
  const nC = counts.C ?? 0;

  const d: Draft = { atoms: [], bonds: [] };
  const mono: string[] = Array(nH).fill('H');

  // only hydrogen
  if (Object.keys(counts).length === 0) {
    if (nH === 1) return { mol: { atoms: [{ el: 'H', x: 0, y: 0, z: 0, charge }], bonds: [] }, defects: 1 };
    for (let k = 0; k + 1 < nH; k += 2) {
      const a = addAtom(d, 'H');
      const b = addAtom(d, 'H');
      d.bonds.push({ a, b, order: 1 });
    }
    return { mol: d, defects: nH % 2 };
  }

  if (nC > 0) {
    const carbons: number[] = [];
    const dou = (2 * nC + 2 + (counts.N ?? 0) + (counts.P ?? 0) - nH - [...HALOGENS].reduce((s, x) => s + (counts[x] ?? 0), 0)) / 2;
    for (let k = 0; k < nC; k++) carbons.push(addAtom(d, 'C'));
    if (nC >= 6 && dou >= 4) {
      for (let k = 0; k < 6; k++) d.bonds.push({ a: carbons[k], b: carbons[(k + 1) % 6], order: k % 2 === 0 ? 2 : 1 });
      for (let k = 6; k < nC; k++) d.bonds.push({ a: carbons[k === 6 ? 0 : k - 1], b: carbons[k], order: 1 });
    } else {
      for (let k = 1; k < nC; k++) d.bonds.push({ a: carbons[k - 1], b: carbons[k], order: 1 });
    }
    // heteroatoms distributed over carbons, chain ends first
    const slots: number[] = [];
    for (let lo = 0, hi = nC - 1; lo <= hi; lo++, hi--) {
      slots.push(carbons[hi]);
      if (lo !== hi) slots.push(carbons[lo]);
    }
    let s = 0;
    const hetero = Object.entries(counts).filter(([el]) => el !== 'C' && !HALOGENS.has(el));
    for (const [el, n] of hetero) {
      for (let k = 0; k < n; k++) {
        let tries = 0;
        let target = slots[s % slots.length];
        while (degreeOrderSum(d, target) >= 4 && tries++ < slots.length) target = slots[++s % slots.length];
        const idx = addAtom(d, el);
        d.bonds.push({ a: target, b: idx, order: 1 });
        s++;
      }
    }
    for (const x of HALOGENS) for (let k = 0; k < (counts[x] ?? 0); k++) mono.push(x);
  } else {
    // inorganic: central atom = least electronegative element present exactly once
    const singles = Object.entries(counts)
      .filter(([, n]) => n === 1)
      .map(([el]) => el)
      .sort((a, b) => (element(a).en || 9) - (element(b).en || 9));
    const center = singles[0];
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (center && total > 1 && Math.max(...valences(center)) >= total - 1) {
      const c = addAtom(d, center);
      for (const [el, n] of Object.entries(counts)) {
        if (el === center) continue;
        for (let k = 0; k < n; k++) d.bonds.push({ a: c, b: addAtom(d, el), order: 1 });
      }
    } else {
      // chain of heavy atoms, monovalent ones (halogens) kept as leaves
      const chain: string[] = [];
      const leaves: string[] = [];
      for (const [el, n] of Object.entries(counts)) for (let k = 0; k < n; k++) (HALOGENS.has(el) ? leaves : chain).push(el);
      if (!chain.length) chain.push(leaves.shift()!);
      let prev = -1;
      for (const el of chain) {
        const i = addAtom(d, el);
        if (prev >= 0) d.bonds.push({ a: prev, b: i, order: 1 });
        prev = i;
      }
      mono.push(...leaves);
    }
  }

  // distribute ionic charge as formal charges: negative on terminal electronegative atoms, positive on the hub
  if (charge) {
    const deg = (i: number) => d.bonds.filter((b) => b.a === i || b.b === i).length;
    if (charge < 0) {
      const cands = d.atoms
        .map((_a, i) => i)
        .sort((i, j) => deg(i) - deg(j) || element(d.atoms[j].el).en - element(d.atoms[i].el).en);
      for (let k = 0; k < -charge && k < cands.length; k++) d.atoms[cands[k]].charge = -1;
    } else {
      const cands = d.atoms.map((_a, i) => i).sort((i, j) => deg(j) - deg(i));
      for (let k = 0; k < charge && k < cands.length; k++) d.atoms[cands[k]].charge = 1;
    }
  }

  const { draft, defects } = saturate(d, mono);
  return { mol: draft, defects };
}

const POLYATOMIC: { name: string; comp: Composition; charge: number; smiles: string }[] = [
  { name: 'hydroxide', comp: { O: 1, H: 1 }, charge: -1, smiles: '[OH-]' },
  { name: 'nitrate', comp: { N: 1, O: 3 }, charge: -1, smiles: '[O-][N+](=O)[O-]' },
  { name: 'nitrite', comp: { N: 1, O: 2 }, charge: -1, smiles: '[O-]N=O' },
  { name: 'sulfate', comp: { S: 1, O: 4 }, charge: -2, smiles: '[O-]S(=O)(=O)[O-]' },
  { name: 'hydrogen sulfate', comp: { H: 1, S: 1, O: 4 }, charge: -1, smiles: 'OS(=O)(=O)[O-]' },
  { name: 'sulfite', comp: { S: 1, O: 3 }, charge: -2, smiles: '[O-]S(=O)[O-]' },
  { name: 'carbonate', comp: { C: 1, O: 3 }, charge: -2, smiles: '[O-]C(=O)[O-]' },
  { name: 'bicarbonate', comp: { H: 1, C: 1, O: 3 }, charge: -1, smiles: 'OC(=O)[O-]' },
  { name: 'phosphate', comp: { P: 1, O: 4 }, charge: -3, smiles: '[O-]P(=O)([O-])[O-]' },
  { name: 'acetate', comp: { C: 2, H: 3, O: 2 }, charge: -1, smiles: 'CC(=O)[O-]' },
  { name: 'chlorate', comp: { Cl: 1, O: 3 }, charge: -1, smiles: '[O-]Cl(=O)=O' },
  { name: 'perchlorate', comp: { Cl: 1, O: 4 }, charge: -1, smiles: '[O-]Cl(=O)(=O)=O' },
  { name: 'permanganate', comp: { Mn: 1, O: 4 }, charge: -1, smiles: '[O-][Mn](=O)(=O)=O' },
  { name: 'chromate', comp: { Cr: 1, O: 4 }, charge: -2, smiles: '[O-][Cr](=O)(=O)[O-]' },
  { name: 'dichromate', comp: { Cr: 2, O: 7 }, charge: -2, smiles: '[O-][Cr](=O)(=O)O[Cr](=O)(=O)[O-]' },
  { name: 'cyanide', comp: { C: 1, N: 1 }, charge: -1, smiles: '[C-]#N' },
  { name: 'ammonium', comp: { N: 1, H: 4 }, charge: 1, smiles: '[NH4+]' },
];

export interface IonPart {
  comp: Composition;
  charge: number;
  smiles?: string;
  count: number;
}

function subtract(a: Composition, b: Composition, times: number): Composition | null {
  const out = { ...a };
  for (const [el, n] of Object.entries(b)) {
    out[el] = (out[el] ?? 0) - n * times;
    if (out[el] < 0) return null;
    if (out[el] === 0) delete out[el];
  }
  return out;
}

const AMMONIUM = POLYATOMIC.find((p) => p.name === 'ammonium')!;

/** Interpret a composition as cations only (metals and/or ammonium). */
function cationsOf(rest: Composition): IonPart[] | null {
  const parts: IonPart[] = [];
  const left = { ...rest };
  if (left.N || left.H) {
    const n = left.N ?? 0;
    if (!n || left.H !== 4 * n) return null;
    parts.push({ comp: AMMONIUM.comp, charge: 1, smiles: AMMONIUM.smiles, count: n });
    delete left.N;
    delete left.H;
  }
  for (const [el, n] of Object.entries(left)) {
    if (!isMetal(el)) return null;
    parts.push({ comp: { [el]: 1 }, charge: commonIonCharge(el) ?? 2, count: n });
  }
  return parts.length ? parts : null;
}

/** Make the formula unit carry `total` charge, adjusting a lone cation's oxidation state if needed. */
function balanceCharges(parts: IonPart[], total: number): boolean {
  const sum = () => parts.reduce((s, p) => s + p.charge * p.count, 0);
  if (sum() === total) return true;
  const cations = parts.filter((p) => p.charge > 0 && p.smiles === undefined);
  if (cations.length !== 1) return false;
  const others = parts.filter((p) => p !== cations[0]).reduce((s, p) => s + p.charge * p.count, 0);
  const need = (total - others) / cations[0].count;
  if (!Number.isInteger(need) || need <= 0 || need > 7) return false;
  cations[0].charge = need;
  return true;
}

/** Try to describe a composition as cations + (poly)atomic anions. */
export function ionicDecomposition(comp: Composition, totalCharge = 0): IonPart[] | null {
  const hasMetal = Object.keys(comp).some((el) => isMetal(el));
  // 1) one kind of polyatomic anion + cations (KMnO4, Al2(SO4)3, NH4NO3, NaHCO3 …)
  for (const p of POLYATOMIC) {
    if (p.charge > 0) continue;
    const firstEl = Object.keys(p.comp)[0];
    const max = Math.floor((comp[firstEl] ?? 0) / p.comp[firstEl]);
    for (let n = max; n >= 1; n--) {
      const rest = subtract(comp, p.comp, n);
      if (!rest || !Object.keys(rest).length) continue;
      const cations = cationsOf(rest);
      if (!cations) continue;
      const parts = [...cations, { comp: p.comp, charge: p.charge, smiles: p.smiles, count: n }];
      if (balanceCharges(parts, totalCharge)) return parts;
    }
  }
  // 2) metal (or ammonium) cations + monatomic anions (NaCl, Fe2O3, NH4Cl …)
  const cationEls = Object.keys(comp).filter((el) => isMetal(el));
  const rest: Composition = { ...comp };
  const parts: IonPart[] = [];
  for (const el of cationEls) {
    parts.push({ comp: { [el]: 1 }, charge: commonIonCharge(el) ?? 2, count: comp[el] });
    delete rest[el];
  }
  if (!hasMetal) {
    // ammonium halides only
    const halide = Object.keys(rest).find((el) => ['F', 'Cl', 'Br', 'I'].includes(el));
    if (!halide || Object.keys(rest).length !== 3) return null;
    const n = rest[halide];
    const after = subtract(rest, AMMONIUM.comp, n);
    if (!after || Object.keys(after).join() !== halide) return null;
    return [
      { comp: AMMONIUM.comp, charge: 1, smiles: AMMONIUM.smiles, count: n },
      { comp: { [halide]: 1 }, charge: -1, count: n },
    ];
  }
  if (!Object.keys(rest).length) return null;
  for (const [el, n] of Object.entries(rest)) {
    const q = el === 'H' ? -1 : commonIonCharge(el);
    if (q === undefined || q >= 0) return null;
    parts.push({ comp: { [el]: 1 }, charge: q, count: n });
  }
  balanceCharges(parts, totalCharge);
  return parts;
}

/** Small FCC cluster for a pure metal. */
function metalCluster(el: string): Molecule {
  const r = element(el).cov;
  const a = 2 * Math.SQRT2 * r;
  const pts: [number, number, number][] = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) pts.push([x, y, z]);
  pts.push([0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5]);
  const atoms: Atom[] = pts.map(([x, y, z]) => ({ el, x: (x - 0.5) * a, y: (y - 0.5) * a, z: (z - 0.5) * a, charge: 0 }));
  const bonds: Bond[] = [];
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const d = Math.hypot(atoms[i].x - atoms[j].x, atoms[i].y - atoms[j].y, atoms[i].z - atoms[j].z);
      if (d < a * 0.75) bonds.push({ a: i, b: j, order: 0 });
    }
  return { atoms, bonds, source: 'crystal', note: 'Face-centred-cubic unit cell (metallic lattice)' };
}

export interface BuildResult {
  mol: Molecule;
  /** true when coordinates are already final (crystal clusters); otherwise needs embed() */
  hasCoordinates: boolean;
  kind: 'covalent' | 'ionic' | 'metal' | 'atom';
  defects: number;
  ionParts?: IonPart[];
}

export type SmilesParser = (s: string) => Molecule;

/** Build a graph for an arbitrary composition. `parseSmiles` is injected to avoid a cycle. */
export function buildFromComposition(comp: Composition, charge: number, parseSmiles: SmilesParser): BuildResult {
  const els = Object.keys(comp);
  const total = Object.values(comp).reduce((a, b) => a + b, 0);
  if (els.length === 1 && isMetal(els[0]) && !charge) {
    return { mol: metalCluster(els[0]), hasCoordinates: true, kind: 'metal', defects: 0 };
  }
  if (els.length === 1 && total === 1) {
    return {
      mol: { atoms: [{ el: els[0], x: 0, y: 0, z: 0, charge }], bonds: [] },
      hasCoordinates: true,
      kind: 'atom',
      defects: 0,
    };
  }
  const ionic = els.length > 1 ? ionicDecomposition(comp, charge) : null;
  if (ionic) {
    const mol: Molecule = { atoms: [], bonds: [] };
    const cationAtoms: number[] = [];
    const anionAnchors: number[] = [];
    for (const part of ionic) {
      for (let k = 0; k < part.count; k++) {
        let sub: Molecule;
        if (part.smiles) sub = parseSmiles(part.smiles);
        else {
          const el = Object.keys(part.comp)[0];
          sub = { atoms: [{ el, x: 0, y: 0, z: 0, charge: part.charge }], bonds: [] };
        }
        const base = mol.atoms.length;
        mol.atoms.push(...sub.atoms.map((a) => ({ ...a })));
        mol.bonds.push(...sub.bonds.map((b) => ({ a: b.a + base, b: b.b + base, order: b.order })));
        if (part.charge > 0) cationAtoms.push(sub.atoms.length === 1 ? base : base + sub.atoms.findIndex((a) => a.charge > 0));
        else {
          let anchor = sub.atoms.findIndex((a) => a.charge < 0);
          if (anchor < 0) anchor = 0;
          anionAnchors.push(base + anchor);
        }
      }
    }
    // ionic contacts: round-robin so every ion touches at least one counter-ion
    const n = Math.max(cationAtoms.length, anionAnchors.length);
    for (let k = 0; k < n; k++) {
      const c = cationAtoms[k % cationAtoms.length];
      const a = anionAnchors[k % anionAnchors.length];
      if (c !== undefined && a !== undefined) mol.bonds.push({ a: c, b: a, order: 0 });
    }
    // extra contacts for highly charged cations so the cluster stays compact
    if (cationAtoms.length && anionAnchors.length > cationAtoms.length) {
      anionAnchors.forEach((a, k) => {
        const c = cationAtoms[(k + 1) % cationAtoms.length];
        if (!mol.bonds.some((b) => (b.a === c && b.b === a) || (b.a === a && b.b === c))) mol.bonds.push({ a: c, b: a, order: 0 });
      });
    }
    mol.note = 'Ionic compound — one formula unit shown; dashed lines are ionic contacts, not covalent bonds';
    return { mol, hasCoordinates: false, kind: 'ionic', defects: 0, ionParts: ionic };
  }
  const { mol, defects } = covalent(comp, charge);
  return { mol, hasCoordinates: false, kind: 'covalent', defects };
}
