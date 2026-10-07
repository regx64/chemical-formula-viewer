import { ArrowCounterClockwise, Pause, Play } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_COMPRESSION, KineticsSim, type Sample } from '../../chem/kinetics';
import type { Reaction } from '../../chem/reaction';
import { Toggle } from '../primitives';
import { useWidth } from '../useWidth';
import { ConcentrationChart } from './ConcentrationChart';

const ASPECT = 0.6;

export function KineticsCard({
  reaction,
  temperature,
  catalyst,
  onCatalyst,
}: {
  reaction: Reaction;
  temperature: number;
  catalyst: boolean;
  onCatalyst: (v: boolean) => void;
}) {
  const species = useMemo(
    () =>
      [...reaction.reactants, ...reaction.products].map((s) => ({
        label: s.text.replace(/\^.*$/, ''),
        color: s.color,
        coefficient: s.coefficient,
        side: s.side,
        molarMass: s.molarMass,
        atoms: s.molecule.atoms.length,
      })),
    [reaction],
  );
  const [reversible, setReversible] = useState(reaction.reversible);
  const [running, setRunning] = useState(true);
  const [history, setHistory] = useState<Sample[]>([]);
  const [stats, setStats] = useState({ t: 0, fwd: 0, rev: 0, conv: 0, heat: 1 });
  const simRef = useRef<KineticsSim | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const visible = useRef(true);
  const dH = reaction.thermo.dH ?? 0;

  useEffect(() => setReversible(reaction.reversible), [reaction]);

  // (re)create the simulation when the reaction changes
  useEffect(() => {
    simRef.current = new KineticsSim(species, {
      temperature,
      ea: reaction.ea,
      dH,
      reversible,
      catalyst,
      aspect: ASPECT,
    });
    setHistory(simRef.current.history.slice());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species]);

  useEffect(() => {
    simRef.current?.setOptions({ temperature, catalyst, reversible, ea: reaction.ea, dH });
  }, [temperature, catalyst, reversible, reaction.ea, dH]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [boxRef]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const initialReactants = () => {
      const sim = simRef.current!;
      return sim.history[0]?.counts.reduce((s, c, i) => s + (species[i].side === 'reactant' ? c : 0), 0) ?? 1;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!sim || !canvas || !visible.current) return;
      if (running) sim.step(dt);
      draw(canvas, sim, width);
      if (now - lastUi > 150) {
        lastUi = now;
        const counts = sim.counts();
        const remaining = counts.reduce((s, c, i) => s + (species[i].side === 'reactant' ? c : 0), 0);
        setHistory(sim.history.slice());
        setStats({
          t: sim.time,
          fwd: sim.forwardEvents,
          rev: sim.reverseEvents,
          conv: 1 - remaining / initialReactants(),
          heat: sim.heatIndex(),
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, width, species]);

  const p = simRef.current?.probability('forward') ?? 0;

  return (
    <div>
      <div className="kinetics-box" ref={boxRef}>
        <canvas ref={canvasRef} style={{ height: width * ASPECT }} aria-label="Particle simulation of the reaction" role="img" />
        <div className="kinetics-overlay">
          <span>
            t {stats.t.toFixed(1)} s · {stats.fwd} reactions{reversible ? ` · ${stats.rev} reverse` : ''}
          </span>
          <span>{(stats.conv * 100).toFixed(0)}% converted</span>
        </div>
      </div>
      <div className="controls-row">
        <button className="ghost-btn" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          className="ghost-btn"
          onClick={() => {
            simRef.current?.reset();
            setHistory(simRef.current?.history.slice() ?? []);
          }}
        >
          <ArrowCounterClockwise size={14} /> Reset
        </button>
        <Toggle checked={catalyst} onChange={onCatalyst}>
          Catalyst
        </Toggle>
        <Toggle checked={reversible} onChange={setReversible}>
          Reversible
        </Toggle>
      </div>
      <p className="muted" style={{ margin: '12px 0 16px' }}>
        Reaction probability per collision{' '}
        <span className="mono" style={{ color: 'var(--text-1)' }}>
          {p < 1e-4 ? p.toExponential(1) : p.toFixed(4)}
        </span>{' '}
        at {Math.round(temperature)} K. Energies are compressed {ENERGY_COMPRESSION}× so slow reactions stay watchable — compare trends, not absolute rates.
        {p < 2e-4 && (
          <span style={{ display: 'block', marginTop: 6, color: 'var(--warm)' }}>
            Practically frozen at this temperature — raise the temperature in Thermodynamics or switch on the catalyst.
          </span>
        )}
      </p>
      <ConcentrationChart history={history} series={species.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  );
}

function draw(canvas: HTMLCanvasElement, sim: KineticsSim, cssWidth: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(cssWidth * dpr);
  const h = Math.round(cssWidth * ASPECT * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  const s = w; // box units → pixels
  for (const f of sim.flashes) {
    const age = (sim.time - f.t) / 0.6;
    g.beginPath();
    g.arc(f.x * s, f.y * s, (0.01 + age * 0.06) * s, 0, Math.PI * 2);
    g.strokeStyle = f.color;
    g.globalAlpha = 0.6 * (1 - age);
    g.lineWidth = 1.5 * dpr;
    g.stroke();
  }
  g.globalAlpha = 1;
  for (const p of sim.particles) {
    const sp = sim.species[p.s];
    const r = p.r * s;
    const x = p.x * s;
    const y = p.y * s;
    const fresh = Math.max(0, 1 - (sim.time - p.born) / 0.5);
    if (fresh > 0) {
      g.beginPath();
      g.arc(x, y, r * (1.6 + fresh), 0, Math.PI * 2);
      g.fillStyle = sp.color;
      g.globalAlpha = 0.25 * fresh;
      g.fill();
      g.globalAlpha = 1;
    }
    const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.25, sp.color);
    grad.addColorStop(1, shade(sp.color));
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
  }
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.45);
  const gg = Math.round(((n >> 8) & 255) * 0.45);
  const b = Math.round((n & 255) * 0.45);
  return `rgb(${r},${gg},${b})`;
}
