"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { STORAGE_EVENT } from "@/lib/mock-storage";

interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

/**
 * Loads data from a service and re-runs silently whenever the mock database changes,
 * so every open screen stays consistent (e.g. header counts after a payment).
 */
export function useServiceQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: { live?: boolean } = {}) {
  const [state, setState] = useState<QueryState<T>>({ data: undefined, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error: friendlyError(e, "The data could not be loaded.") }));
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (opts.live === false) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(true), 120);
    };
    window.addEventListener(STORAGE_EVENT, onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(STORAGE_EVENT, onChange);
    };
  }, [run, opts.live]);

  return { ...state, reload: run };
}

/** Wraps a mutating service call with busy state and officer-friendly error toasts. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { success?: string | ((r: R) => string); errorTitle?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      const r = await fnRef.current(...args);
      const s = optsRef.current.success;
      if (s) toast.success(typeof s === "function" ? s(r) : s);
      return r;
    } catch (e) {
      const msg = friendlyError(e);
      setError(msg);
      toast.error(optsRef.current.errorTitle ?? msg, optsRef.current.errorTitle ? { description: msg } : undefined);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, clearError: () => setError(null) };
}
