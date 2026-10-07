export type LibraryCategory =
  | 'Essentials'
  | 'Organic'
  | 'Aromatic'
  | 'Biomolecules'
  | 'Pharma'
  | 'Inorganic'
  | 'VSEPR'
  | 'Materials';

export interface LibraryEntry {
  name: string;
  smiles?: string;
  /** special generators for structures that SMILES embedding can't do justice */
  special?: 'c60' | 'nacl' | 'diamond' | 'graphene';
  aliases?: string[];
  category: LibraryCategory;
  blurb: string;
  /** formula unit for crystals/clusters whose atom count differs from the formula */
  formula?: string;
  /** display formula override */
  display?: string;
  /** preferred isomer for its molecular formula when several entries share one */
  preferred?: boolean;
}

export const LIBRARY: LibraryEntry[] = [
  { name: 'Water', smiles: 'O', category: 'Essentials', blurb: 'Bent molecule (104.5°) whose two lone pairs make it a superb hydrogen-bonding solvent.', preferred: true },
  { name: 'Methane', smiles: 'C', category: 'Essentials', blurb: 'The simplest alkane — a perfect tetrahedron and the main component of natural gas.', preferred: true },
  { name: 'Ammonia', smiles: 'N', category: 'Essentials', blurb: 'Trigonal pyramidal; produced at ~150 Mt per year by the Haber–Bosch process.', preferred: true },
  { name: 'Carbon dioxide', smiles: 'O=C=O', category: 'Essentials', blurb: 'Linear and non-polar overall, despite two strongly polar C=O bonds.', preferred: true },
  { name: 'Carbon monoxide', smiles: '[C-]#[O+]', category: 'Essentials', blurb: 'A triple bond with a formal charge on each atom; binds haemoglobin ~200× more strongly than O₂.', preferred: true },
  { name: 'Oxygen', smiles: 'O=O', aliases: ['dioxygen'], category: 'Essentials', blurb: 'A diradical in its ground (triplet) state — the reason it is paramagnetic.', preferred: true },
  { name: 'Ozone', smiles: '[O-][O+]=O', category: 'Essentials', blurb: 'Bent allotrope of oxygen that shields Earth from UV-B and UV-C radiation.', preferred: true },
  { name: 'Hydrogen', smiles: '[H][H]', aliases: ['dihydrogen'], category: 'Essentials', blurb: 'The lightest molecule; the H–H bond is 74 pm long.', preferred: true },
  { name: 'Nitrogen', smiles: 'N#N', aliases: ['dinitrogen'], category: 'Essentials', blurb: 'A 945 kJ/mol triple bond makes N₂ remarkably unreactive.', preferred: true },
  { name: 'Chlorine', smiles: 'ClCl', category: 'Essentials', blurb: 'Yellow-green diatomic halogen and a powerful oxidiser.', preferred: true },
  { name: 'Fluorine', smiles: 'FF', category: 'Essentials', blurb: 'The most electronegative element, with an unusually weak F–F bond.', preferred: true },
  { name: 'Bromine', smiles: 'BrBr', category: 'Essentials', blurb: 'One of only two elements that are liquid at room temperature.', preferred: true },
  { name: 'Iodine', smiles: 'II', category: 'Essentials', blurb: 'Sublimes into a violet vapour.', preferred: true },
  { name: 'Hydrogen peroxide', smiles: 'OO', category: 'Essentials', blurb: 'Non-planar “open book” shape with a weak O–O bond.', preferred: true },
  { name: 'Hydrogen chloride', smiles: 'Cl', aliases: ['hydrochloric acid'], category: 'Essentials', blurb: 'Dissolves in water to give hydrochloric acid.', preferred: true },
  { name: 'Hydrogen fluoride', smiles: 'F', aliases: ['hydrofluoric acid'], category: 'Essentials', blurb: 'Forms strong hydrogen bonds — a weak acid that etches glass.', preferred: true },
  { name: 'Hydrogen bromide', smiles: 'Br', category: 'Essentials', blurb: 'A strong acid in water.', preferred: true },
  { name: 'Hydrogen iodide', smiles: 'I', category: 'Essentials', blurb: 'The strongest of the hydrohalic acids.', preferred: true },
  { name: 'Hydrogen sulfide', smiles: 'S', category: 'Essentials', blurb: 'Smells of rotten eggs; bent like water but with a ~92° angle.', preferred: true },
  { name: 'Hydrogen cyanide', smiles: 'C#N', display: 'HCN', category: 'Essentials', blurb: 'Linear, highly toxic and an important industrial feedstock.', preferred: true },
  { name: 'Nitric oxide', smiles: '[N]=O', category: 'Essentials', blurb: 'A radical signalling molecule in the human body.', preferred: true },
  { name: 'Nitrogen dioxide', smiles: '[O-][N+]=O', category: 'Essentials', blurb: 'Brown, bent radical gas responsible for urban smog colour.', preferred: true },
  { name: 'Nitrous oxide', smiles: '[N-]=[N+]=O', aliases: ['laughing gas'], category: 'Essentials', blurb: 'Linear N–N–O; used as an anaesthetic and propellant.', preferred: true },
  { name: 'Sulfur dioxide', smiles: 'O=S=O', category: 'Essentials', blurb: 'Bent (119°) — a lone pair on sulfur makes the difference from CO₂.', preferred: true },
  { name: 'Sulfur trioxide', smiles: 'O=S(=O)=O', category: 'Essentials', blurb: 'Trigonal planar; reacts violently with water to give sulfuric acid.', preferred: true },

  { name: 'Ethane', smiles: 'CC', category: 'Organic', blurb: 'Two tetrahedral carbons with free rotation about the C–C bond.', preferred: true },
  { name: 'Ethylene', smiles: 'C=C', aliases: ['ethene'], category: 'Organic', blurb: 'Planar; the C=C π bond locks rotation. Feedstock for polyethylene.', preferred: true },
  { name: 'Acetylene', smiles: 'C#C', aliases: ['ethyne'], category: 'Organic', blurb: 'Linear sp carbons; burns at ~3,300 °C in oxy-acetylene torches.', preferred: true },
  { name: 'Propane', smiles: 'CCC', category: 'Organic', blurb: 'Bottled fuel gas.', preferred: true },
  { name: 'Butane', smiles: 'CCCC', aliases: ['n-butane'], category: 'Organic', blurb: 'Lighter fuel; the classic example of gauche/anti conformers.', preferred: true },
  { name: 'Isobutane', smiles: 'CC(C)C', aliases: ['2-methylpropane'], category: 'Organic', blurb: 'Branched isomer of butane used as a refrigerant (R-600a).' },
  { name: 'Octane', smiles: 'CCCCCCCC', aliases: ['n-octane'], category: 'Organic', blurb: 'Straight-chain C₈ alkane.', preferred: true },
  { name: 'Isooctane', smiles: 'CC(C)CC(C)(C)C', aliases: ['2,2,4-trimethylpentane'], category: 'Organic', blurb: 'Defines 100 on the octane rating scale.' },
  { name: 'Cyclohexane', smiles: 'C1CCCCC1', category: 'Organic', blurb: 'Adopts a strain-free chair conformation.', preferred: true },
  { name: 'Methanol', smiles: 'CO', display: 'CH3OH', aliases: ['methyl alcohol'], category: 'Organic', blurb: 'Simplest alcohol; toxic and used as a fuel.', preferred: true },
  { name: 'Ethanol', smiles: 'CCO', display: 'C2H5OH', aliases: ['ethyl alcohol', 'alcohol', 'C2H5OH'], category: 'Organic', blurb: 'The alcohol in beverages — and an isomer of dimethyl ether.', preferred: true },
  { name: 'Dimethyl ether', smiles: 'COC', aliases: ['methoxymethane'], category: 'Organic', blurb: 'Same formula as ethanol (C₂H₆O) but no O–H bond: a gas at room temperature.' },
  { name: 'Formaldehyde', smiles: 'C=O', aliases: ['methanal'], category: 'Organic', blurb: 'Simplest aldehyde; trigonal planar carbon.', preferred: true },
  { name: 'Formic acid', smiles: 'OC=O', display: 'HCOOH', aliases: ['methanoic acid'], category: 'Organic', blurb: 'Found in ant venom.', preferred: true },
  { name: 'Acetic acid', smiles: 'CC(=O)O', display: 'CH3COOH', aliases: ['ethanoic acid', 'vinegar', 'CH3COOH'], category: 'Organic', blurb: 'Gives vinegar its sour taste and smell.', preferred: true },
  { name: 'Acetone', smiles: 'CC(C)=O', aliases: ['propanone'], category: 'Organic', blurb: 'Common solvent; simplest ketone.', preferred: true },
  { name: 'Ethyl acetate', smiles: 'CCOC(C)=O', category: 'Organic', blurb: 'Fruity-smelling ester formed from ethanol and acetic acid.', preferred: true },
  { name: 'Methyl acetate', smiles: 'COC(C)=O', category: 'Organic', blurb: 'Volatile ester with a glue-like odour.', preferred: true },
  { name: 'Glycerol', smiles: 'OCC(O)CO', aliases: ['glycerin'], category: 'Organic', blurb: 'Triol backbone of fats and oils.', preferred: true },
  { name: 'Chloroform', smiles: 'ClC(Cl)Cl', aliases: ['trichloromethane'], category: 'Organic', blurb: 'Dense solvent once used as an anaesthetic.', preferred: true },
  { name: 'Carbon tetrachloride', smiles: 'ClC(Cl)(Cl)Cl', category: 'Organic', blurb: 'Perfectly tetrahedral, non-polar solvent.', preferred: true },
  { name: 'Urea', smiles: 'NC(N)=O', display: 'CO(NH2)2', category: 'Organic', blurb: 'First organic compound synthesised from inorganic reagents (Wöhler, 1828).', preferred: true },

  { name: 'Benzene', smiles: 'c1ccccc1', category: 'Aromatic', blurb: 'Six delocalised π electrons make a flat, extra-stable ring.', preferred: true },
  { name: 'Toluene', smiles: 'Cc1ccccc1', aliases: ['methylbenzene'], category: 'Aromatic', blurb: 'Benzene with a methyl group; widely used solvent.', preferred: true },
  { name: 'Phenol', smiles: 'Oc1ccccc1', category: 'Aromatic', blurb: 'Weakly acidic aromatic alcohol.', preferred: true },
  { name: 'Naphthalene', smiles: 'c1ccc2ccccc2c1', category: 'Aromatic', blurb: 'Two fused benzene rings; mothball scent.', preferred: true },
  { name: 'Pyridine', smiles: 'c1ccncc1', category: 'Aromatic', blurb: 'Benzene with one CH replaced by N — a basic aromatic.', preferred: true },
  { name: 'TNT', smiles: 'Cc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]', aliases: ['trinitrotoluene'], category: 'Aromatic', blurb: 'Explosive standard for energy release (4.184 GJ per tonne).', preferred: true },
  { name: 'Benzoic acid', smiles: 'OC(=O)c1ccccc1', category: 'Aromatic', blurb: 'Food preservative (E210).', preferred: true },

  { name: 'Glucose', smiles: 'OCC1OC(O)C(O)C(O)C1O', aliases: ['dextrose', 'blood sugar', 'C6H12O6'], category: 'Biomolecules', blurb: 'β-D-Glucopyranose: the ring form of life’s primary fuel.', preferred: true },
  { name: 'Sucrose', smiles: 'OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O', aliases: ['table sugar', 'sugar'], category: 'Biomolecules', blurb: 'Glucose and fructose joined by a glycosidic bond.', preferred: true },
  { name: 'Glycine', smiles: 'NCC(=O)O', category: 'Biomolecules', blurb: 'The simplest amino acid.', preferred: true },
  { name: 'Alanine', smiles: 'CC(N)C(=O)O', category: 'Biomolecules', blurb: 'Small chiral amino acid.', preferred: true },
  { name: 'Adenine', smiles: 'Nc1ncnc2[nH]cnc12', category: 'Biomolecules', blurb: 'Purine nucleobase found in DNA, RNA and ATP.', preferred: true },
  { name: 'Dopamine', smiles: 'NCCc1ccc(O)c(O)c1', category: 'Biomolecules', blurb: 'Neurotransmitter of motivation and reward.', preferred: true },
  { name: 'Serotonin', smiles: 'NCCc1c[nH]c2ccc(O)cc12', category: 'Biomolecules', blurb: 'Neurotransmitter involved in mood regulation.', preferred: true },
  { name: 'Adrenaline', smiles: 'CNCC(O)c1ccc(O)c(O)c1', aliases: ['epinephrine'], category: 'Biomolecules', blurb: 'The fight-or-flight hormone.', preferred: true },
  { name: 'Cholesterol', smiles: 'CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C', category: 'Biomolecules', blurb: 'Steroid essential to cell membranes.', preferred: true },
  { name: 'Vanillin', smiles: 'COc1cc(C=O)ccc1O', category: 'Biomolecules', blurb: 'Primary flavour compound of vanilla.', preferred: true },
  { name: 'Capsaicin', smiles: 'COc1cc(CNC(=O)CCCCC=CC(C)C)ccc1O', category: 'Biomolecules', blurb: 'Makes chilli peppers hot by activating the TRPV1 receptor.', preferred: true },

  { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', category: 'Pharma', blurb: 'A purine alkaloid; adenosine-receptor antagonist that keeps you awake.', preferred: true },
  { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', aliases: ['acetylsalicylic acid'], category: 'Pharma', blurb: 'Irreversibly acetylates COX enzymes.', preferred: true },
  { name: 'Ibuprofen', smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', category: 'Pharma', blurb: 'Non-steroidal anti-inflammatory drug.', preferred: true },
  { name: 'Paracetamol', smiles: 'CC(=O)Nc1ccc(O)cc1', aliases: ['acetaminophen'], category: 'Pharma', blurb: 'Analgesic and fever reducer.', preferred: true },
  { name: 'Nicotine', smiles: 'CN1CCCC1c1cccnc1', category: 'Pharma', blurb: 'Alkaloid that acts on nicotinic acetylcholine receptors.', preferred: true },
  { name: 'Penicillin G', smiles: 'CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O', aliases: ['benzylpenicillin', 'penicillin'], category: 'Pharma', blurb: 'The first β-lactam antibiotic; its strained four-membered ring is the warhead.', preferred: true },

  { name: 'Sulfuric acid', smiles: 'OS(=O)(=O)O', category: 'Inorganic', blurb: 'The most-produced industrial chemical in the world.', preferred: true },
  { name: 'Nitric acid', smiles: 'O[N+](=O)[O-]', category: 'Inorganic', blurb: 'Strong oxidising acid used for fertilisers and explosives.', preferred: true },
  { name: 'Phosphoric acid', smiles: 'OP(=O)(O)O', category: 'Inorganic', blurb: 'Gives cola its tang.', preferred: true },
  { name: 'Carbonic acid', smiles: 'OC(=O)O', display: 'H2CO3', category: 'Inorganic', blurb: 'Forms when CO₂ dissolves in water.', preferred: true },
  { name: 'Ammonium', smiles: '[NH4+]', category: 'Inorganic', blurb: 'Tetrahedral cation formed by protonating ammonia.', preferred: true },
  { name: 'Hydroxide', smiles: '[OH-]', category: 'Inorganic', blurb: 'The base in aqueous chemistry.', preferred: true },
  { name: 'Hydronium', smiles: '[OH3+]', category: 'Inorganic', blurb: 'Trigonal pyramidal; the form H⁺ takes in water.', preferred: true },
  { name: 'Sulfate', smiles: '[O-]S(=O)(=O)[O-]', category: 'Inorganic', blurb: 'Tetrahedral oxyanion.', preferred: true },
  { name: 'Nitrate', smiles: '[O-][N+](=O)[O-]', category: 'Inorganic', blurb: 'Trigonal planar with three equivalent resonance structures.', preferred: true },
  { name: 'Carbonate', smiles: '[O-]C(=O)[O-]', category: 'Inorganic', blurb: 'Trigonal planar anion of limestone and chalk.', preferred: true },
  { name: 'Phosphate', smiles: '[O-]P(=O)([O-])[O-]', category: 'Inorganic', blurb: 'Backbone of DNA and the energy currency in ATP.', preferred: true },

  { name: 'Boron trifluoride', smiles: 'FB(F)F', category: 'VSEPR', blurb: 'AX₃ — trigonal planar, a classic Lewis acid.', preferred: true },
  { name: 'Phosphorus pentachloride', smiles: 'ClP(Cl)(Cl)(Cl)Cl', category: 'VSEPR', blurb: 'AX₅ — trigonal bipyramidal (90° and 120° angles).', preferred: true },
  { name: 'Sulfur tetrafluoride', smiles: 'FS(F)(F)F', category: 'VSEPR', blurb: 'AX₄E — seesaw: the lone pair sits in an equatorial slot.', preferred: true },
  { name: 'Chlorine trifluoride', smiles: 'FCl(F)F', category: 'VSEPR', blurb: 'AX₃E₂ — T-shaped. Ignites sand, glass and asbestos.', preferred: true },
  { name: 'Sulfur hexafluoride', smiles: 'FS(F)(F)(F)(F)F', category: 'VSEPR', blurb: 'AX₆ — octahedral; a dense, inert insulating gas.', preferred: true },
  { name: 'Xenon tetrafluoride', smiles: 'F[Xe](F)(F)F', category: 'VSEPR', blurb: 'AX₄E₂ — square planar; proof that noble gases can react.', preferred: true },
  { name: 'Xenon difluoride', smiles: 'F[Xe]F', category: 'VSEPR', blurb: 'AX₂E₃ — linear, three lone pairs around the equator.', preferred: true },
  { name: 'Iodine heptafluoride', smiles: 'FI(F)(F)(F)(F)(F)F', category: 'VSEPR', blurb: 'AX₇ — pentagonal bipyramid.', preferred: true },
  { name: 'Bromine pentafluoride', smiles: 'FBr(F)(F)(F)F', category: 'VSEPR', blurb: 'AX₅E — square pyramidal.', preferred: true },

  { name: 'Buckminsterfullerene', special: 'c60', formula: 'C60', aliases: ['C60', 'buckyball', 'fullerene'], category: 'Materials', blurb: 'Truncated-icosahedron cage of 60 carbons — 12 pentagons, 20 hexagons.', preferred: true },
  { name: 'Sodium chloride', special: 'nacl', formula: 'NaCl', aliases: ['table salt', 'salt', 'halite'], category: 'Materials', blurb: 'Rock-salt lattice: each ion octahedrally surrounded by six counter-ions.', preferred: true },
  { name: 'Diamond', special: 'diamond', formula: 'C', aliases: ['carbon'], category: 'Materials', blurb: 'Every carbon bonded tetrahedrally to four others — the hardest natural material.' },
  { name: 'Graphene', special: 'graphene', formula: 'C', category: 'Materials', blurb: 'A single sheet of sp² carbon one atom thick.' },
];
