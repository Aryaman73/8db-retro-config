import { BOARD_H, BOARD_W, EXTERNAL, LAYOUT, defaultUsage, hwLabel, usageLabel } from './keys.ts';

interface Props {
  maps: Map<number, number>;
  selected: number | null;
  onSelect: (hw: number) => void;
}

/** A key counts as remapped when it sends something other than its default. */
export function isRemapped(maps: Map<number, number>, hw: number): boolean {
  const u = maps.get(hw);
  return u !== undefined && u !== defaultUsage(hw);
}

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

export function Board({ maps, selected, onSelect }: Props) {
  return (
    <div className="board-scroll">
      <div className="board" role="group" aria-label="Keyboard">
        {LAYOUT.map((k) => {
          const remapped = isRemapped(maps, k.hw);
          return (
            <button
              key={k.hw}
              type="button"
              className={`key cap-${k.cap}${remapped ? ' remapped' : ''}${selected === k.hw ? ' selected' : ''}`}
              style={{ left: pct(k.x, BOARD_W), top: pct(k.y, BOARD_H), width: pct(k.w, BOARD_W), height: pct(1, BOARD_H) }}
              aria-pressed={selected === k.hw}
              title={remapped ? `${hwLabel(k.hw)} → ${usageLabel(maps.get(k.hw)!)}` : hwLabel(k.hw)}
              onClick={() => onSelect(k.hw)}
            >
              <span className="key-face">
                <span className="key-legend">{k.label}</span>
                {remapped && <span className="key-target">{usageLabel(maps.get(k.hw)!)}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ExternalButtons({ maps, selected, onSelect }: Props) {
  return (
    <div className="externals">
      <div className="externals-text">
        <strong>Super Buttons</strong>
        <span>3.5mm jack accessory</span>
      </div>
      {EXTERNAL.map((b) => {
        const mapped = isRemapped(maps, b.hw);
        return (
          <button
            key={b.hw}
            type="button"
            className={`ext${mapped ? ' remapped' : ''}${selected === b.hw ? ' selected' : ''}`}
            aria-pressed={selected === b.hw}
            onClick={() => onSelect(b.hw)}
          >
            <span className="ext-dot" aria-hidden />
            <span className="ext-text">
              <span>{b.label}</span>
              <span className="ext-target">{mapped ? usageLabel(maps.get(b.hw)!) : 'sends nothing'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
