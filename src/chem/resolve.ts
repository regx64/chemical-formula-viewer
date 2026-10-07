import { LIBRARY, type LibraryEntry } from '../data/library';
import { buildFromComposition } from './builder';
import { embed, orientPrincipal } from './embed';
import { compositionKey, conventionalFormula, FormulaError, hillFormula, parseFormula, totalAtoms, type Composition } from './formula';
import * as pubchem from './pubchem';
import { looksLikeSmiles, parseSmiles } from './smiles';
import { specialStructure } from './special';
import type { Molecule, StructureSource } from './types';

export interface Alternative {
  label: string;
  query: string;
}

export interface Resolved {
  molecule: Molecule;
  name: string;
  composition: Composition;
  charge: number;
  /** formula as it should be shown (user's own notation when they typed one) */
  displayFormula: string;
  /** true when the 3D model is a cluster/lattice rather than one formula unit */
  isCluster: boolean;
  source: StructureSource;
  sourceLabel: string;
  description?: string;
  note?: string;
  alternatives: Alternative[];
  cid?: number;
  category?: string;
}

export function compositionOf(mol: Molecule): { composition: Composition; charge: number } {
  const composition: Composition = {};
  let charge = 0;
  for (const a of mol.atoms) {
    composition[a.el] = (composition[a.el] ?? 0) + 1;
    charge += a.charge;
  }
  return { composition, charge };
}

/* ---------- library index ---------- */

interface IndexedEntry {
  entry: LibraryEntry;
  key: string;
  shown: string;
}

let index: IndexedEntry[] | null = null;
function libraryIndex(): IndexedEntry[] {
  if (index) return index;
  index = LIBRARY.map((entry) => {
    const { composition, charge } = entry.formula
      ? parseFormula(entry.formula)
      : compositionOf(entry.smiles ? parseSmiles(entry.smiles) : specialStructure(entry.special!));
    return { entry, key: compositionKey(composition, charge), shown: (entry.display ?? conventionalFormula(composition, charge)).toLowerCase() };
  });
  return index;
}

const cache = new Map<string, Molecule>();

/** Centre a highly symmetric cluster and tilt it so lattice rows don't hide behind each other. */
function obliqueView(mol: Molecule): Molecule {
  const n = mol.atoms.length;
  const c = mol.atoms.reduce((acc, a) => [acc[0] + a.x / n, acc[1] + a.y / n, acc[2] + a.z / n], [0, 0, 0]);
  const ry = (-32 * Math.PI) / 180;
  const rx = (22 * Math.PI) / 180;
  return {
    ...mol,
    atoms: mol.atoms.map((a) => {
      const x0 = a.x - c[0];
      const y0 = a.y - c[1];
      const z0 = a.z - c[2];
      const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry);
      const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry);
      return { ...a, x: x1, y: y0 * Math.cos(rx) - z1 * Math.sin(rx), z: y0 * Math.sin(rx) + z1 * Math.cos(rx) };
    }),
  };
}

export function libraryMolecule(entry: LibraryEntry): Molecule {
  const hit = cache.get(entry.name);
  if (hit) return hit;
  const mol = entry.special
    ? obliqueView(specialStructure(entry.special))
    : embed(parseSmiles(entry.smiles!), { seed: entry.name.length * 97 });
  const out = { ...mol, name: entry.name, source: 'library' as const };
  cache.set(entry.name, out);
  return out;
}

