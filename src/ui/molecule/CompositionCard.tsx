import { useState } from 'react';
import { ELEMENT_BY_SYMBOL, stageColor } from '../../chem/elements';
import type { Composition } from '../../chem/formula';
import { Bezel } from '../primitives';
import { massPercent } from './analysis';

export function CompositionCard({ composition }: { composition: Composition }) {
  const rows = massPercent(composition);
  const [active, setActive] = useState<string | null>(null);
  return (
    <Bezel className="reveal d3">
      <h3 className="card-title">
        Composition by mass
        <span className="right muted">colours match the 3D atoms</span>
      </h3>
      <div className="comp-bar" role="img" aria-label={rows.map((r) => `${r.el} ${r.pct.toFixed(1)}%`).join(', ')}>
        {rows.map((r) => (
          <div
            key={r.el}
            className={`comp-seg ${active === r.el ? 'active' : ''}`}
            style={{ width: `${r.pct}%`, background: stageColor(r.el), minWidth: 3 }}
            onMouseEnter={() => setActive(r.el)}
            onMouseLeave={() => setActive(null)}
            title={`${ELEMENT_BY_SYMBOL[r.el].name}: ${r.pct.toFixed(2)}%`}
          />
        ))}
      </div>
      <div className="comp-legend">
        {rows.map((r) => (
          <div key={r.el} className={`comp-row ${active === r.el ? 'active' : ''}`} onMouseEnter={() => setActive(r.el)} onMouseLeave={() => setActive(null)}>
            <span className="swatch" style={{ background: stageColor(r.el) }} />
            <span className="el">{r.el}</span>
            <span className="name">
              {ELEMENT_BY_SYMBOL[r.el].name} × {r.count}
            </span>
            <span className="pct">{r.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Bezel>
  );
}
