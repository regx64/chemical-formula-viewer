/**
 * Periodic table data.
 * mass: IUPAC standard atomic weight (abridged), color: Jmol CPK hex,
 * cov: covalent radius in Å (Cordero 2008), vdw: van der Waals radius in Å,
 * en: Pauling electronegativity (0 = undefined).
 */
export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  color: string;
  cov: number;
  vdw: number;
  en: number;
  group: number; // 1-18, 0 for lanthanides/actinides
  period: number;
  category: ElementCategory;
}

export type ElementCategory =
  | 'nonmetal'
  | 'noble-gas'
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'metalloid'
  | 'halogen'
  | 'post-transition'
  | 'transition-metal'
  | 'lanthanide'
  | 'actinide';

// symbol, name, mass, color, cov, vdw, en
const RAW = `H,Hydrogen,1.008,FFFFFF,0.31,1.20,2.20
He,Helium,4.0026,D9FFFF,0.28,1.40,0
Li,Lithium,6.94,CC80FF,1.28,1.82,0.98
Be,Beryllium,9.0122,C2FF00,0.96,1.53,1.57
B,Boron,10.81,FFB5B5,0.84,1.92,2.04
C,Carbon,12.011,909090,0.76,1.70,2.55
N,Nitrogen,14.007,3050F8,0.71,1.55,3.04
O,Oxygen,15.999,FF0D0D,0.66,1.52,3.44
F,Fluorine,18.998,90E050,0.57,1.47,3.98
Ne,Neon,20.180,B3E3F5,0.58,1.54,0
Na,Sodium,22.990,AB5CF2,1.66,2.27,0.93
Mg,Magnesium,24.305,8AFF00,1.41,1.73,1.31
Al,Aluminium,26.982,BFA6A6,1.21,1.84,1.61
Si,Silicon,28.085,F0C8A0,1.11,2.10,1.90
P,Phosphorus,30.974,FF8000,1.07,1.80,2.19
S,Sulfur,32.06,FFFF30,1.05,1.80,2.58
Cl,Chlorine,35.45,1FF01F,1.02,1.75,3.16
Ar,Argon,39.948,80D1E3,1.06,1.88,0
K,Potassium,39.098,8F40D4,2.03,2.75,0.82
Ca,Calcium,40.078,3DFF00,1.76,2.31,1.00
Sc,Scandium,44.956,E6E6E6,1.70,2.11,1.36
Ti,Titanium,47.867,BFC2C7,1.60,2.00,1.54
V,Vanadium,50.942,A6A6AB,1.53,2.00,1.63
Cr,Chromium,51.996,8A99C7,1.39,2.00,1.66
Mn,Manganese,54.938,9C7AC7,1.50,2.00,1.55
Fe,Iron,55.845,E06633,1.42,2.00,1.83
Co,Cobalt,58.933,F090A0,1.38,2.00,1.88
Ni,Nickel,58.693,50D050,1.24,1.63,1.91
Cu,Copper,63.546,C88033,1.32,1.40,1.90
Zn,Zinc,65.38,7D80B0,1.22,1.39,1.65
Ga,Gallium,69.723,C28F8F,1.22,1.87,1.81
Ge,Germanium,72.630,668F8F,1.20,2.11,2.01
As,Arsenic,74.922,BD80E3,1.19,1.85,2.18
Se,Selenium,78.971,FFA100,1.20,1.90,2.55
Br,Bromine,79.904,A62929,1.20,1.85,2.96
Kr,Krypton,83.798,5CB8D1,1.16,2.02,3.00
Rb,Rubidium,85.468,702EB0,2.20,3.03,0.82
Sr,Strontium,87.62,00FF00,1.95,2.49,0.95
Y,Yttrium,88.906,94FFFF,1.90,2.00,1.22
Zr,Zirconium,91.224,94E0E0,1.75,2.00,1.33
Nb,Niobium,92.906,73C2C9,1.64,2.00,1.60
Mo,Molybdenum,95.95,54B5B5,1.54,2.00,2.16
Tc,Technetium,98,3B9E9E,1.47,2.00,1.90
Ru,Ruthenium,101.07,248F8F,1.46,2.00,2.20
Rh,Rhodium,102.91,0A7D8C,1.42,2.00,2.28
Pd,Palladium,106.42,006985,1.39,1.63,2.20
Ag,Silver,107.87,C0C0C0,1.45,1.72,1.93
Cd,Cadmium,112.41,FFD98F,1.44,1.58,1.69
In,Indium,114.82,A67573,1.42,1.93,1.78
Sn,Tin,118.71,668080,1.39,2.17,1.96
Sb,Antimony,121.76,9E63B5,1.39,2.06,2.05
Te,Tellurium,127.60,D47A00,1.38,2.06,2.10
I,Iodine,126.90,940094,1.39,1.98,2.66
Xe,Xenon,131.29,429EB0,1.40,2.16,2.60
Cs,Caesium,132.91,57178F,2.44,3.43,0.79
Ba,Barium,137.33,00C900,2.15,2.68,0.89
La,Lanthanum,138.91,70D4FF,2.07,2.40,1.10
Ce,Cerium,140.12,FFFFC7,2.04,2.35,1.12
Pr,Praseodymium,140.91,D9FFC7,2.03,2.39,1.13
Nd,Neodymium,144.24,C7FFC7,2.01,2.29,1.14
Pm,Promethium,145,A3FFC7,1.99,2.36,1.13
Sm,Samarium,150.36,8FFFC7,1.98,2.29,1.17
Eu,Europium,151.96,61FFC7,1.98,2.33,1.20
Gd,Gadolinium,157.25,45FFC7,1.96,2.37,1.20
Tb,Terbium,158.93,30FFC7,1.94,2.21,1.10
Dy,Dysprosium,162.50,1FFFC7,1.92,2.29,1.22
Ho,Holmium,164.93,00FF9C,1.92,2.16,1.23
Er,Erbium,167.26,00E675,1.89,2.35,1.24
Tm,Thulium,168.93,00D452,1.90,2.27,1.25
Yb,Ytterbium,173.05,00BF38,1.87,2.42,1.10
Lu,Lutetium,174.97,00AB24,1.87,2.21,1.27
Hf,Hafnium,178.49,4DC2FF,1.75,2.12,1.30
Ta,Tantalum,180.95,4DA6FF,1.70,2.17,1.50
W,Tungsten,183.84,2194D6,1.62,2.10,2.36
Re,Rhenium,186.21,267DAB,1.51,2.17,1.90
Os,Osmium,190.23,266696,1.44,2.16,2.20
Ir,Iridium,192.22,175487,1.41,2.02,2.20
Pt,Platinum,195.08,D0D0E0,1.36,1.75,2.28
Au,Gold,196.97,FFD123,1.36,1.66,2.54
Hg,Mercury,200.59,B8B8D0,1.32,1.55,2.00
Tl,Thallium,204.38,A6544D,1.45,1.96,1.62
Pb,Lead,207.2,575961,1.46,2.02,2.33
Bi,Bismuth,208.98,9E4FB5,1.48,2.07,2.02
Po,Polonium,209,AB5C00,1.40,1.97,2.00
At,Astatine,210,754F45,1.50,2.02,2.20
Rn,Radon,222,428296,1.50,2.20,2.20
Fr,Francium,223,420066,2.60,3.48,0.70
Ra,Radium,226,007D00,2.21,2.83,0.90
Ac,Actinium,227,70ABFA,2.15,2.47,1.10
Th,Thorium,232.04,00BAFF,2.06,2.45,1.30
Pa,Protactinium,231.04,00A1FF,2.00,2.43,1.50
U,Uranium,238.03,008FFF,1.96,2.41,1.38
Np,Neptunium,237,0080FF,1.90,2.39,1.36
Pu,Plutonium,244,006BFF,1.87,2.43,1.28
Am,Americium,243,545CF2,1.80,2.44,1.30
Cm,Curium,247,785CE3,1.69,2.45,1.30
Bk,Berkelium,247,8A4FE3,1.68,2.44,1.30
Cf,Californium,251,A136D4,1.68,2.45,1.30
Es,Einsteinium,252,B31FD4,1.65,2.45,1.30
Fm,Fermium,257,B31FBA,1.67,2.45,1.30
Md,Mendelevium,258,B30DA6,1.73,2.46,1.30
No,Nobelium,259,BD0D87,1.76,2.46,1.30
Lr,Lawrencium,266,C70066,1.61,2.46,1.30
Rf,Rutherfordium,267,CC0059,1.57,2.00,0
Db,Dubnium,268,D1004F,1.49,2.00,0
Sg,Seaborgium,269,D90045,1.43,2.00,0
Bh,Bohrium,270,E00038,1.41,2.00,0
Hs,Hassium,269,E6002E,1.34,2.00,0
Mt,Meitnerium,278,EB0026,1.29,2.00,0
Ds,Darmstadtium,281,EB0026,1.28,2.00,0
Rg,Roentgenium,282,EB0026,1.21,2.00,0
Cn,Copernicium,285,EB0026,1.22,2.00,0
Nh,Nihonium,286,EB0026,1.36,2.00,0
Fl,Flerovium,289,EB0026,1.43,2.00,0
Mc,Moscovium,290,EB0026,1.62,2.00,0
Lv,Livermorium,293,EB0026,1.75,2.00,0
Ts,Tennessine,294,EB0026,1.65,2.00,0
Og,Oganesson,294,EB0026,1.57,2.00,0`;