function fromLibrary(entry: LibraryEntry, alternatives: Alternative[] = []): Resolved {
  const molecule = libraryMolecule(entry);
  const { composition, charge } = entry.formula ? parseFormula(entry.formula) : compositionOf(molecule);
  return {
    molecule,
    name: entry.name,
    composition,
    charge,
    displayFormula: entry.display ?? conventionalFormula(composition, charge),
    isCluster: totalAtoms(composition) !== molecule.atoms.length,
    source: entry.special ? 'crystal' : 'library',
    sourceLabel: entry.special ? 'Curated crystal / cluster model' : 'Curated library · geometry optimised in-browser',
    description: entry.blurb,
    alternatives,
    category: entry.category,
  };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function findLibraryByName(query: string): LibraryEntry | undefined {
  const q = norm(query);
  return LIBRARY.find((e) => norm(e.name) === q || e.aliases?.some((a) => norm(a) === q));
}

export function libraryByFormula(key: string): LibraryEntry[] {
  return libraryIndex()
    .filter((x) => x.key === key)
    .map((x) => x.entry)
    .sort((a, b) => Number(!!b.preferred) - Number(!!a.preferred));
}

export function searchLibrary(query: string, limit = 8): LibraryEntry[] {
  const q = norm(query);
  if (!q) return [];
  const scored = libraryIndex()
    .map(({ entry, key, shown }) => {
      const names = [entry.name, ...(entry.aliases ?? [])].map(norm);
      let score = 0;
      if (names.some((n) => n === q)) score = 100;
      else if (names.some((n) => n.startsWith(q))) score = 60;
      else if (names.some((n) => n.includes(q))) score = 30;
      else if (key.toLowerCase() === q || shown === q) score = 80;
      else if (key.toLowerCase().startsWith(q) || shown.startsWith(q)) score = 20;
      return { entry, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.entry);
}

/* ---------- offline resolution ---------- */

export type ResolveError = { error: string };

/**
 * Synchronous, offline resolution. Returns null when the query should be tried online
 * (formula not in the library, or an unknown name).
 */
export function resolveOffline(query: string, opts: { allowGenerated: boolean }): Resolved | ResolveError | null {
  const q = query.trim();
  if (!q) return { error: 'Type a formula, name or SMILES string.' };

  const byName = findLibraryByName(q);
  if (byName) {
    const key = libraryIndex().find((x) => x.entry === byName)!.key;
    const alternatives = libraryByFormula(key)
      .filter((e) => e !== byName)
      .map((e) => ({ label: e.name, query: e.name }));
    return fromLibrary(byName, alternatives);
  }

  if (/^smiles:/i.test(q)) return fromSmiles(q.replace(/^smiles:/i, '').trim());

  let parsed: ReturnType<typeof parseFormula> | null = null;
  let formulaError: string | null = null;
  try {
    parsed = parseFormula(q);
  } catch (e) {
    formulaError = e instanceof FormulaError ? e.message : String(e);
  }
  // "CCO", "CC(C)C", "c1ccccc1" read as SMILES; "CO", "CH4", "NaCl" read as formulas
  const smilesFirst =
    (looksLikeSmiles(q) && (!parsed || !/\d/.test(q))) ||
    (!!parsed && !/\d/.test(q) && !parsed.composition.H && !!parsed.composition.C && q.length >= 3 && /^[BCNOPSFIl()=#]+$/.test(q));
  if (smilesFirst) {
    try {
      return fromSmiles(q);
    } catch {
      /* not valid SMILES either — fall back to formula handling */
    }
  }
  if (!parsed) {
    if (formulaError && /^[A-Z]/.test(q) && /\d/.test(q)) return { error: formulaError };
    return null; // probably a compound name → try PubChem
  }
  const key = compositionKey(parsed.composition, parsed.charge);
  const matches = libraryByFormula(key);
  if (matches.length) {
    const r = fromLibrary(
      matches[0],
      matches.slice(1).map((e) => ({ label: e.name, query: e.name })),
    );
    return { ...r, displayFormula: parsed.text };
  }
  if (!opts.allowGenerated) return null;
  const g = generated(parsed.composition, parsed.charge);
  return isError(g) ? g : { ...g, displayFormula: parsed.text, name: parsed.text };
}

function isFormula(q: string): boolean {
  try {
    parseFormula(q);
    return true;
  } catch {
    return false;
  }
}

function fromSmiles(smiles: string): Resolved {
  const graph = parseSmiles(smiles);
  const molecule = { ...embed(graph), source: 'smiles' as const };
  const { composition, charge } = compositionOf(molecule);
  const matches = libraryByFormula(compositionKey(composition, charge));
  return {
    molecule,
    name: 'Custom SMILES structure',
    composition,
    charge,
    displayFormula: conventionalFormula(composition, charge),
    isCluster: false,
    source: 'smiles',
    sourceLabel: 'Parsed from SMILES · geometry optimised in-browser',
    note: smiles,
    alternatives: matches.map((e) => ({ label: e.name, query: e.name })),
  };
}

export function generated(composition: Composition, charge: number): Resolved | ResolveError {
  const total = Object.values(composition).reduce((a, b) => a + b, 0);
  if (total > 400) return { error: 'That formula is too large to build without a database structure.' };
  const built = buildFromComposition(composition, charge, parseSmiles);
  const mol = built.hasCoordinates ? orientPrincipal(built.mol) : embed(built.mol, { attempts: total > 60 ? 1 : 3 });
  const kindLabel =
    built.kind === 'ionic'
      ? 'Ionic formula unit'
      : built.kind === 'metal'
        ? 'Metallic lattice'
        : built.kind === 'atom'
          ? 'Single atom / ion'
          : 'Generated isomer';
  let note = built.mol.note;
  if (built.kind === 'covalent') {
    note =
      built.defects === 0
        ? 'A molecular formula can describe several isomers — this is one chemically valid arrangement built from valence rules.'
        : 'No closed-shell structure satisfies normal valences for this formula; showing the closest arrangement (it may be a radical or unstable species).';
  }
  return {
    molecule: { ...mol, source: 'generated' },
    name: conventionalFormula(composition, charge),
    composition,
    charge,
    displayFormula: conventionalFormula(composition, charge),
    isCluster: totalAtoms(composition) !== mol.atoms.length,
    source: 'generated',
    sourceLabel: `${kindLabel} · built from formula`,
    note,
    alternatives: [],
  };
}

/* ---------- online resolution (PubChem) ---------- */

export async function resolveOnline(query: string, signal?: AbortSignal): Promise<Resolved | null> {
  const q = query.trim();
  let cids: number[] = [];
  let alternatives: Alternative[] = [];
  const cidMatch = q.match(/^cid:\s*(\d+)$/i);
  let formulaQuery = false;
  if (cidMatch) cids = [Number(cidMatch[1])];
  else if (isFormula(q) && /^[A-Z]/.test(q)) {
    const parsed = parseFormula(q);
    if (parsed.charge) return null;
    formulaQuery = true;
    cids = await pubchem.cidsByFormula(hillFormula(parsed.composition), signal);
  } else {
    cids = await pubchem.cidsByName(q, signal);
  }
  if (!cids.length) return null;
  const top = cids.slice(0, formulaQuery ? 8 : 1);
  const props = await pubchem.properties(top, signal);
  const chosen = props[0];
  if (!chosen) return null;
  if (formulaQuery) {
    alternatives = props.slice(1, 7).map((p) => ({ label: p.title, query: `cid:${p.cid}` }));
  }
  const [st, desc] = await Promise.all([
    pubchem.structure(chosen.cid, signal),
    pubchem.description(chosen.cid, signal).catch(() => undefined),
  ]);
  if (!st) return null;
  const molecule: Molecule = {
    ...(st.needsEmbed ? embed(st.mol, { attempts: 1 }) : orientPrincipal(st.mol)),
    name: chosen.title,
    source: 'pubchem',
  };
  const { composition, charge } = compositionOf(molecule);
  return {
    molecule,
    name: chosen.title,
    composition,
    charge,
    displayFormula: conventionalFormula(composition, charge),
    isCluster: false,
    source: 'pubchem',
    sourceLabel: st.needsEmbed ? `PubChem CID ${chosen.cid} · 3D generated in-browser` : `PubChem CID ${chosen.cid} · computed 3D conformer`,
    description: desc,
    alternatives,
    cid: chosen.cid,
  };
}

export function isError(x: unknown): x is ResolveError {
  return !!x && typeof x === 'object' && 'error' in x;
}
