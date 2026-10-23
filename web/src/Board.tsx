import { useState } from 'react';
import { BOARD_H, BOARD_W, LAYOUT, SUPER_SLOTS, defaultUsage, hwLabel, usageLabel, type SuperSlot } from './keys.ts';

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

function SlotButton({ slot, maps, selected, onSelect }: Props & { slot: SuperSlot }) {
  const mapped = isRemapped(maps, slot.hw);
  return (
    <button
      type="button"
      className={`ext${mapped ? ' remapped' : ''}${selected === slot.hw ? ' selected' : ''}`}
      aria-pressed={selected === slot.hw}
      onClick={() => onSelect(slot.hw)}
    >
      <span className="ext-dot" aria-hidden />
      <span className="ext-text">
        <span>{slot.label}</span>
        <span className="ext-target">{mapped ? usageLabel(maps.get(slot.hw)!) : 'sends nothing'}</span>
      </span>
    </button>
  );
}

export function ExternalButtons(props: Props) {
  const extraMapped = SUPER_SLOTS.some((s) => s.pad > 1 && isRemapped(props.maps, s.hw));
  const [showAll, setShowAll] = useState(false);
  const expanded = showAll || extraMapped;
  const pads = expanded ? [1, 2, 3, 4] : [1];

  return (
    <div className="externals">
      {pads.map((pad) => (
        <div key={pad} className="pad">
          <div className="externals-text">
            <strong>{pad === 1 ? 'Super Buttons' : `Pad ${pad}`}</strong>
            <span>{pad === 1 ? '3.5mm jack accessory' : 'untested'}</span>
          </div>
          {SUPER_SLOTS.filter((s) => s.pad === pad).map((slot) => (
            <SlotButton key={slot.hw} slot={slot} {...props} />
          ))}
        </div>
      ))}
      {!extraMapped && (
        <button type="button" className="btn subtle more-slots" onClick={() => setShowAll(!expanded)}>
          {expanded ? 'Fewer slots' : 'More Super Button slots'}
        </button>
      )}
      {expanded && (
        <p className="hint">
          Pads 2–4 use codes from 8BitDo’s own app but haven’t been tested on hardware. Only the first pair is
          confirmed.
        </p>
      )}
    </div>
  );
}
