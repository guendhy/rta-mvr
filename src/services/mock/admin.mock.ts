import { SEED_ROLES } from "@/data/mock/roles";
import { ServiceError } from "@/lib/errors";
import { uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import { ROLE_LABELS } from "@/lib/constants";
import type { AuditListFilter, AuditService, NotificationService, SettingsService, UserInput, UserService } from "../interfaces";
import type { AppNotification, AppSettings, AuditEvent, Office, Role, RolePermissionMatrix, SafeUser, User } from "@/types";
import { audit, findById, mustFind, nowIso, read, requirePermission, simulateNetwork, upsert, write } from "./core";

const safe = (u: User): SafeUser => {
  const { password: _pw, ...rest } = u;
  void _pw;
  return rest;
};

// FUTURE: Replace MockUserService with SupabaseUserService (auth.users + profiles + roles tables).
export class MockUserService implements UserService {
  async list(): Promise<SafeUser[]> {
    await mockDelay();
    return read("users").map(safe);
  }

  async getById(id: string): Promise<SafeUser | null> {
    await mockDelay(100, 300);
    const u = findById("users", id);
    return u ? safe(u) : null;
  }

  private assertUnique(input: Partial<UserInput>, id?: string) {
    const users = read("users");
    if (input.email && users.some((u) => u.id !== id && u.email.toLowerCase() === input.email!.toLowerCase())) throw new ServiceError("conflict", "Another user already uses this email.");
    if (input.employeeNumber && users.some((u) => u.id !== id && u.employeeNumber.toLowerCase() === input.employeeNumber!.toLowerCase())) throw new ServiceError("conflict", "Another user already uses this employee number.");
  }

  async create(input: UserInput): Promise<SafeUser> {
    requirePermission("users.manage", "manage users");
    await mockDelay();
    simulateNetwork();
    this.assertUnique(input);
    const ts = nowIso();
    const user: User = { ...input, id: uuid(), password: "password123", createdAt: ts, updatedAt: ts };
    upsert("users", user);
    audit("user_created", "User", `User ${user.firstName} ${user.lastName} created as ${ROLE_LABELS[user.role]}`, { id: user.id, label: user.email });
    return safe(user);
  }

  async update(id: string, input: Partial<UserInput>): Promise<SafeUser> {
    requirePermission("users.manage", "manage users");
    await mockDelay();
    simulateNetwork();
    this.assertUnique(input, id);
    const u = mustFind("users", id, "User");
    const next = { ...u, ...input, updatedAt: nowIso() };
    upsert("users", next);
    audit("user_updated", "User", `User ${next.firstName} ${next.lastName} updated`, { id, label: next.email });
    return safe(next);
  }

  async setStatus(id: string, status: User["status"]): Promise<SafeUser> {
    requirePermission("users.manage", "manage users");
    await mockDelay();
    const u = mustFind("users", id, "User");
    const session = read("users").find((x) => x.id === id);
    if (status === "disabled" && session && u.role === "super_admin" && read("users").filter((x) => x.role === "super_admin" && x.status === "active").length <= 1) {
      throw new ServiceError("workflow", "At least one Super Admin must remain active.");
    }
    const next = { ...u, status, updatedAt: nowIso() };
    upsert("users", next);
    audit("user_status_changed", "User", `User ${u.firstName} ${u.lastName} ${status === "active" ? "enabled" : "disabled"}`, { id, label: u.email });
    return safe(next);
  }

  async listRoles(): Promise<Role[]> {
    await mockDelay(100, 250);
    return SEED_ROLES;
  }

  async getPermissions(): Promise<RolePermissionMatrix> {
    await mockDelay(150, 400);
    return read("permissions");
  }

  async updatePermissions(matrix: RolePermissionMatrix): Promise<RolePermissionMatrix> {
    requirePermission("roles.manage", "change permissions");
    await mockDelay();
    const next = { ...matrix, super_admin: read("permissions").super_admin };
    write("permissions", next);
    audit("permissions_changed", "Role", "Role permission matrix updated");
    return next;
  }
}

// FUTURE: Replace MockSettingsService with SupabaseSettingsService.
export class MockSettingsService implements SettingsService {
  async get(): Promise<AppSettings> {
    await mockDelay(100, 300);
    return read("settings");
  }

  async update(settings: AppSettings): Promise<AppSettings> {
    requirePermission("settings.manage", "change settings");
    await mockDelay();
    simulateNetwork();
    const next = { ...settings, updatedAt: nowIso() };
    write("settings", next);
    audit("settings_changed", "Settings", "System settings updated");
    return next;
  }

  async listOffices(): Promise<Office[]> {
    await mockDelay(100, 300);
    return read("offices");
  }

  async saveOffice(office: Partial<Office> & Pick<Office, "name" | "code" | "province" | "district" | "address" | "phone" | "email" | "status">): Promise<Office> {
    requirePermission("offices.manage", "manage offices");
    await mockDelay();
    if (read("offices").some((o) => o.code.toLowerCase() === office.code.toLowerCase() && o.id !== office.id)) throw new ServiceError("conflict", "Another office already uses this code.");
    const ts = nowIso();
    const existing = office.id ? findById("offices", office.id) : null;
    const rec = { ...(existing ?? { id: uuid(), createdAt: ts }), ...office, updatedAt: ts } as Office;
    upsert("offices", rec);
    audit("office_saved", "Office", `Office ${rec.name} saved`, { id: rec.id, label: rec.code });
    return rec;
  }
}

export class MockAuditService implements AuditService {
  async list(filter: AuditListFilter = {}): Promise<AuditEvent[]> {
    await mockDelay();
    let list = read("audit");
    if (filter.action) list = list.filter((e) => e.action === filter.action);
    if (filter.userId) list = list.filter((e) => e.userId === filter.userId);
    if (filter.entity) list = list.filter((e) => e.entity === filter.entity);
    if (filter.recordId) list = list.filter((e) => e.recordId === filter.recordId);
    if (filter.query?.trim()) {
      const q = filter.query.toLowerCase();
      list = list.filter((e) => `${e.description} ${e.userName} ${e.recordLabel ?? ""}`.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}

export class MockNotificationService implements NotificationService {
  async list(): Promise<AppNotification[]> {
    await mockDelay(100, 250);
    return [...read("notifications")].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markRead(id: string): Promise<void> {
    write("notifications", read("notifications").map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async markAllRead(): Promise<void> {
    write("notifications", read("notifications").map((n) => ({ ...n, read: true })));
  }
}
