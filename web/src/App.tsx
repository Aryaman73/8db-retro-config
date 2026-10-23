import { useCallback, useEffect, useRef, useState } from 'react';
import type { Keyboard } from '../../src/client.ts';
import { applyProfile, toFile, type Profile } from '../../src/profile.ts';
import { Board, ExternalButtons, isRemapped } from './Board.tsx';
import { KeyEditor } from './KeyEditor.tsx';
import { ProfilePanel } from './ProfilePanel.tsx';
import { defaultUsage, hwLabel, usageLabel } from './keys.ts';
import { countEvent } from './analytics.ts';
import { openDemoKeyboard } from './demo.ts';
import { REQUEST_FILTERS, isConfigInterface, openKeyboard } from './webhid.ts';

type Phase = 'unsupported' | 'idle' | 'connecting' | 'ready';

const REPO = 'https://github.com/Aryaman73/8db-retro-config';
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function App() {
  const supported = 'hid' in navigator;
  const [phase, setPhase] = useState<Phase>(supported ? 'idle' : 'unsupported');
  const [product, setProduct] = useState('');
  const [profile, setProfile] = useState<string | null>(null);
  const [maps, setMaps] = useState<Map<number, number>>(new Map()); // hw code -> usage
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const kbRef = useRef<Keyboard | null>(null);
  const deviceRef = useRef<HIDDevice | null>(null);

  const refresh = useCallback(async (kb: Keyboard) => {
    const name = await kb.getProfileName();
    const next = new Map<number, number>();
    for (const hw of await kb.getMappedCodes()) next.set(hw, await kb.getKeyUsage(hw));
    setProfile(name);
    setMaps(next);
  }, []);

  const dropConnection = useCallback(() => {
    kbRef.current = null;
    deviceRef.current = null;
    setDemo(false);
    setSelected(null);
    setPhase('idle');
  }, []);

  const connect = useCallback(
    async (dev: HIDDevice) => {
      if (deviceRef.current || kbRef.current) return; // already connected or connecting
      deviceRef.current = dev;
      setPhase('connecting');
      setError(null);
      try {
        const kb = await openKeyboard(dev);
        kbRef.current = kb;
        setProduct(dev.productName);
        await refresh(kb);
        setPhase('ready');
        countEvent('8db-retro-config/connect', 'Connected a keyboard');
      } catch (e) {
        await dev.close().catch(() => {});
        dropConnection();
        setError(`Couldn’t talk to the keyboard: ${message(e)}`);
      }
    },
    [refresh, dropConnection],
  );

  // Reconnect to a keyboard this site was already granted, and follow plug/unplug.
  useEffect(() => {
    if (!supported) return;
    const onConnect = (e: HIDConnectionEvent) => {
      if (isConfigInterface(e.device)) void connect(e.device);
    };
    const onDisconnect = (e: HIDConnectionEvent) => {
      if (e.device === deviceRef.current) {
        dropConnection();
        setNotice('Keyboard disconnected.');
      }
    };
    navigator.hid.addEventListener('connect', onConnect);
    navigator.hid.addEventListener('disconnect', onDisconnect);
    void navigator.hid.getDevices().then((devices) => {
      const dev = devices.find(isConfigInterface);
      if (dev) void connect(dev);
    });
    return () => {
      navigator.hid.removeEventListener('connect', onConnect);
      navigator.hid.removeEventListener('disconnect', onDisconnect);
    };
  }, [supported, connect, dropConnection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function request() {
    setError(null);
    try {
      const [dev] = await navigator.hid.requestDevice({ filters: REQUEST_FILTERS });
      if (dev) await connect(dev);
    } catch (e) {
      setError(message(e));
    }
  }

  async function startDemo() {
    setError(null);
    const kb = openDemoKeyboard();
    kbRef.current = kb;
    setDemo(true);
    setProduct('Simulated keyboard');
    await refresh(kb);
    setPhase('ready');
    countEvent('8db-retro-config/demo', 'Started the demo');
  }

  async function disconnect() {
    const kb = kbRef.current;
    dropConnection();
    await kb?.close().catch(() => {});
  }

  /** Run a write, then re-read everything so the UI shows what the keyboard holds. */
  async function act(done: string, fn: (kb: Keyboard) => Promise<void>) {
    const kb = kbRef.current;
    if (!kb) return;
    setBusy(true);
    setError(null);
    try {
      await fn(kb);
      await refresh(kb);
      setNotice(done);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const remaps = [...maps.keys()].filter((hw) => isRemapped(maps, hw));

  function exportProfile() {
    const file = toFile({ name: profile, maps: new Map(remaps.map((hw) => [hw, maps.get(hw)!])) });
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(profile ?? 'profile').replace(/[^\w.-]+/g, '_')}.8bitdo.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importProfile(p: Profile) {
    setSelected(null);
    void act(
      p.name ? `Loaded “${p.name}”. Turn the ♥ LED on to use it.` : 'Loaded. Name the profile to make it live.',
      async (kb) => void (await applyProfile(kb, p)),
    );
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <span />
            <span />
          </span>
          <div>
            <h1>Retro Keyboard Config</h1>
            <p className="muted">Remap your 8BitDo Retro Mechanical Keyboard from the browser.</p>
          </div>
        </div>
        {phase === 'ready' && (
          <div className="conn">
            <span className={`conn-dot${demo ? ' demo' : ''}`} aria-hidden />
            <span>{product}</span>
            <button type="button" className="btn subtle" onClick={disconnect}>
              {demo ? 'Exit demo' : 'Disconnect'}
            </button>
          </div>
        )}
      </header>

      {phase === 'ready' && demo && (
        <p className="callout warn">
          Demo mode: this is a simulated keyboard, so nothing is written to real hardware. Changes reset when you leave.
        </p>
      )}

      {error && (
        <p className="callout error" role="alert">
          {error}
        </p>
      )}

      {phase !== 'ready' ? (
        <section className="card connect">
          {phase === 'unsupported' ? (
            <>
              <h2>This browser can’t reach USB keyboards</h2>
              <p className="muted">
                The configurator uses WebHID, which Chrome, Edge, Arc and other Chromium browsers support. Safari and
                Firefox don’t. Open this page in one of those, or use the CLI from the{' '}
                <a href={REPO}>repo</a>.
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={startDemo}>
                  Try the demo
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Connect your keyboard</h2>
              <ol className="steps">
                <li>Plug it in with the USB-C cable.</li>
                <li>
                  Slide the power switch to <strong>OFF</strong>. In wired mode it shows up as a configurable device.
                </li>
                <li>
                  Click Connect and pick <strong>8BitDo Retro Keyboard</strong>.
                </li>
              </ol>
              <div className="row">
                <button type="button" className="btn primary big" disabled={phase === 'connecting'} onClick={request}>
                  {phase === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
                <button type="button" className="btn big subtle" onClick={startDemo}>
                  No keyboard? Try the demo
                </button>
              </div>
              <p className="hint">Everything happens in this tab. The page talks to the keyboard directly, and your keys and mappings never leave it.</p>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="card board-card">
            <Board maps={maps} selected={selected} onSelect={setSelected} />
            <ExternalButtons maps={maps} selected={selected} onSelect={setSelected} />
            {selected === null && <p className="hint center">Click a key to remap it.</p>}
          </section>

          <div className="columns">
            <div className="col-main">
              {selected !== null && (
                <KeyEditor
                  key={selected}
                  hw={selected}
                  current={maps.get(selected) ?? defaultUsage(selected)}
                  busy={busy}
                  onClose={() => setSelected(null)}
                  onSave={(usage) =>
                    act(
                      profile
                        ? `${hwLabel(selected)} now sends ${usageLabel(usage)}.`
                        : `Saved. Name the profile to make it live.`,
                      (kb) => kb.mapHidUsage(selected, usage),
                    )
                  }
                  onReset={() =>
                    act(`${hwLabel(selected)} reset to default.`, (kb) =>
                      kb.mapHidUsage(selected, defaultUsage(selected)),
                    )
                  }
                />
              )}
              <section className="card">
                <h2>Remapped keys</h2>
                {remaps.length ? (
                  <ul className="remaps">
                    {remaps.map((hw) => (
                      <li key={hw}>
                        <button
                          type="button"
                          className={selected === hw ? 'on' : ''}
                          onClick={() => setSelected(hw)}
                        >
                          <span>{hwLabel(hw)}</span>
                          <span className="arrow" aria-hidden>→</span>
                          <strong>{usageLabel(maps.get(hw)!)}</strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Nothing remapped. Every key sends what’s printed on it.</p>
                )}
              </section>
            </div>
            <div className="col-side">
              <ProfilePanel
                profile={profile}
                busy={busy}
                onSave={(name) =>
                  act(`Profile “${name}” saved. Turn the ♥ LED on to use it.`, (kb) => kb.createProfile(name))
                }
                onExport={exportProfile}
                onImport={importProfile}
                onDelete={() => {
                  setSelected(null);
                  void act('Profile deleted. The keyboard is back to its default layout.', (kb) =>
                    kb.deleteProfile(),
                  );
                }}
              />
              <section className="card tips">
                <h2>macOS notes</h2>
                <ul>
                  <li>F13 and F16–F20 are good spare hotkeys, alone or with one modifier.</li>
                  <li>F14/F15 act as brightness keys, and macOS ignores F21–F24.</li>
                  <li>The Super Buttons send nothing until you map them.</li>
                </ul>
              </section>
            </div>
          </div>
        </>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      <footer className="foot muted">
        Unofficial and reverse-engineered. Not affiliated with 8BitDo. Anonymous visit counts via{' '}
        <a href="https://www.goatcounter.com">GoatCounter</a>. <a href={REPO}>Source</a>
      </footer>
    </div>
  );
}
