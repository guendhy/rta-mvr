"use client";

import { useEffect, useRef } from "react";
import type { RegistrationDetail } from "@/services/interfaces";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface StepApi {
  /** Validate + persist; return true to move to the next step. */
  continue: () => Promise<boolean>;
  saveDraft?: () => Promise<void>;
  continueLabel?: string;
}

export interface StepProps {
  detail: RegistrationDetail;
  editable: boolean;
  registerApi: (api: StepApi | null) => void;
  onSaveState: (s: SaveState) => void;
  /** Move to the next step after an async modal decision. */
  advance: () => void;
}

/** Debounced autosave (~1.5 s after the officer stops typing). Never saves on every keystroke. */
export function useAutosave<T>(value: T, enabled: boolean, save: (v: T) => Promise<void>, delay = 1500) {
  const first = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!enabled) return;
    const t = setTimeout(() => saveRef.current(JSON.parse(serialized) as T), delay);
    return () => clearTimeout(t);
  }, [serialized, enabled, delay]);
}
