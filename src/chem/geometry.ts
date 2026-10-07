import type { Vec3 } from './types';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function angleDeg(a: Vec3, center: Vec3, b: Vec3): number {
  const u = normalize(sub(a, center));
  const v = normalize(sub(b, center));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}

export function dihedralDeg(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): number {
  const b0 = sub(p0, p1);
  const b1 = normalize(sub(p2, p1));
  const b2 = sub(p3, p2);
  const v = sub(b0, scale(b1, dot(b0, b1)));
  const w = sub(b2, scale(b1, dot(b2, b1)));
  const x = dot(v, w);
  const y = dot(cross(b1, v), w);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Rotate vector v about unit axis k by angle (Rodrigues). */
export function rotate(v: Vec3, k: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}

/** Rotation that maps unit vector `from` onto unit vector `to`, applied to v. */
export function alignRotate(v: Vec3, from: Vec3, to: Vec3): Vec3 {
  const axis = cross(from, to);
  const s = length(axis);
  const c = dot(from, to);
  if (s < 1e-9) {
    if (c > 0) return v;
    // 180°: pick any perpendicular axis
    const perp = normalize(Math.abs(from[0]) < 0.9 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]));
    return rotate(v, perp, Math.PI);
  }
  return rotate(v, scale(axis, 1 / s), Math.atan2(s, c));
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomUnit(rand: () => number): Vec3 {
  const z = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

/** Eigen-decomposition of a symmetric matrix via cyclic Jacobi rotations. */
export function jacobiEigen(m: number[][]): { values: number[]; vectors: number[][] } {
  const n = m.length;
  const a = m.map((r) => r.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = a.map((r, i) => r[i]);
  // vectors as columns → return as array of column vectors
  const vectors = values.map((_, j) => v.map((row) => row[j]));
  return { values, vectors };
}

/**
 * Optimal rigid superposition (Horn's quaternion method).
 * Returns a function that maps a point of `from` into the frame of `to`.
 */
export function superpose(from: Vec3[], to: Vec3[]): (p: Vec3) => Vec3 {
  const n = from.length;
  const cf: Vec3 = [0, 0, 0];
  const ct: Vec3 = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      cf[k] += from[i][k] / n;
      ct[k] += to[i][k] / n;
    }
  }
  if (n < 2) return (p) => add(sub(p, cf), ct);
  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const a = sub(from[i], cf);
    const b = sub(to[i], ct);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += a[r] * b[c];
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const { values, vectors } = jacobiEigen(N);
  let best = 0;
  for (let i = 1; i < 4; i++) if (values[i] > values[best]) best = i;
  const [q0, q1, q2, q3] = vectors[best];
  const R = [
    [q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
    [2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1)],
    [2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3],
  ];
  return (p: Vec3) => {
    const d = sub(p, cf);
    return [
      R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2] + ct[0],
      R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2] + ct[1],
      R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2] + ct[2],
    ];
  };
}
