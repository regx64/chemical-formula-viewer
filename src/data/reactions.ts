export interface ReactionPreset {
  id: string;
  title: string;
  equation: string;
  category: 'Combustion' | 'Synthesis' | 'Acid–base' | 'Redox' | 'Decomposition' | 'Equilibrium' | 'Biochemistry' | 'Organic';
  blurb: string;
  /** approximate literature activation energy, kJ/mol */
  ea?: number;
  eaNote?: string;
}

export const REACTION_PRESETS: ReactionPreset[] = [
  {
    id: 'methane',
    title: 'Methane combustion',
    equation: 'CH4 + 2O2 -> CO2 + 2H2O',
    category: 'Combustion',
    blurb: 'Natural gas burning on a stove: four C–H and two O=O bonds break; two C=O and four O–H bonds form.',
    ea: 202,
    eaNote: 'Global one-step Westbrook–Dryer value',
  },
  { id: 'hydrogen', title: 'Hydrogen + oxygen', equation: '2H2 + O2 -> 2H2O', category: 'Combustion', blurb: 'The reaction that powers fuel cells and the Space Shuttle main engines.' },
  { id: 'octane', title: 'Octane combustion', equation: 'C8H18 + O2 -> CO2 + H2O', category: 'Combustion', blurb: 'Petrol in a car engine — 25 oxygen molecules for every two octanes.' },
  {
    id: 'haber',
    title: 'Haber–Bosch',
    equation: 'N2 + 3H2 <=> 2NH3',
    category: 'Equilibrium',
    blurb: 'Fixes atmospheric nitrogen into ammonia, feeding roughly half the world’s population through fertiliser.',
  },
  {
    id: 'neutral',
    title: 'Neutralisation',
    equation: 'HCl(aq) + NaOH(aq) -> NaCl(aq) + H2O(l)',
    category: 'Acid–base',
    blurb: 'H⁺ + OH⁻ → H₂O: about −56 kJ per mole of water formed for any strong acid / strong base pair.',
    ea: 12,
    eaNote: 'Near diffusion-controlled',
  },
  {
    id: 'photosynthesis',
    title: 'Photosynthesis',
    equation: '6CO2 + 6H2O -> C6H12O6 + 6O2',
    category: 'Biochemistry',
    blurb: 'Plants store about 2,800 kJ of solar energy in every mole of glucose they make.',
  },
  {
    id: 'respiration',
    title: 'Cellular respiration',
    equation: 'C6H12O6 + 6O2 -> 6CO2 + 6H2O',
    category: 'Biochemistry',
    blurb: 'The reverse of photosynthesis — your cells run it through ~30 enzyme-catalysed steps.',
  },
  {
    id: 'peroxide',
    title: 'Peroxide decomposition',
    equation: '2H2O2 -> 2H2O + O2',
    category: 'Decomposition',
    blurb: 'Elephant toothpaste: catalase or iodide lowers the barrier dramatically.',
    ea: 75,
    eaNote: 'Uncatalysed; ≈ 56 kJ/mol with I⁻, ≈ 8 kJ/mol with catalase',
  },
  {
    id: 'ester',
    title: 'Fischer esterification',
    equation: 'CH3COOH + C2H5OH <=> CH3COOC2H5 + H2O',
    category: 'Organic',
    blurb: 'Acetic acid and ethanol condense to the fruity ester ethyl acetate — almost thermoneutral, so it sits at equilibrium.',
  },
  { id: 'thermite', title: 'Thermite', equation: 'Fe2O3 + 2Al -> Al2O3 + 2Fe', category: 'Redox', blurb: 'Reaches ~2,500 °C — hot enough to weld railway tracks.' },
  {
    id: 'lime',
    title: 'Limestone calcination',
    equation: 'CaCO3 -> CaO + CO2',
    category: 'Decomposition',
    blurb: 'Kilns at ~900 °C turn limestone into quicklime for cement.',
    ea: 180,
    eaNote: 'Typical kinetic value, depends on particle size',
  },
  { id: 'zinc', title: 'Zinc in acid', equation: 'Zn + HCl -> ZnCl2 + H2', category: 'Redox', blurb: 'A classic lab source of hydrogen gas.' },
  { id: 'silver', title: 'Silver chloride precipitate', equation: 'AgNO3 + NaCl -> AgCl + NaNO3', category: 'Acid–base', blurb: 'A white curd of AgCl appears instantly — the test for chloride ions.' },
  {
    id: 'hi',
    title: 'Hydrogen iodide equilibrium',
    equation: 'H2(g) + I2(g) <=> 2HI(g)',
    category: 'Equilibrium',
    blurb: 'Bodenstein’s classic gas-phase equilibrium studied since the 1890s.',
    ea: 165,
    eaNote: 'Bodenstein-type kinetics',
  },
  { id: 'sodium', title: 'Sodium in water', equation: 'Na + H2O -> NaOH + H2', category: 'Redox', blurb: 'Alkali metals skate across water, releasing hydrogen that can ignite.' },
  { id: 'contact', title: 'Contact process', equation: '2SO2 + O2 <=> 2SO3', category: 'Equilibrium', blurb: 'Key step in making sulfuric acid, run over a V₂O₅ catalyst.' },
  { id: 'no2', title: 'NO₂ dimerisation', equation: '2NO2 <=> N2O4', category: 'Equilibrium', blurb: 'Brown NO₂ pairs into colourless N₂O₄ — the textbook Le Chatelier demo.' },
];
