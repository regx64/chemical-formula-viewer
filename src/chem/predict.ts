import { commonIonCharge, isMetal } from './elements';
import { hillFormula, type Composition } from './formula';

/* Rule-based product prediction for common reaction classes taught in general chemistry. */

export interface Prediction {
  products: string[];
  type: string;
  explanation: string;
}

export interface NoReaction {
  noReaction: true;
  explanation: string;
}

interface Ion {
  text: string;
  comp: Composition;
  charge: number;
  poly: boolean;
}

const ANIONS: Ion[] = [
  { text: 'OH', comp: { O: 1, H: 1 }, charge: -1, poly: true },
  { text: 'NO3', comp: { N: 1, O: 3 }, charge: -1, poly: true },
  { text: 'NO2', comp: { N: 1, O: 2 }, charge: -1, poly: true },
  { text: 'SO4', comp: { S: 1, O: 4 }, charge: -2, poly: true },
  { text: 'SO3', comp: { S: 1, O: 3 }, charge: -2, poly: true },
  { text: 'HCO3', comp: { H: 1, C: 1, O: 3 }, charge: -1, poly: true },
  { text: 'CO3', comp: { C: 1, O: 3 }, charge: -2, poly: true },
  { text: 'PO4', comp: { P: 1, O: 4 }, charge: -3, poly: true },
  { text: 'CH3COO', comp: { C: 2, H: 3, O: 2 }, charge: -1, poly: true },
  { text: 'ClO3', comp: { Cl: 1, O: 3 }, charge: -1, poly: true },
  { text: 'ClO4', comp: { Cl: 1, O: 4 }, charge: -1, poly: true },
  { text: 'MnO4', comp: { Mn: 1, O: 4 }, charge: -1, poly: true },
  { text: 'CN', comp: { C: 1, N: 1 }, charge: -1, poly: true },
  { text: 'F', comp: { F: 1 }, charge: -1, poly: false },
  { text: 'Cl', comp: { Cl: 1 }, charge: -1, poly: false },
  { text: 'Br', comp: { Br: 1 }, charge: -1, poly: false },
  { text: 'I', comp: { I: 1 }, charge: -1, poly: false },
  { text: 'S', comp: { S: 1 }, charge: -2, poly: false },
  { text: 'O', comp: { O: 1 }, charge: -2, poly: false },
];

/** Metal activity series (most → least reactive); H marks where hydrogen sits. */
const ACTIVITY = ['Li', 'K', 'Ba', 'Sr', 'Ca', 'Na', 'Mg', 'Al', 'Mn', 'Zn', 'Cr', 'Fe', 'Cd', 'Co', 'Ni', 'Sn', 'Pb', 'H', 'Cu', 'Hg', 'Ag', 'Pt', 'Au'];
const HALOGEN_ACTIVITY = ['F', 'Cl', 'Br', 'I'];
const WATER_REACTIVE = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Ca', 'Sr', 'Ba']);

