import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from './render/stage';
import { Backdrop } from './ui/Backdrop';
import { LibrarySheet } from './ui/LibrarySheet';
import { MoleculeMode } from './ui/molecule/MoleculeMode';
import { Nav, type Mode } from './ui/Nav';
import { ReactionMode } from './ui/reaction/ReactionMode';

interface HashState {
  mode: Mode;
  molecule: string;
  reaction: string;
}

const DEFAULTS: HashState = { mode: 'molecule', molecule: 'Caffeine', reaction: 'CH4 + 2O2 -> CO2 + 2H2O' };

function readHash(): HashState {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const m = p.get('m');
  const r = p.get('r');
  return {
    mode: r && !m ? 'reaction' : p.get('mode') === 'reaction' ? 'reaction' : DEFAULTS.mode,
    molecule: m ?? DEFAULTS.molecule,
    reaction: r ?? DEFAULTS.reaction,
  };
}

function writeHash(s: HashState) {
  const p = new URLSearchParams();
  if (s.mode === 'reaction') p.set('r', s.reaction);
  else p.set('m', s.molecule);
  const next = '#' + p.toString();
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

export default function App() {
  const initial = useRef(readHash());
  const [mode, setMode] = useState<Mode>(initial.current.mode);
  const [molecule, setMolecule] = useState(initial.current.molecule);
  const [reaction, setReaction] = useState(initial.current.reaction);
  const [stage, setStage] = useState<Stage | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [library, setLibrary] = useState(false);
  const [request, setRequest] = useState<{ q: string; n: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = new Stage(hostRef.current!);
    setStage(s);
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) (window as unknown as { __stage: Stage }).__stage = s;
    return () => s.dispose();
  }, []);

  useEffect(() => writeHash({ mode, molecule, reaction }), [mode, molecule, reaction]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const pickFromLibrary = useCallback((name: string) => {
    setLibrary(false);
    setMolecule(name);
    setMode('molecule');
    setRequest((r) => ({ q: name, n: (r?.n ?? 0) + 1 }));
  }, []);

  return (
    <>
      <Backdrop />
      <div className="app">
        <Nav
          mode={mode}
          onMode={setMode}
          onLibrary={() => setLibrary(true)}
          onShare={() => {
            void navigator.clipboard?.writeText(window.location.href).then(
              () => setToast('Link copied — it reopens this exact view'),
              () => setToast('Copy the address bar to share this view'),
            );
          }}
        />
        <aside className="inspector" aria-label={mode === 'molecule' ? 'Molecule inspector' : 'Reaction inspector'}>
          {mode === 'molecule' ? (
            <MoleculeMode stage={stage} overlay={overlay} initialQuery={molecule} onQueryChange={setMolecule} requestedQuery={request} />
          ) : (
            <ReactionMode stage={stage} overlay={overlay} initialQuery={reaction} onQueryChange={setReaction} />
          )}
        </aside>
        <section className="stage" aria-label="3D viewport">
          <div ref={hostRef} className="stage-host" />
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          <div ref={setOverlay} />
        </section>
      </div>
      {library && <LibrarySheet onClose={() => setLibrary(false)} onPick={pickFromLibrary} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