const METALLOIDS = new Set(['B', 'Si', 'Ge', 'As', 'Sb', 'Te', 'Po']);
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I', 'At', 'Ts']);
const NONMETALS = new Set(['H', 'C', 'N', 'O', 'P', 'S', 'Se']);

function position(z: number): { group: number; period: number } {
  const periodStarts = [1, 3, 11, 19, 37, 55, 87, 119];
  let period = 1;
  while (period < 7 && z >= periodStarts[period]) period++;
  const offset = z - periodStarts[period - 1];
  if (period === 1) return { period, group: z === 1 ? 1 : 18 };
  if (period <= 3) return { period, group: offset < 2 ? offset + 1 : offset + 11 };
  if (period <= 5) return { period, group: offset + 1 };
  // periods 6/7 carry the f-block (15 elements La–Lu / Ac–Lr, group 3 assigned to La/Ac)
  if (offset < 2) return { period, group: offset + 1 };
  if (offset < 17) return { period, group: offset === 2 ? 3 : 0 };
  return { period, group: offset - 13 };
}

function categorize(symbol: string, z: number, group: number, period: number): ElementCategory {
  if (group === 18) return 'noble-gas';
  if (HALOGENS.has(symbol)) return 'halogen';
  if (METALLOIDS.has(symbol)) return 'metalloid';
  if (NONMETALS.has(symbol)) return 'nonmetal';
  if (group === 1) return 'alkali-metal';
  if (group === 2) return 'alkaline-earth';
  if ((z >= 57 && z <= 71) || (period === 6 && group === 0)) return 'lanthanide';
  if ((z >= 89 && z <= 103) || (period === 7 && group === 0)) return 'actinide';
  if (group >= 3 && group <= 12) return 'transition-metal';
  return 'post-transition';
}