const eq = (a: Composition, b: Composition) => {
  const ka = Object.keys(a).filter((k) => a[k]);
  const kb = Object.keys(b).filter((k) => b[k]);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

function subtractN(a: Composition, b: Composition, n: number): Composition | null {
  const out = { ...a };
  for (const [el, c] of Object.entries(b)) {
    out[el] = (out[el] ?? 0) - c * n;
    if (out[el] < 0) return null;
    if (out[el] === 0) delete out[el];
  }
  return out;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

interface Salt {
  cation: string; // metal symbol or 'NH4' or 'H'
  cationCharge: number;
  anion: Ion;
  nCation: number;
  nAnion: number;
}

/** Decompose a composition as cation + anion (acids use H as the cation). */
function asSalt(comp: Composition): Salt | null {
  for (const anion of ANIONS) {
    const first = Object.keys(anion.comp)[0];
    const max = Math.floor((comp[first] ?? 0) / anion.comp[first]);
    for (let n = max; n >= 1; n--) {
      const rest = subtractN(comp, anion.comp, n);
      if (!rest) continue;
      const keys = Object.keys(rest);
      if (keys.length === 1 && (isMetal(keys[0]) || keys[0] === 'H')) {
        const cation = keys[0];
        if (cation === 'H' && (anion.text === 'O' || anion.text === 'OH')) continue; // water is not an acid here
        const nCation = rest[cation];
        const cationCharge = (n * -anion.charge) / nCation;
        if (!Number.isInteger(cationCharge) || cationCharge <= 0) continue;
        return { cation, cationCharge, anion, nCation, nAnion: n };
      }
      if (keys.length === 2 && rest.N && rest.H === 4 * rest.N && n * -anion.charge === rest.N) {
        return { cation: 'NH4', cationCharge: 1, anion, nCation: rest.N, nAnion: n };
      }
    }
  }
  return null;
}

export function saltFormula(cation: string, cationCharge: number, anion: Ion): string {
  const g = gcd(cationCharge, -anion.charge);
  const nC = -anion.charge / g;
  const nA = cationCharge / g;
  const c = cation === 'NH4' && nC > 1 ? `(NH4)${nC}` : cation + (nC > 1 ? nC : '');
  const a = anion.poly && nA > 1 ? `(${anion.text})${nA}` : anion.text + (nA > 1 ? nA : '');
  if (anion.text === 'CH3COO' && nA === 1) return `${anion.text}${c}`;
  if (anion.text === 'O' && cation === 'H') return 'H2O';
  return c + a;
}

const anionByText = (t: string) => ANIONS.find((a) => a.text === t)!;

const kind = (comp: Composition) => {
  const els = Object.keys(comp);
  const only = (...allowed: string[]) => els.every((e) => allowed.includes(e));
  return {
    els,
    isO2: eq(comp, { O: 2 }),
    isH2: eq(comp, { H: 2 }),
    isWater: eq(comp, { H: 2, O: 1 }),
    isMetal: els.length === 1 && isMetal(els[0]),
    isHalogen: els.length === 1 && HALOGEN_ACTIVITY.includes(els[0]) && comp[els[0]] === 2,
    isNonmetalElement: els.length === 1 && !isMetal(els[0]),
    isOrganicFuel: !!comp.C && !!comp.H && only('C', 'H', 'O', 'N', 'S'),
    isAmmonia: eq(comp, { N: 1, H: 3 }),
  };
};

function oxideOf(metal: string): string {
  const q = commonIonCharge(metal) ?? 2;
  return saltFormula(metal, q, anionByText('O'));
}

export function predictProducts(reactants: Composition[]): Prediction | NoReaction | null {
  const ks = reactants.map(kind);
  const salts = reactants.map(asSalt);
  const find = (pred: (i: number) => boolean) => reactants.findIndex((_, i) => pred(i));

  if (reactants.length === 1) {
    const c = reactants[0];
    const s = salts[0];
    if (eq(c, { H: 2, O: 2 })) return { products: ['H2O', 'O2'], type: 'Decomposition', explanation: 'Hydrogen peroxide disproportionates into water and oxygen.' };
    if (ks[0].isWater) return { products: ['H2', 'O2'], type: 'Decomposition (electrolysis)', explanation: 'Electrolysis splits water into hydrogen and oxygen.' };
    if (eq(c, { K: 1, Cl: 1, O: 3 })) return { products: ['KCl', 'O2'], type: 'Decomposition', explanation: 'Heating potassium chlorate releases oxygen.' };
    if (eq(c, { Hg: 1, O: 1 })) return { products: ['Hg', 'O2'], type: 'Decomposition', explanation: 'Mercury(II) oxide decomposes on heating — Priestley’s route to oxygen.' };
    if (s && s.anion.text === 'CO3' && s.cation !== 'H' && s.cation !== 'NH4')
      return { products: [oxideOf(s.cation), 'CO2'], type: 'Thermal decomposition', explanation: 'Metal carbonates release CO₂ on heating, leaving the metal oxide.' };
    if (s && s.anion.text === 'HCO3' && s.cation === 'Na')
      return { products: ['Na2CO3', 'H2O', 'CO2'], type: 'Thermal decomposition', explanation: 'Baking soda decomposes to sodium carbonate, water and CO₂.' };
    if (s && s.anion.text === 'OH' && s.cation !== 'H')
      return { products: [oxideOf(s.cation), 'H2O'], type: 'Dehydration', explanation: 'Metal hydroxides lose water on heating to form the oxide.' };
    if (eq(c, { N: 2, O: 4 })) return { products: ['NO2'], type: 'Dissociation', explanation: 'Dinitrogen tetroxide dissociates into brown NO₂.' };
    if (eq(c, { N: 2, H: 4, O: 3 })) return { products: ['N2O', 'H2O'], type: 'Decomposition', explanation: 'Ammonium nitrate decomposes to nitrous oxide and water.' };
    return null;
  }

  if (reactants.length === 2) {
    const o2 = find((i) => ks[i].isO2);
    if (o2 >= 0) {
      const other = 1 - o2;
      const c = reactants[other];
      const k = ks[other];
      if (k.isOrganicFuel) {
        const products = ['CO2', 'H2O'];
        if (c.N) products.push('N2');
        if (c.S) products.push('SO2');
        return { products, type: 'Combustion', explanation: 'Complete combustion converts carbon to CO₂ and hydrogen to H₂O.' };
      }
      if (k.isH2) return { products: ['H2O'], type: 'Synthesis (combustion)', explanation: 'Hydrogen burns in oxygen to form water.' };
      if (eq(c, { C: 1 })) return { products: ['CO2'], type: 'Combustion', explanation: 'Carbon burns completely to carbon dioxide.' };
      if (eq(c, { C: 1, O: 1 })) return { products: ['CO2'], type: 'Combustion', explanation: 'Carbon monoxide burns to carbon dioxide.' };
      if (eq(c, { S: 1 }) || eq(c, { S: 8 })) return { products: ['SO2'], type: 'Combustion', explanation: 'Sulfur burns with a blue flame to sulfur dioxide.' };
      if (eq(c, { S: 1, O: 2 })) return { products: ['SO3'], type: 'Oxidation', explanation: 'SO₂ is oxidised to SO₃ (the contact process, over V₂O₅).' };
      if (eq(c, { N: 2 })) return { products: ['NO'], type: 'Synthesis', explanation: 'At very high temperatures (lightning, engines) N₂ and O₂ form nitric oxide.' };
      if (eq(c, { N: 1, O: 1 })) return { products: ['NO2'], type: 'Oxidation', explanation: 'Nitric oxide reacts rapidly with oxygen to form NO₂.' };
      if (eq(c, { P: 4 }) || eq(c, { P: 1 })) return { products: ['P4O10'], type: 'Combustion', explanation: 'Phosphorus burns to phosphorus pentoxide.' };
      if (k.isMetal) {
        const m = k.els[0];
        if (m === 'Fe') return { products: ['Fe2O3'], type: 'Oxidation', explanation: 'Iron oxidises to iron(III) oxide (rust).' };
        if (['Au', 'Pt'].includes(m)) return { noReaction: true, explanation: `${m} is a noble metal and does not oxidise in air.` };
        return { products: [oxideOf(m)], type: 'Synthesis (oxidation)', explanation: `${m} combines with oxygen to form its oxide.` };
      }
    }
    const h2 = find((i) => ks[i].isH2);
    if (h2 >= 0) {
      const c = reactants[1 - h2];
      const k = ks[1 - h2];
      if (eq(c, { N: 2 })) return { products: ['NH3'], type: 'Synthesis (Haber–Bosch)', explanation: 'Nitrogen and hydrogen combine over an iron catalyst to make ammonia.' };
      if (k.isHalogen) return { products: [`H${k.els[0]}`], type: 'Synthesis', explanation: 'Hydrogen and a halogen combine to form a hydrogen halide.' };
      if (eq(c, { C: 2, H: 4 })) return { products: ['C2H6'], type: 'Hydrogenation', explanation: 'H₂ adds across the C=C double bond (Ni/Pt catalyst).' };
      if (eq(c, { C: 2, H: 2 })) return { products: ['C2H4'], type: 'Hydrogenation', explanation: 'Partial hydrogenation of the triple bond gives ethylene.' };
      if (eq(c, { C: 1, O: 1 })) return { products: ['CH3OH'], type: 'Synthesis', explanation: 'Syngas is converted to methanol over a Cu/ZnO catalyst.' };
      if (k.isNonmetalElement && c.S) return { products: ['H2S'], type: 'Synthesis', explanation: 'Hydrogen and sulfur form hydrogen sulfide.' };
    }
    // metal + halogen
    const hal = find((i) => ks[i].isHalogen);
    const metal = find((i) => ks[i].isMetal);
    if (hal >= 0 && metal >= 0) {
      const m = ks[metal].els[0];
      return {
        products: [saltFormula(m, commonIonCharge(m) ?? 2, anionByText(ks[hal].els[0]))],
        type: 'Synthesis',
        explanation: `${m} transfers electrons to ${ks[hal].els[0]} to form an ionic halide.`,
      };
    }
    // halogen displacement
    if (hal >= 0) {
      const s = salts[1 - hal];
      const X = ks[hal].els[0];
      if (s && !s.anion.poly && HALOGEN_ACTIVITY.includes(s.anion.text) && s.cation !== 'H') {
        if (HALOGEN_ACTIVITY.indexOf(X) < HALOGEN_ACTIVITY.indexOf(s.anion.text))
          return {
            products: [saltFormula(s.cation, s.cationCharge, anionByText(X)), `${s.anion.text}2`],
            type: 'Single displacement',
            explanation: `${X}₂ is a stronger oxidiser than ${s.anion.text}₂ and displaces it from its salt.`,
          };
        return { noReaction: true, explanation: `${X}₂ is less reactive than ${s.anion.text}₂, so no displacement occurs.` };
      }
    }
    // metal + water
    const water = find((i) => ks[i].isWater);
    if (water >= 0 && metal >= 0) {
      const m = ks[metal].els[0];
      if (WATER_REACTIVE.has(m))
        return { products: [saltFormula(m, commonIonCharge(m) ?? 1, anionByText('OH')), 'H2'], type: 'Single displacement', explanation: `${m} reduces water, releasing hydrogen and forming a hydroxide.` };
      return { noReaction: true, explanation: `${m} does not react appreciably with cold water.` };
    }
    // oxide + water
    if (water >= 0) {
      const c = reactants[1 - water];
      if (eq(c, { C: 1, O: 2 })) return { products: ['H2CO3'], type: 'Synthesis', explanation: 'CO₂ dissolves in water to form carbonic acid (an equilibrium).' };
      if (eq(c, { S: 1, O: 3 })) return { products: ['H2SO4'], type: 'Synthesis', explanation: 'Sulfur trioxide hydrates to sulfuric acid.' };
      if (eq(c, { P: 4, O: 10 })) return { products: ['H3PO4'], type: 'Synthesis', explanation: 'Phosphorus pentoxide hydrates to phosphoric acid.' };
      if (eq(c, { C: 2, H: 4 })) return { products: ['C2H5OH'], type: 'Hydration', explanation: 'Acid-catalysed hydration of ethylene gives ethanol.' };
      const s = salts[1 - water];
      if (s && s.anion.text === 'O' && s.cation !== 'H')
        return { products: [saltFormula(s.cation, s.cationCharge, anionByText('OH'))], type: 'Synthesis', explanation: 'Basic metal oxides react with water to give hydroxides.' };
    }
    // esterification (ethanol/methanol + acetic acid)
    const acetic = find((i) => eq(reactants[i], { C: 2, H: 4, O: 2 }));
    const ethanol = find((i) => eq(reactants[i], { C: 2, H: 6, O: 1 }));
    const methanol = find((i) => eq(reactants[i], { C: 1, H: 4, O: 1 }));
    if (acetic >= 0 && ethanol >= 0) return { products: ['C4H8O2', 'H2O'], type: 'Esterification (Fischer)', explanation: 'Acid-catalysed condensation of a carboxylic acid and an alcohol gives an ester and water.' };
    if (acetic >= 0 && methanol >= 0) return { products: ['C3H6O2', 'H2O'], type: 'Esterification (Fischer)', explanation: 'Acetic acid and methanol condense to methyl acetate and water.' };

    // acid–base and salt chemistry
    const acidIdx = find((i) => salts[i]?.cation === 'H');
    if (acidIdx >= 0) {
      const acid = salts[acidIdx]!;
      const other = 1 - acidIdx;
      const os = salts[other];
      const ok = ks[other];
      if (ok.isAmmonia)
        return { products: [saltFormula('NH4', 1, acid.anion)], type: 'Acid–base (neutralisation)', explanation: 'Ammonia accepts a proton to form an ammonium salt.' };
      if (os && os.anion.text === 'OH' && os.cation !== 'H')
        return { products: [saltFormula(os.cation, os.cationCharge, acid.anion), 'H2O'], type: 'Acid–base (neutralisation)', explanation: 'H⁺ from the acid and OH⁻ from the base combine to form water, leaving a salt.' };
      if (os && (os.anion.text === 'CO3' || os.anion.text === 'HCO3') && os.cation !== 'H')
        return { products: [saltFormula(os.cation, os.cationCharge, acid.anion), 'H2O', 'CO2'], type: 'Acid–carbonate', explanation: 'Carbonates neutralise acids, fizzing as CO₂ is released.' };
      if (os && os.anion.text === 'O' && os.cation !== 'H')
        return { products: [saltFormula(os.cation, os.cationCharge, acid.anion), 'H2O'], type: 'Acid–base (neutralisation)', explanation: 'A basic oxide neutralises the acid to give a salt and water.' };
      if (ok.isMetal) {
        const m = ok.els[0];
        if (ACTIVITY.indexOf(m) >= 0 && ACTIVITY.indexOf(m) < ACTIVITY.indexOf('H') && acid.anion.text !== 'NO3')
          return { products: [saltFormula(m, m === 'Fe' ? 2 : (commonIonCharge(m) ?? 2), acid.anion), 'H2'], type: 'Single displacement', explanation: `${m} is above hydrogen in the activity series, so it displaces H₂ from the acid.` };
        if (ACTIVITY.indexOf(m) > ACTIVITY.indexOf('H'))
          return { noReaction: true, explanation: `${m} is below hydrogen in the activity series and does not displace H₂ from ${hillFormula(reactants[acidIdx])}.` };
      }
    }
    // metal + salt single displacement
    if (metal >= 0) {
      const s = salts[1 - metal];
      const m = ks[metal].els[0];
      if (s && s.cation !== 'H' && s.cation !== 'NH4') {
        const am = ACTIVITY.indexOf(m);
        const as = ACTIVITY.indexOf(s.cation);
        if (am >= 0 && as >= 0 && am < as)
          return {
            products: [saltFormula(m, commonIonCharge(m) ?? 2, s.anion), s.cation],
            type: 'Single displacement',
            explanation: `${m} is more reactive than ${s.cation}, so it reduces ${s.cation} ions to the metal.`,
          };
        if (am >= 0 && as >= 0) return { noReaction: true, explanation: `${m} is less reactive than ${s.cation}; no displacement occurs.` };
      }
    }
    // double displacement between two salts
    const [s1, s2] = salts;
    if (s1 && s2 && s1.cation !== 'H' && s2.cation !== 'H' && s1.anion.text !== s2.anion.text) {
      const p1 = saltFormula(s1.cation, s1.cationCharge, s2.anion);
      const p2 = saltFormula(s2.cation, s2.cationCharge, s1.anion);
      const insoluble = [p1, p2].filter(isInsoluble);
      if (!insoluble.length) return { noReaction: true, explanation: 'All possible products are soluble — the ions simply stay in solution.' };
      return {
        products: [p1, p2],
        type: 'Double displacement (precipitation)',
        explanation: `${insoluble.join(' and ')} is insoluble and precipitates out of solution.`,
      };
    }
  }
  return null;
}

/** Simplified solubility rules for precipitation reactions. */
export function isInsoluble(formula: string): boolean {
  const known = ['AgCl', 'AgBr', 'AgI', 'BaSO4', 'PbSO4', 'CaSO4', 'PbCl2', 'PbI2', 'CaCO3', 'BaCO3', 'MgCO3', 'FeCO3', 'Ag2CO3', 'Cu(OH)2', 'Fe(OH)3', 'Fe(OH)2', 'Mg(OH)2', 'Al(OH)3', 'Zn(OH)2', 'Ca3(PO4)2', 'Ag2S', 'CuS', 'PbS', 'ZnS', 'Ni(OH)2', 'Co(OH)2', 'AgOH', 'Ag3PO4', 'BaCrO4'];
  return known.includes(formula);
}
