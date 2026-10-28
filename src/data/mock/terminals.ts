import type { PosTerminal } from "@/types";
import { OFFICE_IDS } from "./offices";
import { USER_IDS } from "./users";

const ts = "2025-03-01T08:00:00.000Z";
const id = (n: number) => `e8d7c6b5-a4f3-4e2d-9c1b-${String(n).padStart(12, "0")}`;

export const SEED_TERMINALS: PosTerminal[] = [
  { id: id(1), name: "RTA Smart POS", terminalId: "RTA-POM-001", merchantId: "RTA-PNG-0001", manufacturer: "Wiseasy", model: "P5", serialNumber: "WSP5-00094821", officeId: OFFICE_IDS.POM, assignedCashierId: USER_IDS.cashier, status: "online", connection: "android_bridge", createdAt: ts, updatedAt: ts },
  { id: id(2), name: "RTA Smart POS · Counter 2", terminalId: "RTA-POM-002", merchantId: "RTA-PNG-0001", manufacturer: "Wiseasy", model: "P5", serialNumber: "WSP5-00094822", officeId: OFFICE_IDS.POM, status: "idle", connection: "android_bridge", createdAt: ts, updatedAt: ts },
  { id: id(3), name: "Lae Counter POS", terminalId: "RTA-LAE-002", merchantId: "RTA-PNG-0002", manufacturer: "Wiseasy", model: "P5", serialNumber: "WSP5-00095310", officeId: OFFICE_IDS.LAE, status: "offline", connection: "android_bridge", createdAt: ts, updatedAt: ts },
  { id: id(4), name: "Hagen Counter POS", terminalId: "RTA-HGN-001", merchantId: "RTA-PNG-0004", manufacturer: "Wiseasy", model: "P5", serialNumber: "WSP5-00095877", officeId: OFFICE_IDS.HGN, status: "online", connection: "local_bridge", createdAt: ts, updatedAt: ts },
  { id: id(5), name: "Kokopo Counter POS", terminalId: "RTA-KKP-001", merchantId: "RTA-PNG-0005", manufacturer: "Wiseasy", model: "P5", serialNumber: "WSP5-00096014", officeId: OFFICE_IDS.KKP, assignedCashierId: USER_IDS.kokopoCashier, status: "maintenance", connection: "bluetooth", createdAt: ts, updatedAt: ts },
];
