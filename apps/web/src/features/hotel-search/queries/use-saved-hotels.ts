import { useState, useSyncExternalStore } from 'react';

const key = 'tbo-saved-hotels-v1';
export function parseSavedHotels(value: string | null): string[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    parsed.length > 100 ||
    parsed.some(
      (id: unknown) => typeof id !== 'string' || id.trim().length === 0 || id.length > 100,
    )
  ) {
    throw new Error('Invalid saved hotel list.');
  }
  return [...new Set(parsed as string[])];
}

function createStore() {
  const server = { ids: [] as string[], error: '' };
  let snapshot = server;
  const listeners = new Set<() => void>();
  let initialized = false;
  function publish(ids: string[], error = '') {
    snapshot = { ids, error };
    listeners.forEach((listener) => listener());
  }
  function read() {
    try {
      publish(parseSavedHotels(window.localStorage.getItem(key)));
    } catch {
      publish(snapshot.ids, 'Saved hotels are available for this visit only.');
    }
  }
  function storage(event: StorageEvent) {
    if (event.key === key || event.key === null) read();
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener('storage', storage);
      if (!initialized) {
        initialized = true;
        read();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) window.removeEventListener('storage', storage);
      };
    },
    toggle(id: string) {
      const ids = snapshot.ids.includes(id)
        ? snapshot.ids.filter((existing) => existing !== id)
        : [...snapshot.ids.slice(-99), id];
      try {
        window.localStorage.setItem(key, JSON.stringify(ids));
        publish(ids);
      } catch {
        publish(ids, 'Saved hotels are available for this visit only.');
      }
    },
  };
}

export function useSavedHotels() {
  const [store] = useState(createStore);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { ...snapshot, toggle: store.toggle };
}
