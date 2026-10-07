import type { Atom, Bond, Molecule } from './types';

const PHI = (1 + Math.sqrt(5)) / 2;

function bondsByDistance(atoms: Atom[], maxD: number, order: (i: number, j: number) => number = () => 1): Bond[] {
  const bonds: Bond[] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = Math.hypot(atoms[i].x - atoms[j].x, atoms[i].y - atoms[j].y, atoms[i].z - atoms[j].z);
      if (d <= maxD) bonds.push({ a: i, b: j, order: order(i, j) });
    }
  }
  return bonds;
}

/** C60: vertices of a truncated icosahedron, 6:6 edges drawn as double bonds (Kekulé structure). */
export function buckminsterfullerene(): Molecule {
  const raw: [number, number, number][] = [];
  const evenPerms = (v: [number, number, number]) => [v, [v[1], v[2], v[0]], [v[2], v[0], v[1]]] as [number, number, number][];
  const signs = (v: [number, number, number]) => {
    const out: [number, number, number][] = [];
    for (const sx of v[0] ? [1, -1] : [1])
      for (const sy of v[1] ? [1, -1] : [1]) for (const sz of v[2] ? [1, -1] : [1]) out.push([v[0] * sx, v[1] * sy, v[2] * sz]);
    return out;
  };
  for (const base of [
    [0, 1, 3 * PHI],
    [1, 2 + PHI, 2 * PHI],
    [PHI, 2, PHI ** 3],
  ] as [number, number, number][]) {
    for (const s of signs(base)) for (const p of evenPerms(s)) raw.push(p);
  }
  // edge length of this construction is 2 → scale to the mean C60 bond length (≈1.42 Å)
  const k = 1.42 / 2;
  const atoms: Atom[] = raw.map(([x, y, z]) => ({ el: 'C', x: x * k, y: y * k, z: z * k, charge: 0 }));
  const bonds = bondsByDistance(atoms, 1.5);
  // find pentagons; edges not in any pentagon are 6:6 → double
  const adj: number[][] = atoms.map(() => []);
  bonds.forEach((b) => {
    adj[b.a].push(b.b);
    adj[b.b].push(b.a);
  });
  const inPentagon = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let s = 0; s < atoms.length; s++) {
    const walk = (path: number[]) => {
      if (path.length === 5) {
        if (adj[path[4]].includes(s)) for (let i = 0; i < 5; i++) inPentagon.add(key(path[i], path[(i + 1) % 5]));
        return;
      }
      for (const n of adj[path[path.length - 1]]) if (!path.includes(n) && n > s) walk([...path, n]);
    };
    walk([s]);
  }
  for (const b of bonds) b.order = inPentagon.has(key(b.a, b.b)) ? 1 : 2;
  return { atoms, bonds, name: 'Buckminsterfullerene', source: 'crystal' };
}

/** 3×3×3 rock-salt cluster; ionic contacts as order-0 bonds. */
export function rockSalt(): Molecule {
  const a = 2.82; // Na–Cl distance
  const atoms: Atom[] = [];
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const na = (i + j + k) % 2 === 0;
        atoms.push({ el: na ? 'Na' : 'Cl', x: i * a, y: j * a, z: k * a, charge: na ? 1 : -1 });
      }
  return { atoms, bonds: bondsByDistance(atoms, a + 0.01, () => 0), name: 'Sodium chloride', source: 'crystal' };
}

/** Diamond cubic fragment: every carbon within a sphere around a central atom. */
export function diamond(): Molecule {
  const a = 3.567;
  const basis = [
    [0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0],
    [0.25, 0.25, 0.25], [0.25, 0.75, 0.75], [0.75, 0.25, 0.75], [0.75, 0.75, 0.25],
  ];
  const atoms: Atom[] = [];
  const r = 4.6;
  for (let i = -2; i <= 1; i++)
    for (let j = -2; j <= 1; j++)
      for (let k = -2; k <= 1; k++)
        for (const b of basis) {
          const x = (i + b[0]) * a;
          const y = (j + b[1]) * a;
          const z = (k + b[2]) * a;
          if (Math.hypot(x, y, z) <= r) atoms.push({ el: 'C', x, y, z, charge: 0 });
        }
  return { atoms, bonds: bondsByDistance(atoms, 1.6), name: 'Diamond', source: 'crystal' };
}

/** Hexagonal graphene flake. */
export function graphene(): Molecule {
  const d = 1.42;
  const atoms: Atom[] = [];
  const a1 = [1.5 * d, (Math.sqrt(3) / 2) * d];
  const a2 = [1.5 * d, (-Math.sqrt(3) / 2) * d];
  for (let i = -4; i <= 4; i++)
    for (let j = -4; j <= 4; j++) {
      for (const off of [0, d]) {
        const x = i * a1[0] + j * a2[0] + off;
        const y = i * a1[1] + j * a2[1];
        if (Math.hypot(x - d / 2, y) <= 7.2) atoms.push({ el: 'C', x, y, z: 0, charge: 0 });
      }
    }
  return { atoms, bonds: bondsByDistance(atoms, d + 0.05, () => 1.5), name: 'Graphene', source: 'crystal' };
}

export function specialStructure(kind: 'c60' | 'nacl' | 'diamond' | 'graphene'): Molecule {
  switch (kind) {
    case 'c60':
      return buckminsterfullerene();
    case 'nacl':
      return rockSalt();
    case 'diamond':
      return diamond();
    case 'graphene':
      return graphene();
  }
}
