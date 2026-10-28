"use client";

import { useEffect, useState } from "react";
import { useSimulation } from "./use-network-simulation";

export interface PosEnvironment {
  isPosDevice: boolean;
  screenClass: "pos-portrait" | "pos-landscape" | "phone" | "tablet" | "desktop";
  isAndroidBridgeAvailable: boolean;
  isUsbAvailable: boolean;
  isBluetoothAvailable: boolean;
  connectionType: "android_bridge" | "webusb" | "bluetooth" | "local_bridge" | "none";
}

function classify(w: number, h: number): PosEnvironment["screenClass"] {
  if ((w === 720 && h === 1280) || (w === 360 && h === 640) || (w === 360 && h === 720)) return "pos-portrait";
  if ((w === 1280 && h === 720) || (w === 640 && h === 360)) return "pos-landscape";
  if (w < 640) return "phone";
  if (w < 1024) return "tablet";
  return "desktop";
}

/**
 * Detects (or simulates) an Android Smart POS such as the Wiseasy P5.
 * POS mode turns on for POS-sized screens, `?pos=1`, a Wiseasy user agent,
 * or the Demo Tools override.
 */
export function usePosEnvironment(): PosEnvironment {
  const sim = useSimulation();
  const [env, setEnv] = useState<PosEnvironment>({
    isPosDevice: false,
    screenClass: "desktop",
    isAndroidBridgeAvailable: false,
    isUsbAvailable: false,
    isBluetoothAvailable: false,
    connectionType: "none",
  });

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const screenClass = classify(w, h);
      const ua = navigator.userAgent;
      const query = new URLSearchParams(window.location.search).get("pos") === "1";
      const bridge = typeof (window as unknown as { AndroidPOS?: unknown }).AndroidPOS !== "undefined";
      const auto = query || bridge || /wiseasy|WPOS|P5 Build/i.test(ua) || screenClass.startsWith("pos");
      const isPosDevice = sim.posMode === "on" ? true : sim.posMode === "off" ? false : auto;
      setEnv({
        isPosDevice,
        screenClass,
        // Mocked capabilities: the simulated terminal always presents as an Android bridge.
        isAndroidBridgeAvailable: bridge || isPosDevice,
        isUsbAvailable: "usb" in navigator,
        isBluetoothAvailable: "bluetooth" in navigator,
        connectionType: bridge || isPosDevice ? "android_bridge" : "none",
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [sim.posMode]);

  return env;
}
