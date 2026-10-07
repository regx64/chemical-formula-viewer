export interface Atom {
  el: string;
  x: number;
  y: number;
  z: number;
  charge: number;
  aromatic?: boolean;
}

/** order: 1, 2, 3, 1.5 (aromatic) or 0 (ionic contact, drawn dashed) */
export interface Bond {
  a: number;
  b: number;
  order: number;
}

export type StructureSource = 'library' | 'pubchem' | 'smiles' | 'generated' | 'crystal';

export interface Molecule {
  atoms: Atom[];
  bonds: Bond[];
  name?: string;
  source?: StructureSource;
  /** Human-readable notes, e.g. "Generated from formula — one possible isomer" */
  note?: string;
}

export type Vec3 = [number, number, number];
