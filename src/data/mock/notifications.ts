import { uuid } from "@/lib/generators";
import type { AppNotification, NotificationSeverity } from "@/types";

type NotificationSeed = [title: string, message: string, severity: NotificationSeverity, link: string, hoursAgo: number, read: boolean];

const SEEDS: NotificationSeed[] = [
  ["New Registration Created", "RTA-MV-2026-00000021 created for Kevin Embogi — ready for inspection.", "info", "/inspections", 0.3, false],
  ["Inspection Failed", "RTA-MV-2026-00000022 failed inspection (brakes). Reinspection required.", "danger", "/inspections", 6, false],
  ["Payment Received", "POS payment received for RTA-MV-2026-00000025.", "success", "/payments", 3, false],
  ["Registration Ready for Approval", "RTA-MV-2026-00000025 is paid and waiting for supervisor approval.", "info", "/registrations/approval", 3, false],
  ["Registration Approved", "RTA-MV-2026-00000027 approved — assign a number plate.", "success", "/plates", 2.5, false],
  ["Low Plate Inventory", "Lae RTA has 6 PMV plates left in stock. Reorder threshold is 10.", "warning", "/plates", 9, false],
  ["POS Terminal Offline", "Terminal RTA-LAE-002 has not connected for 14 minutes.", "danger", "/administration/terminals", 1, true],
  ["Registration Expiring", "Several motor vehicle registrations expire within the next 30 days.", "warning", "/registry", 20, false],
  ["Payment Declined", "POS payment for RTA-MV-2026-00000026 was declined (Insufficient funds).", "warning", "/payments", 2, true],
  ["Insurance Expired", "Policy on RTA-MV-2026-00000023 has expired. Owner must renew third-party cover.", "warning", "/insurance", 22, true],
  ["Registration Returned", "RTA-MV-2026-00000029 returned for correction by P. Kaupa.", "warning", "/registrations?status=returned", 40, true],
  ["Registration Rejected", "RTA-MV-2026-00000030 rejected — referred to RTA Compliance.", "danger", "/registrations?status=rejected", 70, true],
  ["Fee Schedule Reviewed", "Sample fee rule set SAMPLE-2026.1 loaded — replace with the official RTA schedule.", "info", "/administration/fees", 120, true],
  ["Plates Received", "Plate stock received: private, commercial, PMV, motorcycle and trailer series.", "success", "/plates", 200, true],
  ["System Maintenance", "Scheduled maintenance window Sunday 02:00–04:00 (demo notice).", "info", "/dashboard", 300, true],
];

export function buildNotifications(now: Date): AppNotification[] {
  return SEEDS.map(([title, message, severity, link, hoursAgo, read]) => ({
    id: uuid(),
    title,
    message,
    severity,
    link,
    read,
    createdAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
  }));
}
