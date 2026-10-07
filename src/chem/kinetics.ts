import { R } from '../data/thermo';
import { rng } from './geometry';

/* ------------------------------------------------------------------------------------------------
 * Collision-theory kinetics in a 2D box.
 *
 * Molecules move with Maxwell–Boltzmann speeds (v ∝ √(T/M)), collide elastically and react with
 * the Arrhenius probability p = exp(−Ea / (λ·R·T)) per reactive collision. λ compresses the energy
 * scale so reactions happen on a watchable timescale; relative trends with T, Ea and catalysts
 * are preserved. With a reversible equation the reverse reaction uses Ea − ΔH, which drives the
 * system to a dynamic equilibrium.
 * ---------------------------------------------------------------------------------------------- */

export const ENERGY_COMPRESSION = 4;

export interface KineticSpecies {
  label: string;
  color: string;
  coefficient: number;
  side: 'reactant' | 'product';
  molarMass: number;
  atoms: number;
}

export interface KineticsOptions {
  temperature: number;
  ea: number;
  dH: number;
  reversible: boolean;
  catalyst: boolean;
  aspect: number; // height / width
  seed?: number;
  /** multiplier on each reactant's stoichiometric amount, defaults to 1 */
  mixture?: number[];
}

export interface Particle {
  s: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  born: number;
}

export interface Flash {
  x: number;
  y: number;
  t: number;
  color: string;
}

export interface Sample {
  t: number;
  counts: number[];
}

export class KineticsSim {
  species: KineticSpecies[];
  opts: KineticsOptions;
  particles: Particle[] = [];
  flashes: Flash[] = [];
  history: Sample[] = [];
  time = 0;
  forwardEvents = 0;
  reverseEvents = 0;
  private rand: () => number;
  private lastSample = -1;
  private reactants: number[];
  private products: number[];

  constructor(species: KineticSpecies[], opts: KineticsOptions) {
    this.species = species;
    this.opts = { ...opts };
    this.rand = rng(opts.seed ?? 3);
    this.reactants = species.map((s, i) => (s.side === 'reactant' ? i : -1)).filter((i) => i >= 0);
    this.products = species.map((s, i) => (s.side === 'product' ? i : -1)).filter((i) => i >= 0);
    this.reset();
  }

  get width() {
    return 1;
  }
  get height() {
    return this.opts.aspect;
  }

  radiusOf(s: number): number {
    return 0.009 + 0.0042 * Math.cbrt(this.species[s].atoms);
  }

  private thermalVelocity(s: number): [number, number] {
    const sigma = 0.16 * Math.sqrt((this.opts.temperature / 298) * (18 / this.species[s].molarMass));
    // Box–Muller
    const u = Math.max(1e-9, this.rand());
    const v = this.rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    return [sigma * mag * Math.cos(2 * Math.PI * v), sigma * mag * Math.sin(2 * Math.PI * v)];
  }

  private spawn(s: number, x?: number, y?: number, boost = 1): Particle {
    const r = this.radiusOf(s);
    const [vx, vy] = this.thermalVelocity(s);
    return {
      s,
      r,
      x: x ?? r + this.rand() * (this.width - 2 * r),
      y: y ?? r + this.rand() * (this.height - 2 * r),
      vx: vx * boost,
      vy: vy * boost,
      born: this.time,
    };
  }

  reset() {
    this.time = 0;
    this.flashes = [];
    this.history = [];
    this.lastSample = -1;
    this.forwardEvents = 0;
    this.reverseEvents = 0;
    this.particles = [];
    const perUnit = this.reactants.reduce((s, i) => s + this.species[i].coefficient, 0);
    const units = Math.max(1, Math.min(60, Math.floor(140 / perUnit)));
    this.reactants.forEach((i, k) => {
      const mix = this.opts.mixture?.[k] ?? 1;
      const n = Math.round(this.species[i].coefficient * units * mix);
      for (let c = 0; c < n; c++) this.particles.push(this.spawn(i));
    });
    this.sample();
  }

