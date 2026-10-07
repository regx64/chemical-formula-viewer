import { useEffect, useState } from 'react';
import type { Reaction } from '../../chem/reaction';
import { Formula, fmt } from '../primitives';

export function Stoichiometry({ reaction }: { reaction: Reaction }) {
  const [grams, setGrams] = useState<string[]>([]);
  useEffect(() => {
    setGrams(reaction.reactants.map((r) => (r.coefficient * r.molarMass).toFixed(2)));
  }, [reaction]);

  const moles = reaction.reactants.map((r, i) => Math.max(0, Number(grams[i]) || 0) / r.molarMass);
  const extents = moles.map((n, i) => n / reaction.reactants[i].coefficient);
  const extent = Math.min(...extents);
  const limiting = extents.indexOf(extent);

  return (
    <div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Reactant</th>
            <th className="num">Mass (g)</th>
            <th className="num">mol</th>
            <th className="num">Left over</th>
          </tr>
        </thead>
        <tbody>
          {reaction.reactants.map((r, i) => (
            <tr key={r.text + i}>
              <td>
                <Formula text={r.text} className="mono" />{' '}
                {i === limiting && reaction.reactants.length > 1 && <span className="badge limiting">limiting</span>}
              </td>
              <td className="num">
                <input
                  inputMode="decimal"
                  aria-label={`Mass of ${r.text} in grams`}
                  value={grams[i] ?? ''}
                  onChange={(e) => setGrams((g) => g.map((x, k) => (k === i ? e.target.value : x)))}
                />
              </td>
              <td className="num">{fmt(moles[i], 3)}</td>
              <td className="num">{fmt((moles[i] - extent * r.coefficient) * r.molarMass, 2)} g</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="data-table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Theoretical yield</th>
            <th className="num">mol</th>
          </tr>
        </thead>
        <tbody>
          {reaction.products.map((p, i) => (
            <tr key={p.text + i}>
              <td>
                <Formula text={p.text} className="mono" />
              </td>
              <td className="num">{fmt(extent * p.coefficient * p.molarMass, 2)} g</td>
              <td className="num">{fmt(extent * p.coefficient, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reaction.thermo.dH !== undefined && Number.isFinite(extent) && (
        <p className="muted" style={{ margin: '14px 0 0' }}>
          Heat {reaction.thermo.dH < 0 ? 'released' : 'absorbed'}:{' '}
          <span className="mono" style={{ color: 'var(--text-1)' }}>
            {fmt(Math.abs(extent * reaction.thermo.dH), 1)} kJ
          </span>{' '}
          for this batch ({fmt(extent, 3)} mol of reaction).
        </p>
      )}
    </div>
  );
}
