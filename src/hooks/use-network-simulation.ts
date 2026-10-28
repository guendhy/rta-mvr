"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SIMULATION } from "@/data/mock/settings";
import { KEYS, mockStorage, STORAGE_EVENT } from "@/lib/mock-storage";
import { demoService } from "@/services/demo.service";
import type { NetworkState, SimulationState } from "@/types";

/** Live view of the simulated network / armed-error state from Demo Tools. */
export function useSimulation(): SimulationState {
  const [sim, setSim] = useState<SimulationState>(DEFAULT_SIMULATION);
  useEffect(() => {
    const read = () => setSim(mockStorage.get<SimulationState>(KEYS.simulation) ?? DEFAULT_SIMULATION);
    read();
    window.addEventListener(STORAGE_EVENT, read);
    return () => window.removeEventListener(STORAGE_EVENT, read);
  }, []);
  return sim;
}

export function useNetworkSimulation() {
  const sim = useSimulation();
  return {
    network: sim.network,
    isOnline: sim.network !== "offline",
    isWeak: sim.network === "weak",
    setNetwork: (n: NetworkState) => demoService.setNetwork(n),
  };
}