  setOptions(patch: Partial<KineticsOptions>) {
    const prevT = this.opts.temperature;
    Object.assign(this.opts, patch);
    if (patch.temperature && patch.temperature !== prevT) {
      const f = Math.sqrt(patch.temperature / prevT);
      for (const p of this.particles) {
        p.vx *= f;
        p.vy *= f;
      }
    }
  }

  counts(): number[] {
    const c = new Array(this.species.length).fill(0);
    for (const p of this.particles) c[p.s]++;
    return c;
  }

  private sample() {
    this.history.push({ t: this.time, counts: this.counts() });
    if (this.history.length > 900) this.history.shift();
  }

  /** Arrhenius probability that a collision of the right partners reacts. */
  probability(direction: 'forward' | 'reverse'): number {
    let ea = this.opts.ea * (this.opts.catalyst ? 0.55 : 1);
    if (direction === 'reverse') ea = ea - this.opts.dH;
    ea = Math.max(0, ea);
    return Math.exp((-ea * 1000) / (ENERGY_COMPRESSION * R * this.opts.temperature));
  }

  step(dtReal: number) {
    const sub = Math.max(1, Math.ceil(dtReal / (1 / 240)));
    const dt = Math.min(dtReal, 0.05) / sub;
    for (let k = 0; k < sub; k++) this.substep(dt);
    this.flashes = this.flashes.filter((f) => this.time - f.t < 0.6);
    if (this.time - this.lastSample >= 0.1) {
      this.lastSample = this.time;
      this.sample();
    }
  }

