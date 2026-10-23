import { useEffect, useRef, useState } from 'react';
import { parseProfile, type Profile } from '../../src/profile.ts';

interface Props {
  profile: string | null;
  busy: boolean;
  onSave: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (profile: Profile) => void;
}

export function ProfilePanel({ profile, busy, onSave, onDelete, onExport, onImport }: Props) {
  const [name, setName] = useState(profile ?? 'main');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Profile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => setName(profile ?? 'main'), [profile]);

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 24;

  return (
    <section className="card profile" aria-label="Profile">
      <div className="profile-head">
        <span className={`led${profile ? ' on' : ''}`} aria-hidden>♥</span>
        <div>
          <h2>{profile ? <>Profile “{profile}”</> : 'No profile yet'}</h2>
          <p className="muted">
            {profile
              ? 'Maps are stored on the keyboard. They apply while the Profile (♥) button’s LED is on.'
              : 'Maps stay inactive until the profile has a name. Name it, then press the Profile (♥) button so its LED is on.'}
          </p>
        </div>
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(trimmed);
        }}
      >
        <input
          className="input"
          aria-label="Profile name"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={busy || !valid || trimmed === profile}>
          {profile ? 'Rename' : 'Save & activate'}
        </button>
      </form>

      <div className="backup">
        {pending ? (
          <>
            <p className="muted">
              Load {pending.name ? <>“{pending.name}”</> : 'this profile'} ({pending.maps.size} remapped{' '}
              {pending.maps.size === 1 ? 'key' : 'keys'})? It replaces every map on the keyboard.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  onImport(pending);
                  setPending(null);
                }}
              >
                Load onto keyboard
              </button>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="row">
            <button type="button" className="btn" onClick={onExport}>
              Export
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
              Import…
            </button>
            <span className="hint">Back up or share a layout as a file.</span>
          </div>
        )}
        {importError && <p className="callout error">{importError}</p>}
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImportError(null);
            try {
              setPending(parseProfile(await file.text()));
            } catch (err) {
              setImportError(err instanceof Error ? err.message : String(err));
            }
          }}
        />
      </div>

      {profile && (
        <div className="row danger-zone">
          {confirming ? (
            <>
              <span className="muted">Delete “{profile}” and clear every map?</span>
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Delete
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn subtle" onClick={() => setConfirming(true)}>
              Delete profile…
            </button>
          )}
        </div>
      )}
    </section>
  );
}
