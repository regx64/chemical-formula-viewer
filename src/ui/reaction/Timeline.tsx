import { Pause, Play } from '@phosphor-icons/react';
import { phaseAt } from '../../render/player';

export function Timeline({
  t,
  playing,
  speed,
  onToggle,
  onSeek,
  onSpeed,
}: {
  t: number;
  playing: boolean;
  speed: number;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSpeed: () => void;
}) {
  return (
    <div className="timeline">
      <div className="core">
        <button className="play" onClick={onToggle} aria-label={playing ? 'Pause animation' : 'Play animation'}>
          {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
        </button>
        <div className="timeline-main">
          <div className="timeline-meta">
            <span className="phase">{phaseAt(t)}</span>
            <span className="mono">{Math.round(t * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            aria-label="Reaction progress"
            style={{ ['--fill' as string]: `${t * 100}%` }}
            onChange={(e) => onSeek(Number(e.target.value) / 1000)}
          />
        </div>
        <button className="speed" onClick={onSpeed} aria-label="Playback speed">
          {speed}×
        </button>
      </div>
    </div>
  );
}
