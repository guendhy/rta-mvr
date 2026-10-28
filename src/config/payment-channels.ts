import type { AppSettings, PaymentMethod } from "@/types";

/**
 * Payment channels. Each channel is independent of the terminal provider: POS goes through
 * the `PosTerminalAdapter` boundary, the rest record a reference. Availability is switched in
 * Administration → Settings → Payments.
 */
export interface PaymentChannelDef {
  method: PaymentMethod;
  label: string;
  description: string;
  /** Settings flag that enables it. */
  setting: keyof AppSettings["payments"];
  /** Needs an online connection to the acquirer. */
  online: boolean;
}

export const PAYMENT_CHANNELS: PaymentChannelDef[] = [
  { method: "pos", label: "POS Terminal", description: "Card on the connected Smart POS terminal", setting: "allowPos", online: true },
  { method: "card", label: "Card (manual / virtual)", description: "Card payment authorised outside the terminal", setting: "allowCard", online: true },
  { method: "qr", label: "QR Payment", description: "Customer scans a payment QR with a mobile wallet", setting: "allowQr", online: true },
  { method: "cash", label: "Cash", description: "Cash received at the counter", setting: "allowCash", online: false },
  { method: "online", label: "Electronic Payment", description: "Online banking / payment gateway", setting: "allowOnline", online: true },
  { method: "bank_transfer", label: "Bank Transfer", description: "Direct credit with bank reference", setting: "allowBankTransfer", online: true },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = Object.fromEntries(PAYMENT_CHANNELS.map((c) => [c.method, c.label])) as Record<PaymentMethod, string>;

export function enabledPaymentChannels(settings: AppSettings | null | undefined): PaymentChannelDef[] {
  if (!settings) return PAYMENT_CHANNELS;
  return PAYMENT_CHANNELS.filter((c) => settings.payments[c.setting] !== false);
}
