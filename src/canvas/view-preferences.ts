import { useSyncExternalStore } from 'react';

export type GridStyle = 'off' | 'dots' | 'lines';
export type ViewPreferences = Readonly<{
  grid: GridStyle;
  spacing: 20 | 40 | 80;
  dimensions: boolean;
  distances: boolean;
}>;
export const VIEW_PREFERENCES_KEY = 'dali:view-preferences:v1';
export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = { grid: 'dots', spacing: 20, dimensions: false, distances: false };

export function parseViewPreferences(raw: string | null): ViewPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return DEFAULT_VIEW_PREFERENCES;
    const prefs = value as Partial<ViewPreferences>;
    return {
      grid: prefs.grid === 'off' || prefs.grid === 'lines' ? prefs.grid : 'dots',
      spacing: prefs.spacing === 40 || prefs.spacing === 80 ? prefs.spacing : 20,
      dimensions: prefs.dimensions === true,
      distances: prefs.distances === true,
    };
  } catch { return DEFAULT_VIEW_PREFERENCES; }
}
function read(): ViewPreferences {
  try { return parseViewPreferences(localStorage.getItem(VIEW_PREFERENCES_KEY)); }
  catch { return DEFAULT_VIEW_PREFERENCES; }
}
let snapshot = read();
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function storageChanged(event: StorageEvent) {
  if (event.key !== VIEW_PREFERENCES_KEY && event.key !== null) return;
  snapshot = read();
  notify();
}
function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', storageChanged);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', storageChanged);
  };
}
export function setViewPreferences(patch: Partial<ViewPreferences>) {
  snapshot = parseViewPreferences(JSON.stringify({ ...snapshot, ...patch }));
  try { localStorage.setItem(VIEW_PREFERENCES_KEY, JSON.stringify(snapshot)); }
  catch { /* Keep the preference for this session when storage is unavailable. */ }
  notify();
}
export function useViewPreferences() {
  return useSyncExternalStore(subscribe, () => snapshot, () => DEFAULT_VIEW_PREFERENCES);
}
