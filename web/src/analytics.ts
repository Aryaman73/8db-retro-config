/**
 * GoatCounter page views, shared with the aryamans.me dashboard. Only the live
 * host loads the script, so dev and preview servers never count.
 *
 * The app is a single page, so GoatCounter's automatic onload count records the
 * view (as /8db-retro-config/). Connecting a keyboard and starting the demo are
 * counted as events so the dashboard shows how people actually use it. Nothing
 * about the keyboard or its mappings is ever sent.
 */

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string; title?: string; event?: boolean }) => void };
  }
}

const LIVE_HOST = 'aryamans.me';

export function startAnalytics(): void {
  if (location.hostname !== LIVE_HOST) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = 'https://aryamans.goatcounter.com/count';
  document.head.append(script);
}

/** Count a named event, e.g. "8db-retro-config/demo". No-op off the live host. */
export function countEvent(path: string, title: string): void {
  window.goatcounter?.count?.({ path, title, event: true });
}
