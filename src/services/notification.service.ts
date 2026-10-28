import { appConfig } from "@/lib/config";
import type { NotificationService } from "./interfaces";
import { MockNotificationService } from "./mock/admin.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): NotificationService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockNotificationService();
}

export const notificationService: NotificationService = create();
