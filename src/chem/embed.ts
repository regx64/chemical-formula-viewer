import { ELEMENT_BY_SYMBOL, isMetal, valenceElectrons } from './elements';
import { add, alignRotate, cross, jacobiEigen, normalize, randomUnit, rng, rotate, scale } from './geometry';
import type { Molecule, Vec3 } from './types';

/* ------------------------------------------------------------------------------------------------
 * 3D coordinate generation.
 *
 * 1. VSEPR: every atom gets a steric number (σ-neighbours + lone pairs) which selects an ideal
 *    electron-domain template (linear … octahedral). Lone pairs take their preferred slots
 *    (equatorial in a trigonal bipyramid, trans in an octahedron), so SF4, ClF3, XeF4 etc. come out right.
 * 2. A spanning-tree walk places atoms using those templates (good starting geometry).
 * 3. A small distance-geometry force field (bond lengths, 1-3 distances from ideal angles,
 *    π-system coplanarity and soft van der Waals repulsion) is minimised with FIRE.
 * ---------------------------------------------------------------------------------------------- */

const SQ3 = Math.sqrt(3) / 2;
const TEMPLATES: Record<number, { dirs: Vec3[]; lpOrder: number[] }> = {
  1: { dirs: [[1, 0, 0]], lpOrder: [0] },
  2: { dirs: [[1, 0, 0], [-1, 0, 0]], lpOrder: [0, 1] },
  3: { dirs: [[1, 0, 0], [-0.5, SQ3, 0], [-0.5, -SQ3, 0]], lpOrder: [0, 1, 2] },
  4: {
    dirs: [normalize([1, 1, 1]), normalize([1, -1, -1]), normalize([-1, 1, -1]), normalize([-1, -1, 1])],
    lpOrder: [0, 1, 2, 3],
  },
  5: { dirs: [[1, 0, 0], [-0.5, SQ3, 0], [-0.5, -SQ3, 0], [0, 0, 1], [0, 0, -1]], lpOrder: [0, 1, 2, 3, 4] },
  6: { dirs: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], lpOrder: [0, 1, 2, 3, 4, 5] },
  7: {
    dirs: [
      [0, 0, 1],
      [0, 0, -1],
      ...Array.from({ length: 5 }, (_, k): Vec3 => [Math.cos((2 * Math.PI * k) / 5), Math.sin((2 * Math.PI * k) / 5), 0]),
    ],
    lpOrder: [0, 1, 2, 3, 4, 5, 6],
  },
};

function fibonacciSphere(n: number): Vec3[] {
  const out: Vec3[] = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]);
  }
  return out;
}

export interface Neighbor {
  atom: number;
  order: number;
}

export function adjacency(mol: Molecule): Neighbor[][] {
  const adj: Neighbor[][] = mol.atoms.map(() => []);
  for (const b of mol.bonds) {
    adj[b.a].push({ atom: b.b, order: b.order });
    adj[b.b].push({ atom: b.a, order: b.order });
  }
  return adj;
}

export function lonePairs(el: string, charge: number, bondOrderSum: number): number {
  if (el === 'H' || isMetal(el)) return 0;
  const ve = valenceElectrons(el);
  return Math.max(0, Math.floor((ve - bondOrderSum - charge) / 2 + 1e-9));
}

export function idealBondLength(a: string, b: string, order: number): number {
  const ra = ELEMENT_BY_SYMBOL[a]?.cov ?? 1.5;
  const rb = ELEMENT_BY_SYMBOL[b]?.cov ?? 1.5;
  let r = ra + rb;
  // Schomaker–Stevenson style electronegativity shortening for polar bonds
  const ea = ELEMENT_BY_SYMBOL[a]?.en || 2;
  const eb = ELEMENT_BY_SYMBOL[b]?.en || 2;
  r -= 0.05 * Math.abs(ea - eb);
  if (order === 0) return (ra + rb) * 1.12; // ionic contact
  if (order === 1.5) return r * 0.92;
  if (order === 2) return r * 0.87;
  if (order >= 3) return r * 0.78;
  return r;
}

interface AtomGeometry {
  sn: number;
  lp: number;
  /** template direction assigned to each neighbour (same order as adjacency list) */
  slots: Vec3[];
  /** override angle (deg) used for every neighbour pair when the template is symmetric */
  angle?: number;
}

