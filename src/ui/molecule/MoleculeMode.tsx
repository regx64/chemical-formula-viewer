import {
  ArrowsClockwise,
  Camera,
  CornersOut,
  Crosshair,
  DownloadSimple,
  Info,
  TextAa,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ELEMENT_BY_SYMBOL } from '../../chem/elements';
import { conventionalFormula, FormulaError, molarMass, parseFormula } from '../../chem/formula';
import { generated, isError, resolveOffline, resolveOnline, searchLibrary, compositionOf, type Resolved } from '../../chem/resolve';
import { writeMolfile } from '../../chem/sdf';
import { parseSmiles } from '../../chem/smiles';
import type { RenderStyle, Stage } from '../../render/stage';
import { CommandBar, type Suggestion } from '../CommandBar';
import { Bezel, Formula, Segmented, fmt } from '../primitives';
import { degreeOfUnsaturation, measure, vseprShape } from './analysis';
import { CompositionCard } from './CompositionCard';

const EXAMPLES = ['Caffeine', 'C6H6', 'SF6', 'C60', 'Glucose', 'XeF4', 'C2H6O', 'NaCl', 'Aspirin', 'Penicillin G'];

type Status = { kind: 'error' | 'info'; text: string } | null;

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function MoleculeMode({
  stage,
  overlay,
  initialQuery,
  onQueryChange,
  requestedQuery,
}: {
  stage: Stage | null;
  overlay: HTMLElement | null;
  initialQuery: string;
  onQueryChange: (q: string) => void;
  requestedQuery: { q: string; n: number } | null;
}) {
  const [input, setInput] = useState(initialQuery);
  const [result, setResult] = useState<Resolved | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<RenderStyle>('ball-stick');
  const [labels, setLabels] = useState(false);
  const [spin, setSpin] = useState(true);
  const [selection, setSelection] = useState<number[]>([]);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const show = useCallback(
    (r: Resolved, query: string) => {
      setResult(r);
      setSelection([]);
      onQueryChange(query);
      if (!stage) return;
      stage.setSelection([]);
      stage.setFrame(
        { atoms: r.molecule.atoms.map((a) => ({ el: a.el, pos: [a.x, a.y, a.z], charge: a.charge })), bonds: r.molecule.bonds },
        { enter: true },
      );
      stage.fitToFrame();
    },
    [stage, onQueryChange],
  );

  const load = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      abortRef.current?.abort();
      setStatus(null);
      if (!q) return;
      let offline: ReturnType<typeof resolveOffline>;
      try {
        offline = resolveOffline(q, { allowGenerated: false });
      } catch (e) {
        setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
        return;
      }
      if (offline && isError(offline)) {
        setStatus({ kind: 'error', text: offline.error });
        return;
      }
      if (offline) {
        show(offline, q);
        return;
      }
      // not in the library → PubChem, then fall back to a generated structure
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const timer = setTimeout(() => ctrl.abort(), 9000);
      setBusy(true);
      let online: Resolved | null = null;
      let networkFailed = false;
      try {
        online = await resolveOnline(q, ctrl.signal);
      } catch {
        networkFailed = true;
      } finally {
        clearTimeout(timer);
        if (abortRef.current === ctrl) setBusy(false);
      }
      if (abortRef.current !== ctrl) return;
      if (online) {
        show(online, q);
        return;
      }
      let parsed: ReturnType<typeof parseFormula> | null = null;
      try {
        parsed = parseFormula(q);
      } catch (e) {
        if (!(e instanceof FormulaError)) throw e;
      }
      if (parsed) {
        const g = generated(parsed.composition, parsed.charge);
        if (isError(g)) setStatus({ kind: 'error', text: g.error });
        else {
          show({ ...g, displayFormula: parsed.text, name: parsed.text }, q);
          setStatus({
            kind: 'info',
            text: networkFailed
              ? 'PubChem is unreachable, so this structure was generated locally from valence rules.'
              : 'PubChem has no exact match, so this structure was generated locally from valence rules.',
          });
        }
        return;
      }
      setStatus({
        kind: 'error',
        text: networkFailed
          ? `“${q}” isn’t in the offline library and PubChem is unreachable. Try a formula (C8H10N4O2) or SMILES (CCO).`
          : `Couldn’t find “${q}”. Try a molecular formula (C8H10N4O2), a SMILES string (CCO) or another name.`,
      });
    },
    [show],
  );

  // initial load once the stage exists
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!stage || loadedOnce.current) return;
    loadedOnce.current = true;
    void load(initialQuery);
  }, [stage, initialQuery, load]);

  // external requests (library sheet, hash changes); requests made before mount are already in initialQuery
  const handled = useRef(requestedQuery?.n ?? 0);
  useEffect(() => {
    if (!requestedQuery || !stage || requestedQuery.n === handled.current) return;
    handled.current = requestedQuery.n;
    setInput(requestedQuery.q);
    void load(requestedQuery.q);
  }, [requestedQuery, stage, load]);

  useEffect(() => {
    if (!stage) return;
    stage.setStyle(style);
    stage.fitToFrame();
  }, [stage, style]);
  useEffect(() => {
    stage?.setLabels(labels);
  }, [stage, labels]);
  useEffect(() => {
    stage?.setAutoRotate(spin);
  }, [stage, spin]);
  useEffect(() => {
    if (!stage) return;
    stage.onHover = (h) => setHover(h ? { index: h.index, x: h.screen.x, y: h.screen.y } : null);
    stage.onPick = (i) => {
      setSpin(false);
      setSelection((s) => {
        const next = s.includes(i) ? s.filter((x) => x !== i) : [...s, i].slice(-4);
        stage.setSelection(next);
        return next;
      });
    };
    stage.onFrame = null;
    return () => {
      stage.onHover = null;
      stage.onPick = null;
    };
  }, [stage]);

  const suggest = useCallback((q: string): Suggestion[] => {
    return searchLibrary(q, 7).map((e) => {
      let f = '';
      try {
        const g = e.formula ? parseFormula(e.formula) : e.smiles ? compositionOf(parseSmiles(e.smiles)) : null;
        if (g) f = e.display ?? conventionalFormula(g.composition, g.charge);
      } catch {
        /* ignore */
      }
      return { key: e.name, value: e.name, label: e.name, hint: f ? <Formula text={f} /> : e.category };
    });
  }, []);

  const mol = result?.molecule;
  const covalentBonds = mol?.bonds.filter((b) => b.order > 0).length ?? 0;
  const shape = useMemo(() => (mol ? vseprShape(mol) : null), [mol]);
  const dou = result ? degreeOfUnsaturation(result.composition) : null;
  const measurements = mol ? measure(mol, selection) : [];
  const formulaText = result?.displayFormula ?? '';

  const hoverAtom = hover && mol?.atoms[hover.index];
  const hoverNeighbors = hover && mol ? mol.bonds.filter((b) => b.a === hover.index || b.b === hover.index) : [];

  const toolbar = (
    <>
      {result && (
        <div className="hud">
          <div>
            <div className="hud-title">{result.sourceLabel.toUpperCase()}</div>
            <div className="hud-big">{result.name === result.displayFormula ? <Formula text={result.name} /> : result.name}</div>
          </div>
          <div className="hud-meta" style={{ textAlign: 'right' }}>
            <div>{mol!.atoms.length} ATOMS · {covalentBonds} BONDS</div>
            <div>{selection.length ? `${selection.length} SELECTED` : 'CLICK ATOMS TO MEASURE'}</div>
          </div>
        </div>
      )}
      {hoverAtom && (
        <div className="tooltip" style={{ left: hover!.x, top: hover!.y }}>
          <div className="row">
            <strong>
              {ELEMENT_BY_SYMBOL[hoverAtom.el]?.name} · {hoverAtom.el}
              {hover!.index + 1}
            </strong>
          </div>
          <div className="row">
            <span>Atomic mass</span>
            <span className="mono">{ELEMENT_BY_SYMBOL[hoverAtom.el]?.mass}</span>
          </div>
          <div className="row">
            <span>Bonded to</span>
            <span className="mono">
              {hoverNeighbors.length
                ? hoverNeighbors
                    .map((b) => {
                      const o = b.a === hover!.index ? b.b : b.a;
                      return mol!.atoms[o].el + (o + 1);
                    })
                    .slice(0, 5)
                    .join(' ') + (hoverNeighbors.length > 5 ? ' …' : '')
                : '—'}
            </span>
          </div>
          {hoverAtom.charge !== 0 && (
            <div className="row">
              <span>Formal charge</span>
              <span className="mono">{hoverAtom.charge > 0 ? '+' + hoverAtom.charge : '−' + Math.abs(hoverAtom.charge)}</span>
            </div>
          )}
        </div>
      )}
      <div className="toolbar" role="toolbar" aria-label="View controls">
        <Segmented
          label="Render style"
          value={style}
          onChange={setStyle}
          options={[
            { value: 'ball-stick', label: 'Ball & stick' },
            { value: 'spacefill', label: 'Space-fill' },
            { value: 'licorice', label: 'Sticks' },
          ]}
        />
        <span className="sep" />
        <button className="icon-btn" aria-pressed={labels} onClick={() => setLabels((v) => !v)} title="Atom labels" aria-label="Toggle atom labels">
          <TextAa size={18} weight="light" />
        </button>
        <button className="icon-btn" aria-pressed={spin} onClick={() => setSpin((v) => !v)} title="Auto-rotate" aria-label="Toggle auto-rotate">
          <ArrowsClockwise size={18} weight="light" />
        </button>
        <button className="icon-btn hide-sm" onClick={() => stage?.resetView()} title="Reset view" aria-label="Reset view">
          <Crosshair size={18} weight="light" />
        </button>
        <span className="sep" />
        <button
          className="icon-btn"
          onClick={() => stage && download(`${(result?.name ?? 'molecule').replace(/\W+/g, '-')}.png`, stage.screenshot())}
          title="Save PNG"
          aria-label="Save screenshot as PNG"
        >
          <Camera size={18} weight="light" />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            if (!mol) return;
            const blob = new Blob([writeMolfile(mol, result?.name)], { type: 'chemical/x-mdl-molfile' });
            const url = URL.createObjectURL(blob);
            download(`${(result?.name ?? 'molecule').replace(/\W+/g, '-')}.mol`, url);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          title="Download .mol file"
          aria-label="Download MDL molfile"
        >
          <DownloadSimple size={18} weight="light" />
        </button>
        <button
          className="icon-btn hide-sm"
          onClick={() => {
            const el = overlay?.parentElement;
            if (!el) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen?.();
          }}
          title="Fullscreen"
          aria-label="Toggle fullscreen"
        >
          <CornersOut size={18} weight="light" />
        </button>
      </div>
    </>
  );

  return (
    <>
      <Bezel className="reveal">
        <span className="eyebrow accent">3D structure engine</span>
        <h1 className="hero-title">
          Type a formula.
          <br />
          <em>See the molecule.</em>
        </h1>
        <p className="lede">Formulas, names or SMILES — geometry from VSEPR theory and a force field, or PubChem conformers when online.</p>
        <div style={{ marginTop: 18 }}>
          <CommandBar
            value={input}
            onChange={setInput}
            onSubmit={(v) => void load(v)}
            placeholder="C8H10N4O2, caffeine, CCO…"
            cta="Render"
            busy={busy}
            suggest={suggest}
            inputLabel="Chemical formula, name or SMILES"
          />
        </div>
        {status && (
          <div className={`status ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.kind === 'error' ? <WarningCircle size={16} weight="light" /> : <Info size={16} weight="light" />}
            <span>{status.text}</span>
          </div>
        )}
        <div className="chips" style={{ marginTop: 16 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="chip"
              onClick={() => {
                setInput(ex);
                void load(ex);
              }}
            >
              {/^[A-Z][a-z]?\d/.test(ex) || /^[A-Z][A-Z]/.test(ex) || ex === 'C60' ? <Formula text={ex} className="mono" /> : ex}
            </button>
          ))}
        </div>
      </Bezel>

      {result && mol && (
        <>
          <Bezel className="reveal d1" key={`head-${result.name}`}>
            <div className="result-head">
              <span className="source">
                <span className={`pip ${result.source === 'generated' ? 'generated' : result.source === 'pubchem' ? 'pubchem' : ''}`} />
                {result.sourceLabel}
              </span>
              <h2 className="result-name">{result.name === formulaText ? <Formula text={formulaText} /> : result.name}</h2>
              {result.name !== formulaText && <Formula text={formulaText} className="result-formula" />}
            </div>
            {result.description && <p className="blurb">{result.description}</p>}
            {result.note && <p className="note">{result.note}</p>}
            {result.alternatives.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="muted" style={{ marginBottom: 8 }}>
                  {result.source === 'smiles' ? 'Same formula in the library' : 'Other isomers with this formula'}
                </div>
                <div className="chips">
                  {result.alternatives.map((a) => (
                    <button
                      key={a.query}
                      className="chip"
                      onClick={() => {
                        setInput(a.query.startsWith('cid:') ? a.label : a.query);
                        void load(a.query);
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Bezel>

          <Bezel className="reveal d2" key={`stats-${result.name}`}>
            <h3 className="card-title">Properties</h3>
            <div className="bento">
              <div className="tile wide highlight">
                <div className="tile-label">Molar mass</div>
                <div className="tile-value">
                  {fmt(molarMass(result.composition), 3)}
                  <small>g/mol</small>
                </div>
              </div>
              <div className="tile wide">
                <div className="tile-label">Atoms · bonds</div>
                <div className="tile-value">
                  {result.isCluster ? '—' : mol.atoms.length}
                  <small>·</small> {result.isCluster ? '—' : covalentBonds}
                </div>
                {result.isCluster && <div className="tile-sub">{mol.atoms.length}-atom cluster shown</div>}
              </div>
              {shape ? (
                <div className="tile full">
                  <div className="tile-label">VSEPR geometry around {shape.center}</div>
                  <div className="tile-value">
                    {shape.name} <small>{shape.axe} · smallest angle {shape.angle.toFixed(1)}°</small>
                  </div>
                </div>
              ) : null}
              <div className="tile">
                <div className="tile-label">Elements</div>
                <div className="tile-value">{Object.keys(result.composition).length}</div>
              </div>
              <div className="tile">
                <div className="tile-label">Net charge</div>
                <div className="tile-value">{result.charge > 0 ? `+${result.charge}` : result.charge < 0 ? `−${-result.charge}` : '0'}</div>
              </div>
              <div className="tile">
                <div className="tile-label" title="Rings + π bonds">
                  Unsaturation
                </div>
                <div className="tile-value">{dou ?? '—'}</div>
              </div>
            </div>
          </Bezel>

          <CompositionCard composition={result.composition} />

          <Bezel className="reveal d4">
            <h3 className="card-title">
              Measure
              {selection.length > 0 && (
                <button
                  className="ghost-btn"
                  onClick={() => {
                    setSelection([]);
                    stage?.setSelection([]);
                  }}
                >
                  <X size={13} /> Clear
                </button>
              )}
            </h3>
            {measurements.length ? (
              <div className="measure-list">
                {measurements.map((m) => (
                  <div className="measure-row" key={m.label}>
                    <span className="k">{m.label}</span>
                    <span className="v">{m.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {selection.length === 1
                  ? `Selected ${mol.atoms[selection[0]].el}${selection[0] + 1}. Pick another atom for a bond length.`
                  : 'Click 2 atoms for a distance, 3 for a bond angle, 4 for a dihedral (torsion) angle.'}
              </p>
            )}
          </Bezel>
        </>
      )}
      {overlay && createPortal(toolbar, overlay)}
    </>
  );
}
