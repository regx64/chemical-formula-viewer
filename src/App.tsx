import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from './render/stage';
import { Backdrop } from './ui/Backdrop';
import { LibrarySheet } from './ui/LibrarySheet';
import { MoleculeMode } from './ui/molecule/MoleculeMode';
import { Nav, type Mode } from './ui/Nav';
import { ReactionMode } from './ui/reaction/ReactionMode';

interface HashState {
  mode: Mode;
  molecule: string | null;
  reaction: string | null;
}

const DEFAULTS = { molecule: 'Caffeine', reaction: 'CH4 + 2O2 -> CO2 + 2H2O' };

function readHash(): HashState {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const m = p.get('m');
  const r = p.get('r');
  return { mode: r && !m ? 'reaction' : p.get('mode') === 'reaction' ? 'reaction' : 'molecule', molecule: m, reaction: r };
}

function hashFor(mode: Mode, molecule: string, reaction: string): string {
  const p = new URLSearchParams();
  if (mode === 'reaction') p.set('r', reaction);
  else p.set('m', molecule);
  return '#' + p.toString();
}

type Request = { q: string; n: number } | null;
const bump = (q: string) => (r: Request) => ({ q, n: (r?.n ?? 0) + 1 });

export default function App() {
  const initial = useRef(readHash());
  const [mode, setMode] = useState<Mode>(initial.current.mode);
  const [molecule, setMolecule] = useState(initial.current.molecule ?? DEFAULTS.molecule);
  const [reaction, setReaction] = useState(initial.current.reaction ?? DEFAULTS.reaction);
  const [stage, setStage] = useState<Stage | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [library, setLibrary] = useState(false);
  const [request, setRequest] = useState<Request>(null);
  const [reactionRequest, setReactionRequest] = useState<Request>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const s = new Stage(hostRef.current!);
    setStage(s);
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) (window as unknown as { __stage: Stage }).__stage = s;
    return () => s.dispose();
  }, []);

  // Each successfully shown molecule/reaction becomes a history entry, so Back/Forward walk through them.
  const firstWrite = useRef(true);
  useEffect(() => {
    const next = hashFor(mode, molecule, reaction);
    const first = firstWrite.current;
    firstWrite.current = false;
    if (window.location.hash === next) return;
    // normalise the landing URL in place; later changes are real navigation
    try {
      if (first) history.replaceState(null, '', next);
      else history.pushState(null, '', next);
    } catch {
      /* sandboxed frames may refuse history access; the app works without URL state */
    }
  }, [mode, molecule, reaction]);

  // Back/Forward or an edited link. Query state is only committed by the modes once a load succeeds.
  useEffect(() => {
    let last = window.location.hash;
    const onNav = () => {
      if (window.location.hash === last) return; // popstate + hashchange both fire for one traversal
      last = window.location.hash;
      const h = readHash();
      const switching = h.mode !== modeRef.current;
      if (h.mode === 'molecule' && h.molecule) {
        if (switching) setMolecule(h.molecule); // the mounting mode loads its initial query
        else setRequest(bump(h.molecule));
      } else if (h.mode === 'reaction' && h.reaction) {
        if (switching) setReaction(h.reaction);
        else setReactionRequest(bump(h.reaction));
      }
      setMode(h.mode);
    };
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const pickFromLibrary = useCallback((name: string) => {
    setLibrary(false);
    if (modeRef.current === 'molecule') setRequest(bump(name));
    else {
      setMolecule(name);
      setMode('molecule');
    }
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
            <ReactionMode stage={stage} overlay={overlay} initialQuery={reaction} onQueryChange={setReaction} requestedQuery={reactionRequest} />
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