  private substep(dt: number) {
    const W = this.width;
    const H = this.height;
    this.time += dt;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < p.r) {
        p.x = p.r;
        p.vx = Math.abs(p.vx);
      } else if (p.x > W - p.r) {
        p.x = W - p.r;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y < p.r) {
        p.y = p.r;
        p.vy = Math.abs(p.vy);
      } else if (p.y > H - p.r) {
        p.y = H - p.r;
        p.vy = -Math.abs(p.vy);
      }
    }
    // spatial hash
    const cell = 0.06;
    const cols = Math.ceil(W / cell);
    const grid = new Map<number, number[]>();
    this.particles.forEach((p, i) => {
      const key = Math.floor(p.y / cell) * cols + Math.floor(p.x / cell);
      const list = grid.get(key);
      if (list) list.push(i);
      else grid.set(key, [i]);
    });
    const dead = new Set<number>();
    const born: Particle[] = [];
    for (const [key, list] of grid) {
      const cx = key % cols;
      const cy = Math.floor(key / cols);
      for (let oy = 0; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          if (oy === 0 && ox < 0) continue;
          const other = oy === 0 && ox === 0 ? list : grid.get((cy + oy) * cols + cx + ox);
          if (!other) continue;
          for (let a = 0; a < list.length; a++) {
            const i = list[a];
            if (dead.has(i)) continue;
            for (let b = other === list ? a + 1 : 0; b < other.length; b++) {
              const j = other[b];
              if (dead.has(j) || dead.has(i)) continue;
              this.collide(i, j, dead, born);
            }
          }
        }
    }
    if (dead.size) {
      this.particles = this.particles.filter((_, i) => !dead.has(i));
    }
    this.particles.push(...born);
    this.thermostat(dt);
  }

  private collide(i: number, j: number, dead: Set<number>, born: Particle[]) {
    const p = this.particles[i];
    const q = this.particles[j];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const min = p.r + q.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 === 0) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
    // separate overlap
    const overlap = (min - d) / 2;
    p.x -= nx * overlap;
    p.y -= ny * overlap;
    q.x += nx * overlap;
    q.y += ny * overlap;
    if (rel >= 0) return;
    const mp = this.species[p.s].molarMass;
    const mq = this.species[q.s].molarMass;
    const imp = (2 * rel) / (mp + mq);
    p.vx += imp * mq * nx;
    p.vy += imp * mq * ny;
    q.vx -= imp * mp * nx;
    q.vy -= imp * mp * ny;

    for (const direction of ['forward', 'reverse'] as const) {
      if (direction === 'reverse' && !this.opts.reversible) continue;
      const side = direction === 'forward' ? this.reactants : this.products;
      const out = direction === 'forward' ? this.products : this.reactants;
      const need = new Map<number, number>(side.map((s) => [s, this.species[s].coefficient]));
      const total = [...need.values()].reduce((a, b) => a + b, 0);
      const inP = need.has(p.s);
      const inQ = need.has(q.s);
      if (!inP && !inQ) continue;
      if (total > 1 && !(inP && inQ)) continue;
      if (total > 1 && p.s === q.s && need.get(p.s)! < 2) continue;
      if (this.rand() > this.probability(direction)) continue;
      // gather the full stoichiometric set: colliding pair + nearest partners
      const used = total === 1 ? [inP ? i : j] : [i, j];
      used.forEach((u) => need.set(this.particles[u].s, need.get(this.particles[u].s)! - 1));
      const cx = (p.x + q.x) / 2;
      const cy = (p.y + q.y) / 2;
      for (const [s, n] of need) {
        if (n <= 0) continue;
        const cands = this.particles
          .map((x, idx) => ({ idx, d: (x.x - cx) ** 2 + (x.y - cy) ** 2, x }))
          .filter((c) => c.x.s === s && !dead.has(c.idx) && !used.includes(c.idx))
          .sort((a, b) => a.d - b.d)
          .slice(0, n);
        if (cands.length < n) return;
        used.push(...cands.map((c) => c.idx));
      }
      used.forEach((u) => dead.add(u));
      const dH = direction === 'forward' ? this.opts.dH : -this.opts.dH;
      const boost = Math.sqrt(1 + Math.max(0, -dH) / 300);
      for (const s of out) {
        for (let c = 0; c < this.species[s].coefficient; c++) {
          const ang = this.rand() * Math.PI * 2;
          const off = (p.r + q.r) * 0.8 * this.rand();
          const np = this.spawn(s, cx + Math.cos(ang) * off, cy + Math.sin(ang) * off, boost);
          np.x = Math.min(this.width - np.r, Math.max(np.r, np.x));
          np.y = Math.min(this.height - np.r, Math.max(np.r, np.y));
          born.push(np);
        }
      }
      this.flashes.push({ x: cx, y: cy, t: this.time, color: direction === 'forward' ? '#ffd27a' : '#8fb4ff' });
      if (direction === 'forward') this.forwardEvents++;
      else this.reverseEvents++;
      return;
    }
  }

  /** Berendsen thermostat towards the set temperature (exothermic heat is released, then removed). */
  private thermostat(dt: number) {
    if (!this.particles.length) return;
    let ke = 0;
    let target = 0;
    for (const p of this.particles) {
      const m = this.species[p.s].molarMass;
      ke += m * (p.vx * p.vx + p.vy * p.vy);
      const sigma = 0.16 * Math.sqrt((this.opts.temperature / 298) * (18 / m));
      target += m * 2 * sigma * sigma;
    }
    const lambda = Math.sqrt(1 + (dt / 0.6) * (target / Math.max(ke, 1e-12) - 1));
    for (const p of this.particles) {
      p.vx *= lambda;
      p.vy *= lambda;
    }
  }

  /** Instantaneous "kinetic temperature" relative to the set point (1 = equilibrium). */
  heatIndex(): number {
    let ke = 0;
    let target = 0;
    for (const p of this.particles) {
      const m = this.species[p.s].molarMass;
      ke += m * (p.vx * p.vx + p.vy * p.vy);
      const sigma = 0.16 * Math.sqrt((this.opts.temperature / 298) * (18 / m));
      target += m * 2 * sigma * sigma;
    }
    return target ? ke / target : 1;
  }
}
