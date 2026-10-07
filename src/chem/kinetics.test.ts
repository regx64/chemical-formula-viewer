import { describe, expect, it } from 'vitest';
import { KineticsSim, type KineticSpecies } from './kinetics';

const species: KineticSpecies[] = [
  { label: 'H2O2', color: '#fff', coefficient: 2, side: 'reactant', molarMass: 34, atoms: 4 },
  { label: 'H2O', color: '#fff', coefficient: 2, side: 'product', molarMass: 18, atoms: 3 },
  { label: 'O2', color: '#fff', coefficient: 1, side: 'product', molarMass: 32, atoms: 2 },
];

describe('KineticsSim', () => {
  it('conserves atoms and reacts faster when hot', () => {
    const run = (T: number) => {
      const sim = new KineticsSim(species, { temperature: T, ea: 75, dH: -196, reversible: false, catalyst: false, aspect: 0.62 });
      const oxygen = () => {
        const [a, b, c] = sim.counts();
        return 2 * a + b + 2 * c; // O atoms: 2 per H2O2, 1 per H2O, 2 per O2
      };
      const before = oxygen();
      for (let i = 0; i < 300; i++) sim.step(1 / 60);
      expect(oxygen()).toBe(before);
      return sim.forwardEvents;
    };
    expect(run(900)).toBeGreaterThan(run(400));
  });
  it('catalyst raises the reaction probability', () => {
    const sim = new KineticsSim(species, { temperature: 298, ea: 75, dH: -196, reversible: false, catalyst: false, aspect: 0.62 });
    const p0 = sim.probability('forward');
    sim.setOptions({ catalyst: true });
    expect(sim.probability('forward')).toBeGreaterThan(p0 * 10);
  });
});
