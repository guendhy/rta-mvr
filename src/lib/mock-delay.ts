import { KEYS, mockStorage } from "./mock-storage";
import type { SimulationState } from "@/types";

/**
 * Artificial latency for mock services so loading states can be tested.
 * Weak network multiplies the delay; offline keeps local operations fast.
 */
export function mockDelay(min = 200, max = 800): Promise<void> {
  const sim = mockStorage.get<SimulationState>(KEYS.simulation);
  const factor = sim?.network === "weak" ? 2.5 : 1;
  const ms = Math.round((min + Math.random() * (max - min)) * factor);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
