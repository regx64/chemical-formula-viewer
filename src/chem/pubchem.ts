import { parseSdf, isFlat } from './sdf';
import type { Molecule } from './types';

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export interface PubChemCompound {
  cid: number;
  title: string;
  formula: string;
  weight?: number;
  iupac?: string;
}

interface PropertyTable {
  PropertyTable: {
    Properties: { CID: number; Title?: string; MolecularFormula: string; MolecularWeight?: string; IUPACName?: string }[];
  };
}

export async function cidsByName(name: string, signal?: AbortSignal): Promise<number[]> {
  const j = await getJson<{ IdentifierList: { CID: number[] } }>(
    `${BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`,
    signal,
  );
  return j?.IdentifierList?.CID ?? [];
}

export async function cidsByFormula(formula: string, signal?: AbortSignal): Promise<number[]> {
  const j = await getJson<{ IdentifierList: { CID: number[] } }>(
    `${BASE}/compound/fastformula/${encodeURIComponent(formula)}/cids/JSON?MaxRecords=40`,
    signal,
  );
  return (j?.IdentifierList?.CID ?? []).slice().sort((a, b) => a - b);
}

export async function properties(cids: number[], signal?: AbortSignal): Promise<PubChemCompound[]> {
  if (!cids.length) return [];
  const j = await getJson<PropertyTable>(
    `${BASE}/compound/cid/${cids.join(',')}/property/Title,MolecularFormula,MolecularWeight,IUPACName/JSON`,
    signal,
  );
  return (j?.PropertyTable?.Properties ?? []).map((p) => ({
    cid: p.CID,
    title: p.Title ?? p.IUPACName ?? `CID ${p.CID}`,
    formula: p.MolecularFormula,
    weight: p.MolecularWeight ? Number(p.MolecularWeight) : undefined,
    iupac: p.IUPACName,
  }));
}

/** Returns the 3D conformer when PubChem has one, else the 2D record flagged for re-embedding. */
export async function structure(cid: number, signal?: AbortSignal): Promise<{ mol: Molecule; needsEmbed: boolean } | null> {
  for (const type of ['3d', '2d'] as const) {
    const res = await fetch(`${BASE}/compound/cid/${cid}/SDF?record_type=${type}`, { signal });
    if (!res.ok) continue;
    const mol = parseSdf(await res.text());
    return { mol, needsEmbed: type === '2d' || isFlat(mol) };
  }
  return null;
}

export async function description(cid: number, signal?: AbortSignal): Promise<string | undefined> {
  const j = await getJson<{ InformationList: { Information: { Description?: string }[] } }>(
    `${BASE}/compound/cid/${cid}/description/JSON`,
    signal,
  );
  const d = j?.InformationList?.Information?.find((i) => i.Description)?.Description;
  if (!d) return undefined;
  // keep the first two sentences — enough for a card
  const sentences = d.match(/[^.!?]+[.!?]+/g) ?? [d];
  return sentences.slice(0, 2).join(' ').trim();
}
