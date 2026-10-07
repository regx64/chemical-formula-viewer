import { Fragment } from 'react';
import type { Reaction, ReactionSpecies } from '../../chem/reaction';
import { Formula } from '../primitives';

function Species({ s }: { s: ReactionSpecies }) {
  return (
    <div className="eq-species">
      <span className="main">
        {s.coefficient !== 1 && <span className="coef">{s.coefficient}</span>}
        <Formula text={s.text} />
        {s.state && <span className="state">({s.state})</span>}
      </span>
      <span className="label">
        <span className="dot" style={{ background: s.color }} />
        {s.name ?? 'generated'}
      </span>
    </div>
  );
}

export function EquationView({ reaction }: { reaction: Reaction }) {
  const side = (list: ReactionSpecies[]) =>
    list.map((s, i) => (
      <Fragment key={s.text + i}>
        {i > 0 && <span className="eq-op">+</span>}
        <Species s={s} />
      </Fragment>
    ));
  return (
    <div className="equation" aria-label="Balanced equation">
      {side(reaction.reactants)}
      <span className="eq-arrow" aria-label={reaction.reversible ? 'is in equilibrium with' : 'yields'}>
        {reaction.reversible ? '⇌' : '→'}
      </span>
      {side(reaction.products)}
    </div>
  );
}
