"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "rta-ui:";

/** Per-browser UI preferences (sidebar collapsed, table page size). Not business data. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* storage unavailable — keep default */
    }
  }, [key]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
      return v;
    });
  }, [key]);

  return [value, update] as const;
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