export function atomGeometry(mol: Molecule, adj: Neighbor[][], i: number): AtomGeometry {
  const covalent = adj[i].filter((n) => n.order > 0);
  const k = covalent.length;
  const atom = mol.atoms[i];
  const orderSum = covalent.reduce((s, n) => s + n.order, 0);
  let lp = lonePairs(atom.el, atom.charge, orderSum);
  let sn = k + lp;
  if (sn > 7) {
    lp = Math.max(0, 7 - k);
    sn = k + lp;
  }
  const tpl = TEMPLATES[sn] ?? { dirs: fibonacciSphere(sn), lpOrder: [...Array(sn).keys()] };
  const lpSlots = new Set(tpl.lpOrder.slice(0, lp));
  const ligandDirs = tpl.dirs.filter((_, idx) => !lpSlots.has(idx));
  const slots: Vec3[] = [];
  let ci = 0;
  const extra = fibonacciSphere(adj[i].length + 1);
  adj[i].forEach((n, idx) => {
    slots.push(n.order > 0 ? (ligandDirs[ci++] ?? extra[idx]) : extra[idx]);
  });
  let angle: number | undefined;
  if (sn === 4 && lp === 1) angle = 107;
  else if (sn === 4 && lp === 2) angle = 104.5;
  else if (sn === 3 && lp === 1) angle = 118;
  return { sn, lp, slots, angle };
}

interface ForceField {
  pairs: { i: number; j: number; d0: number; k: number }[];
  planes: { a: number; b: number; c: number; d: number }[];
  repulse: { i: number; j: number; lb: number }[];
}

function buildForceField(mol: Molecule, adj: Neighbor[][], geo: AtomGeometry[]): ForceField {
  const n = mol.atoms.length;
  const pairs: ForceField['pairs'] = [];
  const close = new Set<number>();
  const key = (i: number, j: number) => (i < j ? i * n + j : j * n + i);
  for (const b of mol.bonds) {
    const d0 = idealBondLength(mol.atoms[b.a].el, mol.atoms[b.b].el, b.order);
    pairs.push({ i: b.a, j: b.b, d0, k: b.order === 0 ? 40 : 120 });
    close.add(key(b.a, b.b));
  }
  const bondLen = (i: number, j: number) => {
    const nb = adj[i].find((x) => x.atom === j)!;
    return idealBondLength(mol.atoms[i].el, mol.atoms[j].el, nb.order);
  };
  for (let c = 0; c < n; c++) {
    const nbs = adj[c];
    if (nbs.length < 2) continue;
    for (let x = 0; x < nbs.length; x++) {
      for (let y = x + 1; y < nbs.length; y++) {
        const i = nbs[x].atom;
        const j = nbs[y].atom;
        if (close.has(key(i, j))) continue;
        if (nbs[x].order === 0 || nbs[y].order === 0) continue;
        const g = geo[c];
        const cos = g.angle !== undefined ? Math.cos((g.angle * Math.PI) / 180) : dotV(g.slots[x], g.slots[y]);
        const r1 = bondLen(c, i);
        const r2 = bondLen(c, j);
        const d0 = Math.sqrt(Math.max(0.01, r1 * r1 + r2 * r2 - 2 * r1 * r2 * cos));
        pairs.push({ i, j, d0, k: 60 });
        close.add(key(i, j));
      }
    }
  }
  const planes: ForceField['planes'] = [];
  for (const b of mol.bonds) {
    if (b.order !== 2 && b.order !== 1.5) continue;
    if (geo[b.a].sn === 2 || geo[b.b].sn === 2) continue;
    for (const na of adj[b.a]) {
      if (na.atom === b.b || na.order === 0) continue;
      for (const nb of adj[b.b]) {
        if (nb.atom === b.a || nb.order === 0) continue;
        planes.push({ a: na.atom, b: b.a, c: b.b, d: nb.atom });
      }
    }
  }
  const repulse: ForceField['repulse'] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (close.has(key(i, j))) continue;
      const vi = ELEMENT_BY_SYMBOL[mol.atoms[i].el]?.vdw ?? 2;
      const vj = ELEMENT_BY_SYMBOL[mol.atoms[j].el]?.vdw ?? 2;
      repulse.push({ i, j, lb: 0.78 * (vi + vj) });
    }
  }
  return { pairs, planes, repulse };
}

