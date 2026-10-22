import { useMemo, useState } from 'react';
import { USAGE, USAGE_BY_CODE } from '../../src/protocol/keys.ts';
import { chordUsage, parseChord } from '../../src/protocol/usage.ts';
import {
  CHORD_MODS, TARGET_GROUPS, chordable, defaultUsage, hwLabel, targetName, targetWarning, usageLabel,
} from './keys.ts';

interface Props {
  hw: number;
  current: number; // usage the key sends now
  busy: boolean;
  onSave: (usage: number) => void;
  onReset: () => void;
  onClose: () => void;
}

/** Split a usage into the picker's (modifier, key) state. */
function initial(code: number): { mod: string | null; key: string | null } {
  const chord = parseChord(code);
  if (chord) return chord;
  return { mod: null, key: USAGE_BY_CODE[code] ?? null };
}

export function KeyEditor({ hw, current, busy, onSave, onReset, onClose }: Props) {
  const start = useMemo(() => initial(current), [current]);
  const [mod, setMod] = useState<string | null>(start.mod);
  const [key, setKey] = useState<string | null>(start.key);
  const [query, setQuery] = useState('');

  const isDefault = current === defaultUsage(hw);
  let next: number | null = null;
  let invalid: string | null = null;
  if (key) {
    try {
      next = mod ? chordUsage(mod, key) : USAGE[key].code;
    } catch (e) {
      invalid = e instanceof Error ? e.message : String(e);
    }
  }
  const warning = key ? targetWarning(key) : null;
  const unchanged = next === current;

  const q = query.trim().toLowerCase();
  const groups = TARGET_GROUPS.map((g) => ({
    ...g,
    names: g.names.filter((n) => !q || n.includes(q) || targetName(n).toLowerCase().includes(q)),
  })).filter((g) => g.names.length);

  return (
    <section className="card editor" aria-label={`Remap ${hwLabel(hw)}`}>
      <header className="editor-head">
        <div>
          <h2>{hwLabel(hw)}</h2>
          <p className="muted">
            Sends <strong>{usageLabel(current)}</strong>
            {isDefault ? ' (default)' : ''} · code <code>0x{hw.toString(16)}</code>
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close editor">✕</button>
      </header>

      <div className="field">
        <span className="field-label">Modifier</span>
        <div className="seg" role="radiogroup" aria-label="Modifier">
          {[{ mod: null, label: 'None' }, ...CHORD_MODS].map((m) => (
            <button
              key={m.label}
              type="button"
              role="radio"
              aria-checked={mod === m.mod}
              className={mod === m.mod ? 'on' : ''}
              onClick={() => setMod(m.mod)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="hint">One modifier max — the keyboard stores a single <code>07 mod key</code> cell per key.</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="target-search">Sends</label>
        <input
          id="target-search"
          className="input"
          type="search"
          placeholder="Search keys (f13, mute, esc…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="targets">
          {groups.map((g) => (
            <div key={g.title} className="target-group">
              <span className="target-group-title">{g.title}</span>
              <div className="chips">
                {g.names.map((n) => {
                  const disabled = !!mod && !chordable(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`chip${key === n ? ' on' : ''}${targetWarning(n) ? ' warn' : ''}`}
                      disabled={disabled}
                      title={disabled ? 'Can’t combine with a modifier' : (targetWarning(n) ?? USAGE[n].desc)}
                      onClick={() => setKey(n)}
                    >
                      {targetName(n)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!groups.length && <p className="muted">No keys match “{query}”.</p>}
        </div>
      </div>

      {warning && <p className="callout warn">{warning}</p>}
      {invalid && <p className="callout error">{invalid}</p>}

      <footer className="editor-foot">
        <span className="preview">
          {hwLabel(hw)} → <strong>{next !== null ? usageLabel(next) : '…'}</strong>
        </span>
        <div className="row">
          {!isDefault && (
            <button type="button" className="btn" disabled={busy} onClick={onReset}>
              Reset to default
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={busy || next === null || unchanged}
            onClick={() => next !== null && onSave(next)}
          >
            {busy ? 'Saving…' : 'Save to keyboard'}
          </button>
        </div>
      </footer>
    </section>
  );
}
