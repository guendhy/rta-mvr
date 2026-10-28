"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleCheck, RefreshCw } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { ServiceError, friendlyError } from "@/lib/errors";
import { formatDate, fullName, motorcycleLabel } from "@/lib/formatting";
import { plateService } from "@/services/plate.service";
import { settingsService } from "@/services/settings.service";
import type { PlateAssignmentItem } from "@/services/interfaces";
import type { Plate } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/form";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { DescriptionList } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";

type Step = "pick" | "confirm" | "done";

function AssignPlateModal({ item, officeName, onClose }: { item: PlateAssignmentItem; officeName: (id: string) => string; onClose: () => void }) {
  const app = item.application;
  const [allOffices, setAllOffices] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Plate | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [assigned, setAssigned] = useState<Plate | null>(null);
  const available = useServiceQuery(() => plateService.listAvailable(allOffices ? undefined : app.officeId), [allOffices, app.officeId], { live: step === "pick" });

  const plates = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (available.data ?? []).filter((p) => !term || p.plateNumber.toLowerCase().includes(term));
  }, [available.data, filter]);

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const plate = await plateService.assign(selected.id, app.id);
      setAssigned(plate);
      setStep("done");
      toast.success(`Plate ${plate.plateNumber} assigned`);
    } catch (e) {
      setError({ message: friendlyError(e), conflict: e instanceof ServiceError && e.code === "conflict" });
    } finally {
      setBusy(false);
    }
  };

  const pickAnother = () => {
    setError(null);
    setSelected(null);
    setStep("pick");
    available.reload();
  };

  const summary = (
    <DescriptionList
      items={[
        ["Transaction", <span key="t" className="mono">{app.transactionNumber}</span>],
        ["Owner", fullName(item.owner)],
        ["Motorcycle", motorcycleLabel(item.motorcycle)],
        ["Registration No.", <span key="r" className="mono">{app.registrationNumber ?? "—"}</span>],
        ["Office", officeName(app.officeId)],
      ]}
    />
  );

  const footer =
    step === "done" ? (
      <>
        <button type="button" className="btn btn-s" onClick={onClose}>Close</button>
        <Link href={`/registrations/${app.id}`} className="btn btn-p">Open registration<ArrowRight size={16} aria-hidden="true" /></Link>
      </>
    ) : step === "confirm" ? (
      <>
        <button type="button" className="btn btn-s" onClick={() => { setError(null); setStep("pick"); }} disabled={busy}><ArrowLeft size={16} aria-hidden="true" />Back</button>
        {error?.conflict ? (
          <button type="button" className="btn btn-p" onClick={pickAnother}><RefreshCw size={16} aria-hidden="true" />Pick another plate</button>
        ) : (
          <button type="button" className="btn btn-ok" onClick={assign} disabled={busy}>
            {busy ? <span className="spin" aria-hidden="true" /> : <BadgeCheck size={16} aria-hidden="true" />}
            {busy ? "Assigning…" : error ? "Try again" : "Confirm assignment"}
          </button>
        )}
      </>
    ) : (
      <>
        <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-p" disabled={!selected} onClick={() => setStep("confirm")}>Continue<ArrowRight size={16} aria-hidden="true" /></button>
      </>
    );

  return (
    <Modal open onClose={() => !busy && onClose()} size="lg" title={step === "done" ? "Plate assigned" : step === "confirm" ? "Confirm plate assignment" : "Assign plate"} description={step === "pick" ? "Only plates with status Available are listed." : undefined} footer={footer}>
      {step === "done" && assigned ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CircleCheck size={44} className="text-[#137a3b]" aria-hidden="true" />
          <p className="eb">Plate number</p>
          <p className="mono m-0 rounded-lg border-2 border-[#0b0b0f] bg-[#ffd21a] px-6 py-3 text-[30px] font-extrabold tracking-[.06em] text-[#0b0b0f]">{assigned.plateNumber}</p>
          <p className="m-0 text-[14px]">Assigned to <strong>{motorcycleLabel(item.motorcycle)}</strong> ({app.registrationNumber ?? app.transactionNumber}). The registration is now complete.</p>
          <Link href={`/registrations/${app.id}`} className="font-semibold">View registration {app.transactionNumber}</Link>
        </div>
      ) : step === "confirm" && selected ? (
        <div className="flex flex-col gap-4">
          {error && (
            <Alert tone="bad" title={error.conflict ? "Plate no longer available" : "The plate could not be assigned"}>
              {error.message} {error.conflict && "Another officer may have just taken it. Pick another plate to continue."}
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[#f7f8fa] p-4">
            <span className="mono rounded-md border-2 border-[#0b0b0f] bg-[#ffd21a] px-3 py-1.5 text-[20px] font-extrabold tracking-[.05em]">{selected.plateNumber}</span>
            <span className="mut text-[13px]">{officeName(selected.officeId)} · received {formatDate(selected.receivedDate)}</span>
          </div>
          {summary}
          <p className="m-0 text-[13.5px]">Assigning this plate completes the registration and cannot be undone from this screen.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-[#f7f8fa] p-3.5">{summary}</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[min(100%,200px)] flex-1">
              <label htmlFor="plate-pick-q" className="lbl">Find plate</label>
              <input id="plate-pick-q" type="search" className="inp mono" placeholder="MC-" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div className="min-w-[min(100%,240px)]">
              <Toggle checked={allOffices} onChange={(v) => { setAllOffices(v); setSelected(null); }} label="Show all offices" description={allOffices ? "Listing plates from every office" : `Only ${officeName(app.officeId)}`} />
            </div>
          </div>
          {available.error ? (
            <ErrorState message={available.error} onRetry={() => available.reload()} />
          ) : !available.data || available.loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true" aria-label="Loading plates">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[52px] rounded-lg" />)}</div>
          ) : !plates.length ? (
            <EmptyState
              title="No plates available"
              message={filter ? "No available plates match that number." : "No available motorcycle plates were found."}
              action={!allOffices ? { label: "Show all offices", onClick: () => setAllOffices(true) } : undefined}
            />
          ) : (
            <fieldset className="m-0 border-0 p-0">
              <legend className="lbl">Available plates ({plates.length})</legend>
              <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3">
                {plates.map((p) => (
                  <label key={p.id} className={`opt !min-h-[52px] ${selected?.id === p.id ? "opt-on" : ""}`}>
                    <input type="radio" name="plate" className="chk" checked={selected?.id === p.id} onChange={() => setSelected(p)} />
                    <span className="flex min-w-0 flex-col">
                      <span className="mono font-bold">{p.plateNumber}</span>
                      {allOffices && <span className="mut truncate text-[11.5px] font-normal">{officeName(p.officeId)}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </Modal>
  );
}

export function PlateAssign() {
  const { can } = useDemoUser();
  const canAssign = can("plates.assign");
  const queue = useServiceQuery(() => plateService.awaitingAssignment(), []);
  const offices = useServiceQuery(() => settingsService.listOffices(), []);
  const [active, setActive] = useState<PlateAssignmentItem | null>(null);
  const officeName = (id: string) => offices.data?.find((o) => o.id === id)?.name ?? "—";

  const action = (r: PlateAssignmentItem, full = false) =>
    canAssign ? (
      <button type="button" className={`btn btn-p ${full ? "w-full" : "btn-sm"}`} onClick={() => setActive(r)} aria-label={`Assign plate to ${r.application.transactionNumber}`}>
        <BadgeCheck size={15} aria-hidden="true" />Assign Plate
      </button>
    ) : null;

  const columns: ColumnDef<PlateAssignmentItem, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.application.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.application.id}`} className="mono font-semibold">{row.original.application.transactionNumber}</Link> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.motorcycle) },
    { id: "reg", header: "Registration Number", accessorFn: (r) => r.application.registrationNumber ?? "", cell: ({ row }) => <span className="mono">{row.original.application.registrationNumber ?? "—"}</span> },
    { id: "office", header: "Office", accessorFn: (r) => officeName(r.application.officeId) },
    { id: "status", header: "Status", accessorFn: (r) => r.application.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.application.status} /> },
    { id: "approved", header: "Approved", accessorFn: (r) => r.application.approval?.at ?? r.application.updatedAt, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.application.approval?.at ?? row.original.application.updatedAt)}</span> },
    ...(canAssign ? [{ id: "action", header: "Action", enableSorting: false, cell: ({ row }) => action(row.original) } as ColumnDef<PlateAssignmentItem, unknown>] : []),
  ];

  if (queue.error) return <ErrorState message={queue.error} onRetry={() => queue.reload()} />;

  return (
    <div className="flex flex-col gap-5">
      {!canAssign && <Alert tone="info" title="View only">Your role can view the plate queue but cannot assign plates.</Alert>}
      {queue.data && <p className="mut m-0 text-[13px]" aria-live="polite">{queue.data.length} approved registration{queue.data.length === 1 ? "" : "s"} awaiting a plate</p>}
      <DataTable
        storageKey="plates-assign"
        data={queue.data}
        loading={queue.loading}
        columns={columns}
        initialSort={[{ id: "approved", desc: false }]}
        mobileCard={(r) => (
          <MobileCard
            title={r.application.transactionNumber}
            badge={<StatusBadge kind="registration" status={r.application.status} />}
            lines={[fullName(r.owner), motorcycleLabel(r.motorcycle), `Reg. No. ${r.application.registrationNumber ?? "—"} · ${officeName(r.application.officeId)}`]}
            footer={action(r, true) ?? <Link href={`/registrations/${r.application.id}`}>View registration</Link>}
          />
        )}
        empty={{ title: "No registrations awaiting a plate", message: "Approved registrations appear here until a plate is assigned." }}
      />
      {active && <AssignPlateModal key={active.application.id} item={active} officeName={officeName} onClose={() => setActive(null)} />}
    </div>
  );
}
