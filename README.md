# Orbital — 3D molecules & reactions

A dark-only web studio for chemistry: type a **chemical formula, compound name or SMILES string** and explore the molecule in 3D, then switch to the **Reaction lab** to predict, balance and simulate reactions — with thermodynamics, an animated mechanism, an energy profile, live collision kinetics and a stoichiometry calculator.

Everything runs in the browser. No backend, no API keys.

## Features

### Molecule viewer
- **Any input**: formulas (`C8H10N4O2`, `Ca(OH)2`, `CuSO4·5H2O`, `SO4^2-`), names (`caffeine`, `table salt`), SMILES (`CC(=O)Oc1ccccc1C(=O)O`, or prefix `smiles:`), PubChem CIDs (`cid:2244`).
- **Where structures come from**, in order:
  1. A curated library of ~95 molecules, ions and materials (C₆₀, rock salt, diamond, graphene).
  2. **PubChem** when online — the computed 3D conformer, or a 2D record re-embedded in 3D. Formula searches list other isomers.
  3. A **local structure generator** when offline: it builds a valence-satisfying isomer from the formula (it handles hypervalent S/P/Cl/Xe, aromatic rings, ring closures, ionic compounds split into cations and polyatomic anions, and metallic FCC clusters).
- **3D geometry engine**: VSEPR electron-domain templates (lone pairs take equatorial/trans slots, so SF₄ is a seesaw, ClF₃ is T-shaped and XeF₄ is square planar) followed by a distance-geometry force field (bond lengths, 1–3 distances from ideal angles, π-system planarity, van der Waals repulsion) minimised with FIRE.
- Ball-and-stick, space-filling and stick styles. Double, triple and aromatic bonds are drawn in the π plane, and ionic contacts are dashed.
- Click 2, 3 or 4 atoms to measure a distance, bond angle or dihedral. Hover an atom to see its neighbours.
- Properties: molar mass, VSEPR class (AXₙEₘ) with the measured angle, degree of unsaturation, and a mass-percent composition bar coloured like the atoms.
- Export a PNG or an MDL `.mol` file. Every view has a shareable URL.

### Reaction lab
- **Product prediction** for combustion, synthesis, acid–base neutralisation, acid + carbonate, metal + acid (activity series), metal + water, single and double displacement (with solubility rules), halogen displacement, thermal decomposition, hydrogenation, hydration and Fischer esterification. It also says when a reaction does **not** happen (e.g. `Cu + HCl`).
- **Exact balancing** with rational null-space linear algebra (BigInt). Conserves charge for ionic equations such as `Cu + NO3^- + H^+ → Cu^2+ + NO + H2O`. If your coefficients are wrong it corrects them and tells you.
- **Thermodynamics** from tabulated standard ΔH°f and S° (~100 species). It gives ΔH°, ΔS°, ΔG(T), K and the crossover temperature. When species aren't tabulated it falls back to average bond enthalpies.
- **3D mechanism animation**: each reactant atom is mapped to a product atom with the Hungarian algorithm, and product molecules are rigidly superposed (Horn's quaternion method) onto the atoms they inherit, so atoms travel as little as possible. Old bonds stretch and thin out, partial bonds appear in the glowing activated complex, and the products separate. You can scrub, change speed and loop.
- **Energy profile** synced with the animation, with Eₐ and ΔH annotations and a catalysed curve.
- **Kinetics simulation**: Maxwell–Boltzmann particles in a box react on collision with Arrhenius probability. Temperature, catalyst and reversibility are adjustable, and reversible reactions reach dynamic equilibrium. A live concentration-vs-time chart runs alongside.
- **Stoichiometry**: enter masses to get the limiting reagent, theoretical yields, leftovers and heat released.

## Honest limitations
- A molecular formula does not identify a unique structure. Offline-generated structures are *one* valid isomer and are labelled that way.
- Stereochemistry in SMILES (`@`, `/`, `\`) is parsed but not enforced in the 3D layout.
- Activation energies are approximate literature values for the presets. Otherwise they are estimated with an Evans–Polanyi-style heuristic and labelled "estimated".
- The kinetics box compresses energies 4× so slow reactions stay watchable. Compare trends, not absolute rates.
- ΔG(T) assumes ΔH° and ΔS° don't change with temperature.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 95 unit tests for the chemistry engine
npm run typecheck
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

## Architecture

```
src/
  chem/          pure TypeScript chemistry engine (no DOM) — fully unit-tested
    elements.ts    periodic table (masses, CPK colours, radii, electronegativity)
    formula.ts     formula parser (groups, hydrates, charges, unicode sub/superscripts)
    smiles.ts      SMILES parser with implicit hydrogens and aromaticity
    embed.ts       VSEPR + force-field 3D coordinate generation
    builder.ts     formula → plausible structure (covalent, ionic, metallic)
    resolve.ts     library / SMILES / PubChem / generator resolution pipeline
    pubchem.ts     PubChem PUG-REST client
    balance.ts     exact equation balancing
    equation.ts    equation parser
    predict.ts     rule-based product prediction
    thermo.ts      ΔH, ΔS, ΔG, K, activation estimates, energy profile
    mechanism.ts   atom mapping + choreography for the animation
    kinetics.ts    collision-theory particle simulation
  render/        Three.js stage (instanced PBR atoms/bonds, labels, picking) and animation player
  ui/            React components (dark-only design system in styles/app.css)
  data/          curated molecules, reaction presets, thermodynamic tables
```

## Deployment

`.github/workflows/deploy.yml` type-checks, tests and builds on every push and pull request. Pushes to `main` are deployed to **GitHub Pages**: enable it under *Settings → Pages → Source: GitHub Actions*. The build uses relative asset paths, so the app also works from any static host or subfolder.
