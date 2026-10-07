import { ArrowsClockwise, Info, Sparkle, TextAa, WarningCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ELEMENT_BY_SYMBOL } from '../../chem/elements';
import { buildReaction, type Reaction } from '../../chem/reaction';
import { REACTION_PRESETS } from '../../data/reactions';
import { mechanismFrame, reactionCoordinate } from '../../render/player';
import type { Stage } from '../../render/stage';
import { CommandBar, type Suggestion } from '../CommandBar';
import { Bezel, Formula, Segmented } from '../primitives';
import { EnergyChart } from './EnergyChart';
import { EquationView } from './EquationView';
import { KineticsCard } from './KineticsCard';
import { Stoichiometry } from './Stoichiometry';
import { ThermoCard } from './ThermoCard';
import { Timeline } from './Timeline';

const CYCLE_SECONDS = 7.5;
const HOLD_SECONDS = 1.4;

type Status = { kind: 'error' | 'info'; text: string } | null;

export function ReactionMode({
  stage,
  overlay,
  initialQuery,
  onQueryChange,
}: {
  stage: Stage | null;
  overlay: HTMLElement | null;
  initialQuery: string;
  onQueryChange: (q: string) => void;
}) {
  const [input, setInput] = useState(initialQuery);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [temperature, setTemperature] = useState(298);
  const [catalyst, setCatalyst] = useState(false);
  const [tab, setTab] = useState<'kinetics' | 'stoich'>('kinetics');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tUI, setTUI] = useState(0);
  const [labels, setLabels] = useState(false);
  const [spin, setSpin] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const tRef = useRef(0);
  const holdRef = useRef(0);
  const clockRef = useRef(0);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const reactionRef = useRef<Reaction | null>(null);
  const catalystRef = useRef(catalyst);
  playingRef.current = playing;
  speedRef.current = speed;
  catalystRef.current = catalyst;

  const eaFor = (r: Reaction, cat: boolean) => r.ea * (cat ? 0.55 : 1);

  const run = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      const out = buildReaction(q);
      if (!out.ok) {
        setStatus({ kind: out.noReaction ? 'info' : 'error', text: out.noReaction ? `No reaction: ${out.error}` : out.error });
        return;
      }
      const r = out.reaction;
      setStatus(
        r.rebalanced
          ? { kind: 'info', text: 'Your coefficients didn’t conserve every atom, so the equation was re-balanced.' }
          : r.mechanismNote
            ? { kind: 'info', text: r.mechanismNote }
            : null,
      );
      setReaction(r);
      reactionRef.current = r;
      onQueryChange(q);
      tRef.current = 0;
      holdRef.current = 0;
      setTUI(0);
      setPlaying(true);
      if (stage && r.mechanism) {
        stage.setSelection([]);
        stage.setFrame(mechanismFrame(r.mechanism, 0, 0, eaFor(r, catalystRef.current), r.thermo.dH ?? 0), { enter: true });
        stage.fit(r.mechanism.radius);
      } else stage?.setFrame({ atoms: [], bonds: [] });
    },
    [stage, onQueryChange],
  );

  const ran = useRef(false);
  useEffect(() => {
    if (!stage || ran.current) return;
    ran.current = true;
    run(initialQuery);
  }, [stage, initialQuery, run]);

  // drive the mechanism animation from the stage's render loop
  useEffect(() => {
    if (!stage) return;
    stage.setStyle('ball-stick');
    let lastUi = 0;
    stage.onFrame = (dt) => {
      const r = reactionRef.current;
      if (!r?.mechanism) return;
      clockRef.current += dt;
      if (playingRef.current) {
        if (tRef.current >= 1) {
          holdRef.current += dt;
          if (holdRef.current > HOLD_SECONDS) {
            tRef.current = 0;
            holdRef.current = 0;
          }
        } else tRef.current = Math.min(1, tRef.current + (dt * speedRef.current) / CYCLE_SECONDS);
      }
      stage.setFrame(mechanismFrame(r.mechanism, tRef.current, clockRef.current, eaFor(r, catalystRef.current), r.thermo.dH ?? 0));
      const now = performance.now();
      if (now - lastUi > 60) {
        lastUi = now;
        setTUI(tRef.current);
      }
    };
    stage.onHover = (h) => setHover(h ? { index: h.index, x: h.screen.x, y: h.screen.y } : null);
    stage.onPick = null;
    return () => {
      stage.onFrame = null;
      stage.onHover = null;
    };
  }, [stage]);

  useEffect(() => {
    stage?.setLabels(labels);
  }, [stage, labels]);
  useEffect(() => {
    stage?.setAutoRotate(spin);
  }, [stage, spin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const suggest = useCallback((q: string): Suggestion[] => {
    const n = q.toLowerCase().replace(/\s+/g, '');
    return REACTION_PRESETS.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()) || p.equation.toLowerCase().replace(/\s+/g, '').includes(n))
      .slice(0, 6)
      .map((p) => ({ key: p.id, value: p.equation, label: p.title, hint: <span className="mono">{p.equation}</span> }));
  }, []);

  const presets = showAll ? REACTION_PRESETS : REACTION_PRESETS.slice(0, 6);
  const ea = reaction ? eaFor(reaction, catalyst) : 0;
  const dH = reaction?.thermo.dH ?? 0;
  const hoverEl = hover && reaction?.mechanism ? reaction.mechanism.elements[hover.index] : null;

  const overlayContent = reaction?.mechanism ? (
    <>
      <div className="hud">
        <div>
          <div className="hud-title">{(reaction.type ?? 'REACTION').toUpperCase()}</div>
          <div className="hud-big">{reaction.preset?.title ?? reaction.reactants.map((r) => r.name ?? r.text).join(' + ')}</div>
        </div>
        <div style={{ textAlign: 'right', pointerEvents: 'auto', display: 'flex', gap: 4 }}>
          <button className="icon-btn" aria-pressed={labels} onClick={() => setLabels((v) => !v)} title="Atom labels" aria-label="Toggle atom labels">
            <TextAa size={18} weight="light" />
          </button>
          <button className="icon-btn" aria-pressed={spin} onClick={() => setSpin((v) => !v)} title="Auto-rotate" aria-label="Toggle auto-rotate">
            <ArrowsClockwise size={18} weight="light" />
          </button>
        </div>
      </div>
      {hoverEl && (
        <div className="tooltip" style={{ left: hover!.x, top: hover!.y }}>
          <strong>
            {ELEMENT_BY_SYMBOL[hoverEl]?.name} · {hoverEl}
            {hover!.index + 1}
          </strong>
          <div className="muted">Atoms are conserved — follow it into the products.</div>
        </div>
      )}
      <Timeline
        t={tUI}
        playing={playing}
        speed={speed}
        onToggle={() => setPlaying((p) => !p)}
        onSeek={(t) => {
          tRef.current = t;
          holdRef.current = 0;
          setTUI(t);
          setPlaying(false);
        }}
        onSpeed={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}
      />
    </>
  ) : (
    <div className="empty-stage">
      <div>
        <Sparkle size={28} weight="light" />
        <p>{reaction ? 'This reaction is too large to animate.' : 'Enter reactants to simulate a reaction.'}</p>
      </div>
    </div>
  );

  return (
    <>
      <Bezel className="reveal">
        <span className="eyebrow violet">Reaction simulator</span>
        <h1 className="hero-title">
          Mix reactants.
          <br />
          <em>Watch bonds break.</em>
        </h1>
        <p className="lede">Type reactants and I’ll predict and balance the products — or enter a full equation. Use ⇌ or &lt;=&gt; for equilibria.</p>
        <div style={{ marginTop: 18 }}>
          <CommandBar
            value={input}
            onChange={setInput}
            onSubmit={run}
            placeholder="CH4 + O2, Zn + HCl, N2 + H2 <=> NH3…"
            cta="React"
            suggest={suggest}
            inputLabel="Chemical equation or reactants"
          />
        </div>
        {status && (
          <div className={`status ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.kind === 'error' ? <WarningCircle size={16} weight="light" /> : <Info size={16} weight="light" />}
            <span>{status.text}</span>
          </div>
        )}
        <div className="presets" style={{ marginTop: 16 }}>
          {presets.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={reaction?.preset?.id === p.id}
              onClick={() => {
                setInput(p.equation);
                run(p.equation);
              }}
            >
              <span className="t">{p.title}</span>
              <span className="e">{p.equation}</span>
            </button>
          ))}
        </div>
        <button className="ghost-btn" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${REACTION_PRESETS.length} reactions`}
        </button>
      </Bezel>

      {reaction && (
        <>
          <Bezel className="reveal d1" key={`eq-${reaction.input}`}>
            <h3 className="card-title">
              Balanced equation
              <span className="right">
                <span className="eyebrow">{reaction.type}</span>
              </span>
            </h3>
            <EquationView reaction={reaction} />
            {reaction.explanation && <p className="blurb">{reaction.explanation}</p>}
            {reaction.predicted && <p className="note">Products predicted by the rule engine (reaction class: {reaction.type}). Real outcomes can depend on conditions.</p>}
          </Bezel>

          <ThermoCard reaction={reaction} temperature={temperature} onTemperature={setTemperature} />

          <Bezel className="reveal d3">
            <h3 className="card-title">
              Energy profile
              <span className="right muted" title={reaction.eaSource}>
                Eₐ {reaction.eaSource.startsWith('Literature') ? 'literature' : 'estimated'}
              </span>
            </h3>
            <EnergyChart ea={reaction.ea} dH={dH} s={reactionCoordinate(tUI)} catalystEa={catalyst ? ea : undefined} />
            <p className="muted" style={{ margin: '10px 0 0' }}>
              {reaction.eaSource}. {reaction.thermo.method === 'none' ? 'ΔH unknown — drawn as thermoneutral. ' : ''}The dot tracks the 3D animation.
            </p>
          </Bezel>

          <Bezel className="reveal d4">
            <div className="tabs">
              <Segmented
                label="Analysis"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'kinetics', label: 'Kinetics simulation' },
                  { value: 'stoich', label: 'Stoichiometry' },
                ]}
              />
            </div>
            {tab === 'kinetics' ? (
              <KineticsCard reaction={reaction} temperature={temperature} catalyst={catalyst} onCatalyst={setCatalyst} />
            ) : (
              <Stoichiometry reaction={reaction} />
            )}
          </Bezel>

          <Bezel className="reveal d4" tight>
            <div className="chips">
              {[...reaction.reactants, ...reaction.products].map((s, i) => (
                <span key={i} className="chip" style={{ cursor: 'default' }}>
                  <span className="dot" style={{ background: s.color }} />
                  <Formula text={s.text} className="mono" />
                  <span className="muted">{s.molarMass.toFixed(2)} g/mol</span>
                </span>
              ))}
            </div>
          </Bezel>
        </>
      )}
      {overlay && createPortal(overlayContent, overlay)}
    </>
  );
}
