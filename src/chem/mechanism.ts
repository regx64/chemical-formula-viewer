import { add, randomUnit, rng, rotate, scale, sub, superpose, length } from './geometry';
import type { Molecule, Vec3 } from './types';

/* ------------------------------------------------------------------------------------------------
 * Builds the choreography for the 3D reaction animation.
 *
 * Every reactant atom is mapped onto a product atom of the same element (Hungarian assignment),
 * and product molecules are rigidly superposed (Horn/Kabsch) onto the reactant atoms they inherit,
 * iterating so that atoms travel as little as possible. Bonds are classified as broken, formed or
 * kept, which drives their fade/stretch in the renderer.
 * ---------------------------------------------------------------------------------------------- */

export interface MechanismSpecies {
  molecule: Molecule;
  coefficient: number;
}

export interface MechanismBond {
  a: number;
  b: number;
  /** order in reactants, null when the bond forms during the reaction */
  from: number | null;
  /** order in products, null when the bond breaks */
  to: number | null;
}

export interface Mechanism {
  elements: string[];
  charges: number[];
  /** reactant molecules spread apart */
  start: Vec3[];
  /** reactants packed together, ready to collide */
  contact: Vec3[];
  /** products, still overlapping the reaction zone */
  formed: Vec3[];
  /** products drifting apart */
  end: Vec3[];
  bonds: MechanismBond[];
  /** molecule-instance index for each atom on each side (for halos/labels) */
  reactantInstance: number[];
  productInstance: number[];
  radius: number;
  truncated: boolean;
}

interface Instance {
  local: Vec3[];
  elements: string[];
  charges: number[];
  bonds: { a: number; b: number; order: number }[];
  radius: number;
}

function instances(species: MechanismSpecies[], rand: () => number, maxAtoms: number): { list: Instance[]; truncated: boolean } {
  const list: Instance[] = [];
  let total = 0;
  let truncated = false;
  for (const s of species) {
    const m = s.molecule;
    const n = m.atoms.length;
    const cx = m.atoms.reduce((t, a) => t + a.x, 0) / n;
    const cy = m.atoms.reduce((t, a) => t + a.y, 0) / n;
    const cz = m.atoms.reduce((t, a) => t + a.z, 0) / n;
    for (let k = 0; k < s.coefficient; k++) {
      total += n;
      if (total > maxAtoms) truncated = true;
      const axis = randomUnit(rand);
      const ang = rand() * Math.PI * 2;
      const local = m.atoms.map((a) => rotate([a.x - cx, a.y - cy, a.z - cz], axis, ang));
      const radius = Math.max(0.8, ...local.map((p) => length(p))) + 0.9;
      list.push({
        local,
        elements: m.atoms.map((a) => a.el),
        charges: m.atoms.map((a) => a.charge),
        bonds: m.bonds.map((b) => ({ ...b })),
        radius,
      });
    }
  }
  return { list, truncated };
}

/** Pack spheres of the given radii around the origin (simple relaxation). */
function pack(radii: number[], rand: () => number, margin: number): Vec3[] {
  const n = radii.length;
  const vol = radii.reduce((s, r) => s + (r + margin) ** 3, 0);
  const R0 = Math.cbrt(vol) * 0.9;
  const pos: Vec3[] = radii.map(() => scale(randomUnit(rand), R0 * Math.cbrt(rand())));
  if (n === 1) return [[0, 0, 0]];
  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < n; i++) {
      pos[i] = scale(pos[i], 0.985); // gentle pull to the centre
      for (let j = i + 1; j < n; j++) {
        const d = sub(pos[j], pos[i]);
        const L = length(d) || 1e-3;
        const min = radii[i] + radii[j] + margin;
        if (L < min) {
          const push = scale(d, ((min - L) / L) * 0.5);
          pos[i] = sub(pos[i], push);
          pos[j] = add(pos[j], push);
        }
      }
    }
  }
  const c = pos.reduce((acc, p) => add(acc, scale(p, 1 / n)), [0, 0, 0] as Vec3);
  return pos.map((p) => sub(p, c));
}

/** Hungarian algorithm (min-cost perfect assignment) for a square cost matrix. */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  return assignment;
}