const dotV = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function energyAndGradient(ff: ForceField, x: Float64Array, g: Float64Array): number {
  g.fill(0);
  let e = 0;
  for (const p of ff.pairs) {
    const i3 = p.i * 3;
    const j3 = p.j * 3;
    const dx = x[i3] - x[j3];
    const dy = x[i3 + 1] - x[j3 + 1];
    const dz = x[i3 + 2] - x[j3 + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const diff = d - p.d0;
    e += p.k * diff * diff;
    const f = (2 * p.k * diff) / d;
    g[i3] += f * dx;
    g[i3 + 1] += f * dy;
    g[i3 + 2] += f * dz;
    g[j3] -= f * dx;
    g[j3 + 1] -= f * dy;
    g[j3 + 2] -= f * dz;
  }
  for (const r of ff.repulse) {
    const i3 = r.i * 3;
    const j3 = r.j * 3;
    const dx = x[i3] - x[j3];
    const dy = x[i3 + 1] - x[j3 + 1];
    const dz = x[i3 + 2] - x[j3 + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r.lb * r.lb) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const diff = d - r.lb;
    const k = 12;
    e += k * diff * diff;
    const f = (2 * k * diff) / d;
    g[i3] += f * dx;
    g[i3 + 1] += f * dy;
    g[i3 + 2] += f * dz;
    g[j3] -= f * dx;
    g[j3 + 1] -= f * dy;
    g[j3 + 2] -= f * dz;
  }
  const kp = 25;
  for (const pl of ff.planes) {
    const a3 = pl.a * 3;
    const b3 = pl.b * 3;
    const c3 = pl.c * 3;
    const d3 = pl.d * 3;
    const u: Vec3 = [x[b3] - x[a3], x[b3 + 1] - x[a3 + 1], x[b3 + 2] - x[a3 + 2]];
    const v: Vec3 = [x[c3] - x[a3], x[c3 + 1] - x[a3 + 1], x[c3 + 2] - x[a3 + 2]];
    const w: Vec3 = [x[d3] - x[a3], x[d3 + 1] - x[a3 + 1], x[d3 + 2] - x[a3 + 2]];
    const vw = cross(v, w);
    const vol = dotV(u, vw);
    e += kp * vol * vol;
    const f = 2 * kp * vol;
    const gu = vw;
    const gv = cross(w, u);
    const gw = cross(u, v);
    for (let k = 0; k < 3; k++) {
      g[b3 + k] += f * gu[k];
      g[c3 + k] += f * gv[k];
      g[d3 + k] += f * gw[k];
      g[a3 + k] -= f * (gu[k] + gv[k] + gw[k]);
    }
  }
  return e;
}

/** FIRE minimiser (Bitzek et al. 2006). */
function minimize(ff: ForceField, x: Float64Array, maxSteps: number): number {
  const n = x.length;
  const g = new Float64Array(n);
  const v = new Float64Array(n);
  let dt = 0.01;
  const dtMax = 0.05;
  let alpha = 0.1;
  let positiveSteps = 0;
  let e = energyAndGradient(ff, x, g);
  for (let step = 0; step < maxSteps; step++) {
    let p = 0;
    let vn = 0;
    let fn = 0;
    for (let k = 0; k < n; k++) {
      p += -g[k] * v[k];
      vn += v[k] * v[k];
      fn += g[k] * g[k];
    }
    if (fn < 1e-8) break;
    vn = Math.sqrt(vn);
    fn = Math.sqrt(fn);
    if (p > 0) {
      for (let k = 0; k < n; k++) v[k] = (1 - alpha) * v[k] + (alpha * vn * -g[k]) / fn;
      if (++positiveSteps > 5) {
        dt = Math.min(dt * 1.1, dtMax);
        alpha *= 0.99;
      }
    } else {
      v.fill(0);
      dt *= 0.5;
      alpha = 0.1;
      positiveSteps = 0;
    }
    for (let k = 0; k < n; k++) {
      v[k] += -g[k] * dt;
      let dx = v[k] * dt;
      if (dx > 0.2) dx = 0.2;
      else if (dx < -0.2) dx = -0.2;
      x[k] += dx;
    }
    e = energyAndGradient(ff, x, g);
  }
  return e;
}

function initialPlacement(mol: Molecule, adj: Neighbor[][], geo: AtomGeometry[], rand: () => number): Float64Array {
  const n = mol.atoms.length;
  const pos: (Vec3 | null)[] = new Array(n).fill(null);
  // frame rotation applied to each atom's template (maps template space → world)
  const frames: ((v: Vec3) => Vec3)[] = new Array(n);
  let offsetX = 0;
  // start with the most connected atom of each component for a compact tree
  const order = [...Array(n).keys()].sort((a, b) => adj[b].length - adj[a].length);
  for (const root of order) {
    if (pos[root]) continue;
    pos[root] = [offsetX, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.1];
    const axis = randomUnit(rand);
    const ang = rand() * Math.PI * 2;
    frames[root] = (v) => rotate(v, axis, ang);
    const queue = [root];
    let maxX = offsetX;
    while (queue.length) {
      const c = queue.shift()!;
      const pc = pos[c]!;
      maxX = Math.max(maxX, pc[0]);
      adj[c].forEach((nb, idx) => {
        if (pos[nb.atom]) return;
        const dir = normalize(frames[c](geo[c].slots[idx]));
        const len = idealBondLength(mol.atoms[c].el, mol.atoms[nb.atom].el, nb.order);
        const jitter: Vec3 = [(rand() - 0.5) * 0.15, (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.15];
        pos[nb.atom] = add(add(pc, scale(dir, len)), jitter);
        // child's frame: its slot pointing back to the parent must align with -dir
        const back = scale(dir, -1);
        const childNbIdx = adj[nb.atom].findIndex((x) => x.atom === c);
        const childSlot = normalize(geo[nb.atom].slots[childNbIdx] ?? [1, 0, 0]);
        const twist = rand() * Math.PI * 2;
        frames[nb.atom] = (v) => rotate(alignRotate(v, childSlot, back), back, twist);
        queue.push(nb.atom);
      });
    }
    offsetX = maxX + 3.5;
  }
  const x = new Float64Array(n * 3);
  pos.forEach((p, i) => {
    x[i * 3] = p![0];
    x[i * 3 + 1] = p![1];
    x[i * 3 + 2] = p![2];
  });
  return x;
}

/** Centre at the origin and rotate onto principal axes (longest extent along x). */
export function orientPrincipal(mol: Molecule): Molecule {
  const n = mol.atoms.length;
  if (!n) return mol;
  const c: Vec3 = [0, 0, 0];
  for (const a of mol.atoms) {
    c[0] += a.x / n;
    c[1] += a.y / n;
    c[2] += a.z / n;
  }
  const pts: Vec3[] = mol.atoms.map((a) => [a.x - c[0], a.y - c[1], a.z - c[2]]);
  if (n < 2) {
    return { ...mol, atoms: mol.atoms.map((a, i) => ({ ...a, x: pts[i][0], y: pts[i][1], z: pts[i][2] })) };
  }
  const cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of pts) for (let r = 0; r < 3; r++) for (let s = 0; s < 3; s++) cov[r][s] += p[r] * p[s];
  const { values, vectors } = jacobiEigen(cov);
  const idx = [0, 1, 2].sort((a, b) => values[b] - values[a]);
  const ax = vectors[idx[0]] as Vec3;
  const ay = vectors[idx[1]] as Vec3;
  const az = cross(ax, ay);
  const atoms = mol.atoms.map((a, i) => {
    const p = pts[i];
    return { ...a, x: dotV(p, ax), y: dotV(p, ay), z: dotV(p, az) };
  });
  return { ...mol, atoms };
}

export interface EmbedOptions {
  seed?: number;
  attempts?: number;
}

/** Generate 3D coordinates for a molecular graph (coordinates on input are ignored). */
export function embed(mol: Molecule, opts: EmbedOptions = {}): Molecule {
  const n = mol.atoms.length;
  if (n === 0) return mol;
  if (n === 1) return { ...mol, atoms: [{ ...mol.atoms[0], x: 0, y: 0, z: 0 }] };
  const adj = adjacency(mol);
  const geo = mol.atoms.map((_, i) => atomGeometry(mol, adj, i));
  const ff = buildForceField(mol, adj, geo);
  const attempts = opts.attempts ?? (n > 120 ? 1 : n > 60 ? 2 : 4);
  const steps = n > 150 ? 1500 : 2500;
  let best: Float64Array | null = null;
  let bestE = Infinity;
  const rand = rng(opts.seed ?? 7);
  for (let t = 0; t < attempts; t++) {
    const x = initialPlacement(mol, adj, geo, rand);
    const e = minimize(ff, x, steps);
    if (e < bestE) {
      bestE = e;
      best = x;
    }
    if (bestE < 1e-3) break;
  }
  const atoms = mol.atoms.map((a, i) => ({ ...a, x: best![i * 3], y: best![i * 3 + 1], z: best![i * 3 + 2] }));
  return orientPrincipal({ ...mol, atoms });
}

/** Residual strain energy of a molecule's current coordinates under the ideal force field (testing aid). */
export function strain(mol: Molecule): number {
  const adj = adjacency(mol);
  const geo = mol.atoms.map((_, i) => atomGeometry(mol, adj, i));
  const ff = buildForceField(mol, adj, geo);
  const x = new Float64Array(mol.atoms.flatMap((a) => [a.x, a.y, a.z]));
  return energyAndGradient(ff, x, new Float64Array(x.length));
}