export const ELEMENTS: ElementData[] = RAW.split('\n').map((line, i) => {
  const [symbol, name, mass, color, cov, vdw, en] = line.split(',');
  const z = i + 1;
  const { group, period } = position(z);
  return {
    z,
    symbol,
    name,
    mass: Number(mass),
    color: '#' + color,
    cov: Number(cov),
    vdw: Number(vdw),
    en: Number(en),
    group,
    period,
    category: categorize(symbol, z, group, period),
  };
});

export const ELEMENT_BY_SYMBOL: Record<string, ElementData> = Object.fromEntries(
  ELEMENTS.map((e) => [e.symbol, e]),
);

export function element(symbol: string): ElementData {
  const e = ELEMENT_BY_SYMBOL[symbol];
  if (!e) throw new Error(`Unknown element: ${symbol}`);
  return e;
}

export function isElement(symbol: string): boolean {
  return symbol in ELEMENT_BY_SYMBOL;
}

export function isMetal(symbol: string): boolean {
  const c = ELEMENT_BY_SYMBOL[symbol]?.category;
  return (
    c === 'alkali-metal' ||
    c === 'alkaline-earth' ||
    c === 'transition-metal' ||
    c === 'post-transition' ||
    c === 'lanthanide' ||
    c === 'actinide'
  );
}

/** Valence (outer-shell) electrons for main-group elements; transition metals return group number. */
export function valenceElectrons(symbol: string): number {
  const e = element(symbol);
  if (e.group === 0) return 3;
  if (e.group <= 2) return e.group;
  if (e.group >= 13) return e.group - 10;
  return e.group;
}

/** Allowed covalent valences, most common first. */
const VALENCES: Record<string, number[]> = {
  H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6],
  Cl: [1, 3, 5, 7], Br: [1, 3, 5], I: [1, 3, 5, 7], Se: [2, 4, 6], As: [3, 5], Ge: [4],
  Xe: [0, 2, 4, 6, 8], Kr: [0, 2], Be: [2], Al: [3], Li: [1], Na: [1], K: [1], Mg: [2], Sn: [4, 2],
};

export function valences(symbol: string): number[] {
  return VALENCES[symbol] ?? [Math.max(1, Math.min(valenceElectrons(symbol), 8 - valenceElectrons(symbol)))];
}

/** Most common monatomic ion charge, for ionic compounds and salt prediction. */
const ION_CHARGES: Record<string, number> = {
  H: 1, Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1, Cu: 2, Au: 3, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2,
  Zn: 2, Cd: 2, Hg: 2, Ni: 2, Co: 2, Mn: 2, Fe: 3, Cr: 3, Al: 3, Ga: 3, Pb: 2, Sn: 2, Ti: 4, Pt: 2,
  Pd: 2, F: -1, Cl: -1, Br: -1, I: -1, O: -2, S: -2, Se: -2, N: -3, P: -3,
};

export function commonIonCharge(symbol: string): number | undefined {
  return ION_CHARGES[symbol];
}

/** Brighten very dark CPK colours so they stay legible on the near-black stage. */
export function stageColor(symbol: string): string {
  const overrides: Record<string, string> = { N: '#4d6dff', C: '#a3a7ad', Pd: '#2a90aa', Ir: '#3a7ab0' };
  return overrides[symbol] ?? ELEMENT_BY_SYMBOL[symbol]?.color ?? '#ff4fa0';
}
