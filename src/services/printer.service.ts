import { printElement } from "@/lib/print";
import type { ReceiptData } from "@/types";
import { posService } from "./pos.service";

export interface RegistrationCertificateData {
  elementId: string;
  registrationNumber: string;
}

export interface PrinterAdapter {
  readonly name: string;
  detect(): Promise<boolean>;
  printReceipt(data: ReceiptData & { elementId: string; format: "58mm" | "A4" }): Promise<void>;
  printRegistration(data: RegistrationCertificateData & { format: "A4" | "label" }): Promise<void>;
}

/** Uses the browser print dialog with CSS print layouts. */
export class BrowserPrinterAdapter implements PrinterAdapter {
  readonly name = "Browser printer";
  async detect() {
    return typeof window !== "undefined" && typeof window.print === "function";
  }
  async printReceipt(data: ReceiptData & { elementId: string; format: "58mm" | "A4" }) {
    await printElement(data.elementId, data.format);
  }
  async printRegistration(data: RegistrationCertificateData & { format: "A4" | "label" }) {
    await printElement(data.elementId, data.format);
  }
}

/** Simulates the Wiseasy P5 built-in thermal printer (honours the Demo Tools printer state). */
// FUTURE: Implement real POS printer through the Android bridge SDK.
export class MockPosPrinterAdapter implements PrinterAdapter {
  readonly name = "POS terminal printer (simulated)";
  async detect() {
    const s = await posService.getSimulator();
    return s.printer === "ready" && s.terminalStatus !== "printer_error";
  }
  async printReceipt(data: ReceiptData & { elementId: string; format: "58mm" | "A4" }) {
    await posService.printReceipt?.(data);
  }
  async printRegistration() {
    throw new Error("The POS printer can only print receipts.");
  }
}

export const browserPrinter = new BrowserPrinterAdapter();
export const posPrinter = new MockPosPrinterAdapter();
