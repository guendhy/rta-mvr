import { appConfig } from "@/lib/config";
import type { PaymentService } from "./interfaces";
import { MockPaymentService } from "./mock/payment.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): PaymentService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockPaymentService();
}

export const paymentService: PaymentService = create();
