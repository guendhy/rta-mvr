import { ServiceError } from "@/lib/errors";
import { KEYS, mockStorage } from "@/lib/mock-storage";
import { mockDelay } from "@/lib/mock-delay";
import { hasPermission, ALL_PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";
import type { AuthService, SessionInfo } from "../interfaces";
import type { RoleKey, SafeUser, Session, User } from "@/types";
import { audit, ensureSeeded, findById, getSession, read, write } from "./core";

function toSafe(u: User): SafeUser {
  const { password: _pw, ...safe } = u;
  void _pw;
  return safe;
}

function buildInfo(user: User, session: Session): SessionInfo {
  const matrix = read("permissions");
  return {
    user: toSafe(user),
    activeRole: session.activeRole,
    permissions: ALL_PERMISSIONS.map((p) => p.key).filter((p) => hasPermission(matrix, session.activeRole, p)),
    office: findById("offices", user.officeId),
  };
}

// FUTURE: Replace MockAuthService with SupabaseAuthService (Supabase Auth + RLS-backed roles).
export class MockAuthService implements AuthService {
  async login(email: string, password: string): Promise<SessionInfo> {
    ensureSeeded();
    await mockDelay(400, 900);
    const users = read("users");
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) throw new ServiceError("auth", "Incorrect email or password.");
    if (user.status !== "active") throw new ServiceError("auth", "This account is disabled. Contact your RTA administrator.");
    const session: Session = { userId: user.id, activeRole: user.role, startedAt: new Date().toISOString() };
    mockStorage.set(KEYS.session, session);
    user.lastLoginAt = session.startedAt;
    write("users", users);
    audit("login", "Session", `${user.firstName} ${user.lastName} signed in`);
    return buildInfo(user, session);
  }

  async logout(): Promise<void> {
    const s = getSession();
    if (s) audit("logout", "Session", "Signed out");
    mockStorage.remove(KEYS.session);
  }

  async getSession(): Promise<SessionInfo | null> {
    ensureSeeded();
    const s = getSession();
    if (!s) return null;
    const user = findById("users", s.userId);
    if (!user || user.status !== "active") {
      mockStorage.remove(KEYS.session);
      return null;
    }
    return buildInfo(user, s);
  }

  async switchRole(role: RoleKey): Promise<SessionInfo> {
    const s = getSession();
    if (!s) throw new ServiceError("auth", "Please sign in first.");
    const user = findById("users", s.userId);
    if (!user) throw new ServiceError("auth", "Please sign in again.");
    const next: Session = { ...s, activeRole: role };
    mockStorage.set(KEYS.session, next);
    audit("role_switched", "Session", `Demo role switched to ${ROLE_LABELS[role]}`);
    return buildInfo(user, next);
  }

  async requestPasswordReset(email: string): Promise<void> {
    await mockDelay(500, 900);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ServiceError("validation", "Enter a valid email address.");
    // Simulated: no email service in Phase 1.
  }
}
