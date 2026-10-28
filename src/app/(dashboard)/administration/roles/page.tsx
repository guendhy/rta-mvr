"use client";

import { Fragment, useMemo, useState } from "react";
import { Lock, RotateCcw, Save, Undo2 } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/constants";
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { userService } from "@/services/user.service";
import type { Permission, RoleKey, RolePermissionMatrix } from "@/types";
import { PageHeader, Section } from "@/components/ui/layout-bits";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/modal";

const GROUPS = ALL_PERMISSIONS.reduce<{ group: string; items: typeof ALL_PERMISSIONS }[]>((acc, p) => {
  const g = acc.find((x) => x.group === p.group);
  if (g) g.items.push(p);
  else acc.push({ group: p.group, items: [p] });
  return acc;
}, []);

const ALL_KEYS = ALL_PERMISSIONS.map((p) => p.key);

function normalise(m: RolePermissionMatrix): RolePermissionMatrix {
  return Object.fromEntries(ROLE_ORDER.map((r) => [r, r === "super_admin" ? ALL_KEYS : ALL_KEYS.filter((k) => (m[r] ?? []).includes(k))])) as RolePermissionMatrix;
}

const same = (a: RolePermissionMatrix, b: RolePermissionMatrix) => ROLE_ORDER.every((r) => a[r].length === b[r].length && a[r].every((p) => b[r].includes(p)));

export default function RolesPage() {
  const { can } = useDemoUser();
  const canEdit = can("roles.manage");
  const roles = useServiceQuery(() => userService.listRoles(), []);
  const matrix = useServiceQuery(() => userService.getPermissions(), []);
  const [draft, setDraft] = useState<RolePermissionMatrix | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const save = useAction((m: RolePermissionMatrix) => userService.updatePermissions(m), { success: "Role permissions saved" });

  const saved = useMemo(() => (matrix.data ? normalise(matrix.data) : null), [matrix.data]);
  const current = draft ?? saved;
  const dirty = !!(draft && saved && !same(draft, saved));

  if (matrix.error) return <ErrorState message={matrix.error} onRetry={() => matrix.reload()} />;
  if (!current || !saved) return <PageSkeleton />;

  const toggle = (role: RoleKey, perm: Permission, on: boolean) => {
    if (role === "super_admin" || !canEdit) return;
    const base = draft ?? saved;
    const next = on ? [...base[role], perm] : base[role].filter((p) => p !== perm);
    setDraft({ ...base, [role]: ALL_KEYS.filter((k) => next.includes(k)) });
  };

  const persist = async (m: RolePermissionMatrix) => {
    const r = await save.run(m);
    if (r) setDraft(null);
    return r;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Roles & Permissions"
        description="Choose what each role can see and do. Changes apply to every user with that role the next time a screen loads."
        actions={
          canEdit && <>
            <button type="button" className="btn btn-s" onClick={() => setConfirmReset(true)} disabled={save.busy}><RotateCcw size={16} aria-hidden="true" />Reset to defaults</button>
            {dirty && <button type="button" className="btn btn-g" onClick={() => setDraft(null)} disabled={save.busy}><Undo2 size={16} aria-hidden="true" />Discard</button>}
            <button type="button" className="btn btn-p" onClick={() => draft && persist(draft)} disabled={!dirty || save.busy}>
              {save.busy ? <span className="spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save changes
            </button>
          </>
        }
      />

      {!canEdit && <Alert tone="warn" title="View only">Your role can view the permission matrix but cannot change it.</Alert>}
      {dirty && <Alert tone="warn" title="You have unsaved permission changes">Select Save changes to apply them, or Discard to keep the current permissions.</Alert>}

      <div className="g4">
        {(roles.data ?? ROLE_ORDER.map((key) => ({ key, name: ROLE_LABELS[key], description: "", readOnly: false }))).map((r) => (
          <div key={r.key} className="card tile">
            <div className="flex items-start justify-between gap-2">
              <p className="h3 text-[15px]">{r.name}</p>
              {r.key === "super_admin" ? <Badge tone="insp">Locked</Badge> : r.readOnly ? <Badge tone="draft">Read-only</Badge> : null}
            </div>
            <p className="mut m-0 text-[13px]">{r.description || "—"}</p>
            <p className="m-0 text-[12.5px] font-semibold">{(current[r.key] ?? []).length} of {ALL_KEYS.length} permissions</p>
          </div>
        ))}
      </div>

      <Section title="Permission matrix" description={`Super Administrator always has every permission and cannot be edited. ${ALL_KEYS.length} permissions across ${GROUPS.length} areas.`}>
        <div className="-mx-6 -mb-[22px] overflow-x-auto border-t border-[#e1e4ea]">
          <table className="tbl min-w-[900px]">
            <caption className="sr">Permissions by role. Each checkbox grants one permission to one role.</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-[220px] bg-[#f7f8fa]">Permission</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} scope="col" className="!text-center !whitespace-normal">
                    <span className="inline-flex items-center gap-1">{r === "super_admin" && <Lock size={12} aria-hidden="true" />}{ROLE_LABELS[r]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <Fragment key={g.group}>
                  <tr>
                    <th scope="colgroup" colSpan={ROLE_ORDER.length + 1} className="!bg-[#eef0f4] !text-[#0b0b0f]">{g.group}</th>
                  </tr>
                  {g.items.map((p) => (
                    <tr key={p.key}>
                      <th scope="row" className="sticky left-0 z-10 !bg-white !text-[13px] !font-semibold !normal-case !tracking-normal !text-[#0b0b0f]">
                        {p.label}
                        <span className="mono mut block text-[11px] font-normal">{p.key}</span>
                      </th>
                      {ROLE_ORDER.map((r) => {
                        const locked = r === "super_admin";
                        const on = locked || current[r].includes(p.key);
                        const changed = !locked && on !== saved[r].includes(p.key);
                        return (
                          <td key={r} className={`!p-0 text-center ${changed ? "bg-[#fff8d6]" : ""}`}>
                            <label className="flex min-h-[44px] cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                className="chk"
                                checked={on}
                                disabled={locked || !canEdit || save.busy}
                                onChange={(e) => toggle(r, p.key, e.target.checked)}
                                aria-label={`${ROLE_LABELS[r]}: ${p.label}`}
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        busy={save.busy}
        tone="danger"
        title="Reset to default permissions?"
        confirmLabel="Reset permissions"
        message="Every role will be returned to the standard RTA permission set. Any custom changes, saved or unsaved, will be lost."
        onConfirm={async () => {
          if (await persist(normalise(DEFAULT_PERMISSIONS))) setConfirmReset(false);
        }}
      />
    </div>
  );
}
