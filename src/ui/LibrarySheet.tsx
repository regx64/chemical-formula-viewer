import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { conventionalFormula, hillFormula, parseFormula } from '../chem/formula';
import { compositionOf } from '../chem/resolve';
import { parseSmiles } from '../chem/smiles';
import { LIBRARY, type LibraryCategory } from '../data/library';
import { Formula } from './primitives';

const ORDER: LibraryCategory[] = ['Essentials', 'VSEPR', 'Organic', 'Aromatic', 'Biomolecules', 'Pharma', 'Inorganic', 'Materials'];

export function LibrarySheet({ onClose, onPick }: { onClose: () => void; onPick: (name: string) => void }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const entries = useMemo(
    () =>
      LIBRARY.map((e) => {
        const g = e.formula ? parseFormula(e.formula) : compositionOf(parseSmiles(e.smiles!));
        return { ...e, hill: hillFormula(g.composition, g.charge), shown: e.display ?? conventionalFormula(g.composition, g.charge) };
      }),
    [],
  );
  const filtered = entries.filter((e) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return e.name.toLowerCase().includes(s) || e.hill.toLowerCase().includes(s) || e.shown.toLowerCase().includes(s) || e.aliases?.some((a) => a.toLowerCase().includes(s));
  });
  let delay = 0;
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Molecule library" onClick={onClose}>
      <button className="icon-btn sheet-close" onClick={onClose} aria-label="Close library">
        <X size={20} weight="light" />
      </button>
      <div className="sheet-inner" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <span className="eyebrow accent">{LIBRARY.length} curated structures</span>
            <h2>Library</h2>
          </div>
          <div className="command-field" style={{ width: 'min(340px, 100%)' }}>
            <MagnifyingGlass size={17} weight="light" color="var(--text-3)" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or formula" aria-label="Filter library" />
          </div>
        </div>
        <div className="sheet-scroll">
          {ORDER.map((cat) => {
            const items = filtered.filter((e) => e.category === cat);
            if (!items.length) return null;
            return (
              <div className="sheet-group" key={cat}>
                <h3>{cat}</h3>
                <div className="sheet-grid">
                  {items.map((e) => (
                    <button
                      key={e.name}
                      className="lib-card"
                      style={{ animationDelay: `${Math.min(600, (delay += 18))}ms` }}
                      onClick={() => onPick(e.name)}
                    >
                      <span className="n">
                        {e.name}
                        <Formula text={e.shown} className="f" />
                      </span>
                      <span className="b">{e.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