const d2 = (a: Vec3, b: Vec3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function buildMechanism(reactants: MechanismSpecies[], products: MechanismSpecies[], seed = 11): Mechanism {
  const rand = rng(seed);
  const MAX = 420;
  const R = instances(reactants, rand, MAX);
  const P = instances(products, rand, MAX);

  // reactant layout (packed) — the reference frame for everything else
  const rCenters = pack(R.list.map((i) => i.radius), rand, 0.2);
  const contact: Vec3[] = [];
  const elements: string[] = [];
  const charges: number[] = [];
  const reactantInstance: number[] = [];
  R.list.forEach((inst, k) => {
    inst.local.forEach((p, i) => {
      contact.push(add(p, rCenters[k]));
      elements.push(inst.elements[i]);
      charges.push(inst.charges[i]);
      reactantInstance.push(k);
    });
  });
  const start: Vec3[] = [];
  R.list.forEach((inst, k) => inst.local.forEach((p) => start.push(add(p, scale(rCenters[k], 1.9)))));

  // product atoms (flattened), initial placement by packing
  const pFlat: { inst: number; idx: number; el: string }[] = [];
  P.list.forEach((inst, k) => inst.elements.forEach((el, idx) => pFlat.push({ inst: k, idx, el })));
  if (pFlat.length !== contact.length) throw new Error('Atom counts differ between reactants and products');
  let pCenters = pack(P.list.map((i) => i.radius), rand, 0.2);
  let placement: Vec3[][] = P.list.map((inst, k) => inst.local.map((p) => add(p, pCenters[k])));

  // mapping[productFlatIndex] = reactant atom index
  let mapping: number[] = new Array(pFlat.length).fill(-1);
  const byElement = new Map<string, { r: number[]; p: number[] }>();
  elements.forEach((el, i) => {
    if (!byElement.has(el)) byElement.set(el, { r: [], p: [] });
    byElement.get(el)!.r.push(i);
  });
  pFlat.forEach((x, i) => {
    if (!byElement.has(x.el)) throw new Error(`Element ${x.el} missing from reactants`);
    byElement.get(x.el)!.p.push(i);
  });

  const pPos = (i: number) => placement[pFlat[i].inst][pFlat[i].idx];
  for (let iter = 0; iter < 6; iter++) {
    // assignment per element
    for (const { r, p } of byElement.values()) {
      if (r.length !== p.length) throw new Error('Element counts differ between reactants and products');
      const cost = p.map((pi) => r.map((ri) => d2(pPos(pi), contact[ri])));
      const asg = hungarian(cost);
      p.forEach((pi, k) => (mapping[pi] = r[asg[k]]));
    }
    // superpose each product molecule onto its inherited reactant atoms
    placement = P.list.map((inst, k) => {
      const ids = pFlat.map((x, i) => (x.inst === k ? i : -1)).filter((i) => i >= 0);
      const target = ids.map((i) => contact[mapping[i]]);
      const fit = superpose(inst.local, target);
      return inst.local.map((p) => fit(p));
    });
    // separate overlapping products (rigid pushes)
    pCenters = placement.map((pts) => pts.reduce((acc, p) => add(acc, scale(p, 1 / pts.length)), [0, 0, 0] as Vec3));
    for (let it = 0; it < 60; it++) {
      for (let i = 0; i < pCenters.length; i++)
        for (let j = i + 1; j < pCenters.length; j++) {
          const d = sub(pCenters[j], pCenters[i]);
          const L = length(d) || 1e-3;
          const min = (P.list[i].radius + P.list[j].radius) * 0.62;
          if (L < min) {
            const push = scale(L < 1e-2 ? randomUnit(rand) : d, ((min - L) / Math.max(L, 1e-2)) * 0.5);
            pCenters[i] = sub(pCenters[i], push);
            pCenters[j] = add(pCenters[j], push);
          }
        }
    }
    placement = placement.map((pts, k) => {
      const c = pts.reduce((acc, p) => add(acc, scale(p, 1 / pts.length)), [0, 0, 0] as Vec3);
      const shift = sub(pCenters[k], c);
      return pts.map((p) => add(p, shift));
    });
  }

  // final arrays indexed by reactant atom
  const formed: Vec3[] = new Array(contact.length);
  const end: Vec3[] = new Array(contact.length);
  const productInstance: number[] = new Array(contact.length);
  const centroid = contact.reduce((acc, p) => add(acc, scale(p, 1 / contact.length)), [0, 0, 0] as Vec3);
  pFlat.forEach((x, i) => {
    const r = mapping[i];
    formed[r] = pPos(i);
    const c = pCenters[x.inst];
    const out = sub(c, centroid);
    end[r] = add(pPos(i), scale(out, 0.9));
    productInstance[r] = x.inst;
  });

  // bonds: union of reactant and product bonds keyed by reactant atom indices
  const bonds = new Map<string, MechanismBond>();
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  let offset = 0;
  R.list.forEach((inst) => {
    for (const b of inst.bonds) {
      const a = b.a + offset;
      const c = b.b + offset;
      bonds.set(key(a, c), { a: Math.min(a, c), b: Math.max(a, c), from: b.order, to: null });
    }
    offset += inst.local.length;
  });
  const flatIndex: number[][] = [];
  pFlat.forEach((x, i) => {
    (flatIndex[x.inst] ??= [])[x.idx] = i;
  });
  P.list.forEach((inst, k) => {
    for (const b of inst.bonds) {
      const a = mapping[flatIndex[k][b.a]];
      const c = mapping[flatIndex[k][b.b]];
      const existing = bonds.get(key(a, c));
      if (existing) existing.to = b.order;
      else bonds.set(key(a, c), { a: Math.min(a, c), b: Math.max(a, c), from: null, to: b.order });
    }
  });

  const all = [...start, ...end];
  const radius = Math.max(...all.map((p) => length(sub(p, centroid)))) + 1.5;
  const recenter = (arr: Vec3[]) => arr.map((p) => sub(p, centroid));
  return {
    elements,
    charges,
    start: recenter(start),
    contact: recenter(contact),
    formed: recenter(formed),
    end: recenter(end),
    bonds: [...bonds.values()],
    reactantInstance,
    productInstance,
    radius,
    truncated: R.truncated || P.truncated,
  };
}
