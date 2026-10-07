import { Atom, BookOpenText, Flask, LinkSimple } from '@phosphor-icons/react';

export type Mode = 'molecule' | 'reaction';

export function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="url(#g1)" strokeWidth="1.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="url(#g1)" strokeWidth="1.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="url(#g1)" strokeWidth="1.2" transform="rotate(-60 12 12)" />
      <circle cx="12" cy="12" r="2.1" fill="#6ef0d4" />
      <defs>
        <linearGradient id="g1" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#6ef0d4" />
          <stop offset="1" stopColor="#a796ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Nav({
  mode,
  onMode,
  onLibrary,
  onShare,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  onLibrary: () => void;
  onShare: () => void;
}) {
  return (
    <header className="nav">
      <div className="brand">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span>
          Orbital
          <small>Molecular studio</small>
        </span>
      </div>
      <nav className="island" role="tablist" aria-label="Mode">
        <button className="island-tab" role="tab" aria-selected={mode === 'molecule'} onClick={() => onMode('molecule')}>
          <Atom size={17} weight="light" />
          <span>
            Molecule<span className="label-long"> viewer</span>
          </span>
        </button>
        <button className="island-tab" role="tab" aria-selected={mode === 'reaction'} onClick={() => onMode('reaction')}>
          <Flask size={17} weight="light" />
          <span>
            Reaction<span className="label-long"> lab</span>
          </span>
        </button>
      </nav>
      <div className="nav-actions">
        <button className="ghost-btn" onClick={onLibrary} aria-label="Open molecule library">
          <BookOpenText size={16} weight="light" />
          <span className="label-long">Library</span>
        </button>
        <button className="icon-btn" onClick={onShare} title="Copy shareable link" aria-label="Copy shareable link">
          <LinkSimple size={18} weight="light" />
        </button>
      </div>
    </header>
  );
}
