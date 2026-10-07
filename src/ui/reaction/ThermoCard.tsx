import { CheckCircle, Fire, Snowflake, XCircle } from '@phosphor-icons/react';
import { R } from '../../data/thermo';
import type { Reaction } from '../../chem/reaction';
import { Bezel, Sci, Slider, fmt, signed } from '../primitives';

export function ThermoCard({ reaction, temperature, onTemperature }: { reaction: Reaction; temperature: number; onTemperature: (t: number) => void }) {
  const th = reaction.thermo;
  const dH = th.dH;
  const dS = th.dS;
  const dG = dH !== undefined && dS !== undefined ? dH - (temperature * dS) / 1000 : undefined;
  const K = dG !== undefined ? Math.exp(Math.max(-700, Math.min(700, (-dG * 1000) / (R * temperature)))) : undefined;
  const crossover = dH !== undefined && dS !== undefined && dS !== 0 && Math.sign(dH) === Math.sign(dS) ? (dH * 1000) / dS : null;
  const exo = dH !== undefined && dH < 0;

  return (
    <Bezel className="reveal d2">
      <h3 className="card-title">
        Thermodynamics
        <span className="right muted">
          {th.method === 'formation'
            ? 'from standard ΔH°f and S°'
            : th.method === 'bond-enthalpy'
              ? 'estimated from bond enthalpies'
              : 'data unavailable'}
        </span>
      </h3>
      {th.method === 'none' ? (
        <p className="muted" style={{ margin: 0 }}>
          No tabulated data for {th.missing.slice(0, 4).join(', ')}
          {th.missing.length > 4 ? '…' : ''}. The energy profile uses an illustrative barrier.
        </p>
      ) : (
        <>
          <div className="bento">
            <div className={`tile wide ${exo ? 'hot' : 'cold'}`}>
              <div className="tile-label">
                {exo ? <Fire size={13} weight="light" /> : <Snowflake size={13} weight="light" />}
                ΔH° · {exo ? 'exothermic' : 'endothermic'}
              </div>
              <div className="tile-value">
                {signed(dH!, 1)}
                <small>kJ</small>
              </div>
            </div>
            <div className="tile wide">
              <div className="tile-label">ΔS°</div>
              <div className="tile-value">
                {dS !== undefined ? signed(dS, 1) : '—'}
                <small>J/K</small>
              </div>
            </div>
            <div className="tile wide">
              <div className="tile-label">ΔG at {Math.round(temperature)} K</div>
              <div className="tile-value">
                {dG !== undefined ? signed(dG, 1) : '—'}
                <small>kJ</small>
              </div>
            </div>
            <div className="tile wide">
              <div className="tile-label">K at {Math.round(temperature)} K</div>
              <div className="tile-value">{K !== undefined ? <Sci value={K} /> : '—'}</div>
            </div>
            {dG !== undefined && (
              <div className="tile full">
                <div className="tile-label" style={{ color: dG < 0 ? 'var(--good)' : 'var(--danger)' }}>
                  {dG < 0 ? <CheckCircle size={14} weight="light" /> : <XCircle size={14} weight="light" />}
                  {dG < 0 ? 'Thermodynamically favourable' : 'Not favourable'} at {Math.round(temperature)} K
                </div>
                <div className="tile-sub" style={{ whiteSpace: 'normal' }}>
                  {crossover !== null && crossover > 0
                    ? `ΔG changes sign near ${fmt(crossover, 0)} K — ${dH! < 0 ? 'favourable below' : 'favourable above'} that temperature.`
                    : dH! < 0 && dS! > 0
                      ? 'Exothermic and entropy-increasing: favourable at every temperature.'
                      : dH! > 0 && dS! < 0
                        ? 'Endothermic and entropy-decreasing: never favourable on its own.'
                        : ''}{' '}
                  Assumes ΔH° and ΔS° don’t vary with temperature.
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <Slider label="Temperature" value={temperature} min={200} max={2500} step={1} display={`${Math.round(temperature)} K · ${Math.round(temperature - 273.15)} °C`} onChange={onTemperature} />
          </div>
        </>
      )}
    </Bezel>
  );
}
