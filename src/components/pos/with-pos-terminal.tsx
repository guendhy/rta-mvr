"use client";

import { usePosTerminal, type PosTerminalController, type PosTerminalState } from "@/hooks/use-pos-terminal";
import type { BadgeTone } from "@/config/statuses";

/** Gives a component its own terminal controller when the parent did not pass one. */
export function WithPosTerminal({ autoDetect, children }: { autoDetect?: boolean; children: (terminal: PosTerminalController) => React.ReactNode }) {
  const terminal = usePosTerminal({ autoDetect });
  return <>{children(terminal)}</>;
}

export const POS_STATE_TONE: Record<PosTerminalState, BadgeTone> = {
  detecting: "insp",
  connected: "pend",
  ready: "ok",
  processing: "insp",
  disconnected: "bad",
  unsupported: "draft",
  failed: "bad",
};
