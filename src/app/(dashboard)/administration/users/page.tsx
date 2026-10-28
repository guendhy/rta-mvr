"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Power, PowerOff, UserPlus } from "lucide-react";
import { useServiceQuery, useAction } from "@/hooks/use-service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/constants";
import { formatDateTime, formatRelative, fullName } from "@/lib/formatting";
import { userService } from "@/services/user.service";
import { settingsService } from "@/services/settings.service";
import type { UserInput } from "@/services/interfaces";
import type { Office, RoleKey, SafeUser } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { ActiveBadge, FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter the first name"),
  lastName: z.string().trim().min(1, "Enter the last name"),
  email: z.string().trim().min(1, "Enter the email").email("Enter a valid email address"),
  employeeNumber: z.string().trim().min(2, "Enter the employee number"),
  role: z.enum(ROLE_ORDER as [RoleKey, ...RoleKey[]], { message: "Select a role" }),
  officeId: z.string().min(1, "Select an office"),
  phone: z.string().trim().min(6, "Enter a contact phone number"),
  status: z.enum(["active", "disabled"]),
});
type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS = ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const STATUS_OPTIONS = [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }];

function UserForm({ user, offices, onDone }: { user: SafeUser | null; offices: Office[]; onDone: () => void }) {
  const save = useAction((v: UserInput) => (user ? userService.update(user.id, v) : userService.create(v)), { success: user ? "User updated" : "User created. Default password: password123" });
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: user
      ? { firstName: user.firstName, lastName: user.lastName, email: user.email, employeeNumber: user.employeeNumber, role: user.role, officeId: user.officeId, phone: user.phone, status: user.status }
      : { firstName: "", lastName: "", email: "", employeeNumber: "", role: "registration_officer", officeId: offices[0]?.id ?? "", phone: "", status: "active" },
  });
  const onSubmit = async (v: FormValues) => {
    if (await save.run(v)) onDone();
  };
  return (
    <Modal open onClose={() => !save.busy && onDone()} title={user ? `Edit ${fullName(user)}` : "Add user"} description={user ? user.email : "New users sign in with the demo password password123."} size="lg" footer={<FormFooter formId="user-form" busy={save.busy} onCancel={onDone} submitLabel={user ? "Save changes" : "Create user"} />}>
      <form id="user-form" className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="First name" required htmlFor="u-first" error={errors.firstName?.message}><Input id="u-first" invalid={!!errors.firstName} {...register("firstName")} /></Field>
        <Field label="Last name" required htmlFor="u-last" error={errors.lastName?.message}><Input id="u-last" invalid={!!errors.lastName} {...register("lastName")} /></Field>
        <Field label="Email" required htmlFor="u-email" error={errors.email?.message}><Input id="u-email" type="email" autoComplete="off" invalid={!!errors.email} {...register("email")} /></Field>
        <Field label="Employee number" required htmlFor="u-emp" error={errors.employeeNumber?.message}><Input id="u-emp" mono invalid={!!errors.employeeNumber} {...register("employeeNumber")} /></Field>
        <Field label="Role" required htmlFor="u-role" error={errors.role?.message}><Select id="u-role" options={ROLE_OPTIONS} invalid={!!errors.role} {...register("role")} /></Field>
        <Field label="Office" required htmlFor="u-office" error={errors.officeId?.message}><Select id="u-office" placeholder="Select office" options={offices.map((o) => ({ value: o.id, label: o.name }))} invalid={!!errors.officeId} {...register("officeId")} /></Field>
        <Field label="Phone" required htmlFor="u-phone" error={errors.phone?.message}><Input id="u-phone" type="tel" invalid={!!errors.phone} {...register("phone")} /></Field>
        <Field label="Status" required htmlFor="u-status"><Select id="u-status" options={STATUS_OPTIONS} {...register("status")} /></Field>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useDemoUser();
  const users = useServiceQuery(() => userService.list(), []);
  const offices = useServiceQuery(() => settingsService.listOffices(), []);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<SafeUser | "new" | null>(null);
  const [toggling, setToggling] = useState<SafeUser | null>(null);
  const toggle = useAction((u: SafeUser) => userService.setStatus(u.id, u.status === "active" ? "disabled" : "active"), { success: (u) => `${fullName(u)} ${u.status === "active" ? "enabled" : "disabled"}` });

  const officeName = (id: string) => offices.data?.find((o) => o.id === id)?.name ?? "—";
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) =>
      (!role || u.role === role) &&
      (!status || u.status === status) &&
      (!term || `${u.firstName} ${u.lastName} ${u.email} ${u.employeeNumber}`.toLowerCase().includes(term)),
    );
  }, [users.data, q, role, status]);

  const actions = (u: SafeUser, small = true) => (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={`btn btn-s ${small ? "btn-sm" : ""}`} onClick={() => setEditing(u)} aria-label={`Edit ${fullName(u)}`}><Pencil size={14} aria-hidden="true" />Edit</button>
      {u.status === "active" ? (
        <button type="button" className={`btn btn-do ${small ? "btn-sm" : ""}`} onClick={() => setToggling(u)} disabled={u.id === me?.id} title={u.id === me?.id ? "You cannot disable your own account" : undefined}><PowerOff size={14} aria-hidden="true" />Disable</button>
      ) : (
        <button type="button" className={`btn btn-s ${small ? "btn-sm" : ""}`} onClick={() => setToggling(u)}><Power size={14} aria-hidden="true" />Enable</button>
      )}
    </div>
  );

  const columns: ColumnDef<SafeUser, unknown>[] = [
    { id: "name", header: "Name", accessorFn: (u) => fullName(u), cell: ({ row }) => <span className="font-semibold">{fullName(row.original)}</span> },
    { id: "emp", header: "Employee Number", accessorFn: (u) => u.employeeNumber, cell: ({ row }) => <span className="mono">{row.original.employeeNumber}</span> },
    { id: "email", header: "Email", accessorFn: (u) => u.email },
    { id: "role", header: "Role", accessorFn: (u) => ROLE_LABELS[u.role] },
    { id: "office", header: "Office", accessorFn: (u) => officeName(u.officeId) },
    { id: "status", header: "Status", accessorFn: (u) => u.status, cell: ({ row }) => <ActiveBadge active={row.original.status === "active"} off="Disabled" /> },
    { id: "login", header: "Last Login", accessorFn: (u) => u.lastLoginAt ?? "", cell: ({ row }) => <span className="mono whitespace-nowrap" title={formatDateTime(row.original.lastLoginAt)}>{row.original.lastLoginAt ? formatRelative(row.original.lastLoginAt) : "Never"}</span> },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => actions(row.original) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="RTA staff accounts, roles and office assignments."
        actions={<button type="button" className="btn btn-p" onClick={() => setEditing("new")} disabled={!offices.data}><UserPlus size={18} aria-hidden="true" />Add User</button>}
      />
      <FilterBar>
        <SearchField id="user-q" value={q} onChange={setQ} placeholder="Name, email or employee number" />
        <FilterSelect id="user-role" label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} all="All roles" />
        <FilterSelect id="user-status" label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} all="All statuses" />
      </FilterBar>
      {users.error ? (
        <ErrorState message={users.error} onRetry={() => users.reload()} />
      ) : (
        <>
          {users.data && <ResultCount shown={rows.length} total={users.data.length} noun="users" />}
          <DataTable
            storageKey="admin-users"
            data={users.data ? rows : undefined}
            loading={users.loading}
            columns={columns}
            initialSort={[{ id: "name", desc: false }]}
            mobileCard={(u) => (
              <MobileCard
                title={u.employeeNumber}
                badge={<ActiveBadge active={u.status === "active"} off="Disabled" />}
                lines={[fullName(u), `${ROLE_LABELS[u.role]} · ${officeName(u.officeId)}`, u.email, `Last login: ${u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}`]}
                footer={actions(u, false)}
              />
            )}
            empty={{ title: "No users found", message: q || role || status ? "No users match the current filters." : "No user accounts exist yet.", action: { label: "Add User", onClick: () => setEditing("new") } }}
          />
        </>
      )}

      {editing && offices.data && <UserForm key={editing === "new" ? "new" : editing.id} user={editing === "new" ? null : editing} offices={offices.data} onDone={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        busy={toggle.busy}
        title={toggling?.status === "active" ? "Disable user?" : "Enable user?"}
        tone={toggling?.status === "active" ? "danger" : "primary"}
        confirmLabel={toggling?.status === "active" ? "Disable user" : "Enable user"}
        message={toggling?.status === "active"
          ? <><strong>{fullName(toggling)}</strong> will no longer be able to sign in. Their past activity stays in the audit log.</>
          : <><strong>{fullName(toggling)}</strong> will be able to sign in again with their existing role.</>}
        onConfirm={async () => {
          if (toggling && (await toggle.run(toggling))) setToggling(null);
        }}
      />
    </div>
  );
}
