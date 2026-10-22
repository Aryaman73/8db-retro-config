import { useEffect, useState } from 'react';

interface Props {
  profile: string | null;
  busy: boolean;
  onSave: (name: string) => void;
  onDelete: () => void;
}

export function ProfilePanel({ profile, busy, onSave, onDelete }: Props) {
  const [name, setName] = useState(profile ?? 'main');
  const [confirming, setConfirming] = useState(false);
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
