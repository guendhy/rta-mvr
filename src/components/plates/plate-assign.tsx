"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleCheck, RefreshCw } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { ServiceError, friendlyError } from "@/lib/errors";
import { formatDate, fullName, vehicleLabel } from "@/lib/formatting";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { plateCategoryFor, plateCategoryLabel, vehicleUsageLabel } from "@/config/vehicle-usage";
import { plateService } from "@/services/plate.service";
import { settingsService } from "@/services/settings.service";
import type { PlateAssignmentItem } from "@/services/interfaces";
import type { Plate, PlateCategory } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/form";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { DescriptionList } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { PlateChip, plateCategoryRules } from "./plate-bits";

type Step = "pick" | "confirm" | "done";

/**
 * Plate series the vehicle must receive — the same rule the plate service enforces.
 * Reclassification uses the new type / use requested on the application.
 */
export function requiredPlateCategory(item: PlateAssignmentItem): PlateCategory | undefined {
  const { application: app, vehicle } = item;
  const cls = app.draft.classification;
  if (app.type === "reclassification") {
    const type = cls?.vehicleType ?? vehicle?.vehicleType;
    return type ? plateCategoryFor(type, cls?.vehicleUsage ?? vehicle?.vehicleUsage) : undefined;
  }
  if (vehicle) return vehicle.plateCategory ?? plateCategoryFor(vehicle.vehicleType, vehicle.vehicleUsage);
  return cls?.vehicleType ? plateCategoryFor(cls.vehicleType, cls.vehicleUsage) : undefined;
}

function vehicleUse(item: PlateAssignmentItem) {
  const cls = item.application.type === "reclassification" ? item.application.draft.classification : undefined;
  const type = cls?.vehicleType ?? item.vehicle?.vehicleType ?? item.application.draft.classification?.vehicleType;
  const usage = cls?.vehicleUsage ?? item.vehicle?.vehicleUsage ?? item.application.draft.classification?.vehicleUsage;
  return { type, usage, text: type ? `${vehicleTypeLabel(type)} · ${vehicleUsageLabel(usage)}` : "—" };
}

const RULES = plateCategoryRules();

function AssignPlateModal({ item, officeName, onClose }: { item: PlateAssignmentItem; officeName: (id: string) => string; onClose: () => void }) {
  const app = item.application;
  const category = requiredPlateCategory(item);
  const use = vehicleUse(item);
  const [allOffices, setAllOffices] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Plate | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [assigned, setAssigned] = useState<Plate | null>(null);
  const available = useServiceQuery(() => plateService.listAvailable(allOffices ? undefined : app.officeId, category), [allOffices, app.officeId, category], { live: step === "pick" });

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
        ["Transaction", <span key="t"><span className="mono">{app.transactionNumber}</span> · {transactionLabel(app.type, true)}</span>],
        ["Owner", fullName(item.owner)],
        ["Vehicle", vehicleLabel(item.vehicle)],
        ["Type · use", <span key="u" className="inline-flex items-center gap-1.5"><VehicleIcon type={use.type} size={16} className="text-[#5a606c]" />{use.text}</span>],
        ["Plate category", <strong key="c">{plateCategoryLabel(category)}</strong>],
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
    <Modal open onClose={() => !busy && onClose()} size="lg" title={step === "done" ? "Plate assigned" : step === "confirm" ? "Confirm plate assignment" : "Assign plate"} description={step === "pick" ? `Only Available plates from the ${plateCategoryLabel(category)} series — the category that matches this vehicle's type and use — are listed.` : undefined} footer={footer}>
      {step === "done" && assigned ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CircleCheck size={44} className="text-[#137a3b]" aria-hidden="true" />
          <p className="eb">Plate number</p>
          <PlateChip number={assigned.plateNumber} size="lg" />
          <p className="m-0 text-[14px]">{plateCategoryLabel(assigned.category)} plate assigned to <strong>{vehicleLabel(item.vehicle)}</strong> ({use.text}, {app.registrationNumber ?? app.transactionNumber}). The transaction is now complete.</p>
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
            <PlateChip number={selected.plateNumber} size="lg" />
            <span className="mut text-[13px]">{plateCategoryLabel(selected.category)} · {officeName(selected.officeId)} · received {formatDate(selected.receivedDate)}</span>
          </div>
          {summary}
          <p className="m-0 text-[13.5px]">Assigning this plate completes the transaction and cannot be undone from this screen.{item.vehicle?.plateNumber && item.vehicle.plateNumber !== selected.plateNumber ? ` The current plate ${item.vehicle.plateNumber} will be released.` : ""}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-[#f7f8fa] p-3.5">{summary}</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[min(100%,200px)] flex-1">
              <label htmlFor="plate-pick-q" className="lbl">Find plate</label>
              <input id="plate-pick-q" type="search" className="inp mono" placeholder="Plate number" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <div className="min-w-[min(100%,240px)]">
              <Toggle checked={allOffices} onChange={(v) => { setAllOffices(v); setSelected(null); }} label="Show all offices" description={allOffices ? "Listing plates from every office" : `Only ${officeName(app.officeId)}`} />
            </div>
          </div>
          {!category ? (
            <Alert tone="warn" title="Plate category unknown">The vehicle&apos;s type and use are not recorded, so the plate series cannot be determined. Complete the vehicle details first.</Alert>
          ) : available.error ? (
            <ErrorState message={available.error} onRetry={() => available.reload()} />
          ) : !available.data || available.loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true" aria-label="Loading plates">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[52px] rounded-lg" />)}</div>
          ) : !plates.length ? (
            <EmptyState
              title="No plates available"
              message={filter ? "No available plates match that number." : `No available ${plateCategoryLabel(category)} plates were found${allOffices ? "" : ` at ${officeName(app.officeId)}`}. Receive a ${plateCategoryLabel(category)} batch in Inventory.`}
              action={!allOffices ? { label: "Show all offices", onClick: () => setAllOffices(true) } : undefined}
            />
          ) : (
            <fieldset className="m-0 border-0 p-0">
              <legend className="lbl">Available {plateCategoryLabel(category)} plates ({plates.length})</legend>
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
          <details className="rounded-lg border border-[#e1e4ea]">
            <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-[13px] font-semibold">Plate category rules</summary>
            <div className="overflow-x-auto border-t border-[#e1e4ea]">
              <table className="tbl text-[13px]">
                <thead><tr><th>Plate category</th><th>Issued for</th><th>Example</th></tr></thead>
                <tbody>
                  {RULES.map((r) => (
                    <tr key={r.category} aria-current={r.category === category ? "true" : undefined} className={r.category === category ? "bg-[#f5f5ff]" : ""}>
                      <td className="font-semibold">{r.label}{r.category === category && <span className="sr-only"> (this vehicle)</span>}</td>
                      <td>{r.issuedFor}</td>
                      <td className="mono">{r.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="help px-3 pb-3">Plate formats are illustrative placeholders from the mock configuration.</p>
          </details>
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
  const stock = useServiceQuery(() => plateService.listAvailable(), []);
  const [active, setActive] = useState<PlateAssignmentItem | null>(null);
  const officeName = (id: string) => offices.data?.find((o) => o.id === id)?.name ?? "—";
  const stockCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of stock.data ?? []) m.set(`${p.officeId}|${p.category}`, (m.get(`${p.officeId}|${p.category}`) ?? 0) + 1);
    return m;
  }, [stock.data]);
  const stockFor = (r: PlateAssignmentItem) => {
    const c = requiredPlateCategory(r);
    return c ? stockCount.get(`${r.application.officeId}|${c}`) ?? 0 : 0;
  };
  const categoryCell = (r: PlateAssignmentItem) => {
    const c = requiredPlateCategory(r);
    if (!c) return <span className="mut">—</span>;
    const left = stockFor(r);
    return (
      <span className="flex flex-col">
        <span className="font-semibold">{plateCategoryLabel(c)}</span>
        {stock.data && <span className={`text-[12px] ${left ? "mut" : "font-semibold text-[#a3111a]"}`}>{left ? `${left} available here` : "None available here"}</span>}
      </span>
    );
  };

  const action = (r: PlateAssignmentItem, full = false) =>
    canAssign ? (
      <button type="button" className={`btn btn-p ${full ? "w-full" : "btn-sm"}`} onClick={() => setActive(r)} aria-label={`Assign plate to ${r.application.transactionNumber}`}>
        <BadgeCheck size={15} aria-hidden="true" />Assign Plate
      </button>
    ) : null;

  const columns: ColumnDef<PlateAssignmentItem, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.application.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.application.id}`} className="mono font-semibold">{row.original.application.transactionNumber}</Link> },
    { id: "ttype", header: "Transaction", accessorFn: (r) => transactionLabel(r.application.type, true) },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle) },
    { id: "use", header: "Type · use", accessorFn: (r) => vehicleUse(r).text, cell: ({ row }) => <span className="inline-flex items-center gap-1.5"><VehicleIcon type={vehicleUse(row.original).type} size={16} className="text-[#5a606c]" />{vehicleUse(row.original).text}</span> },
    { id: "category", header: "Plate category", accessorFn: (r) => plateCategoryLabel(requiredPlateCategory(r)), cell: ({ row }) => categoryCell(row.original) },
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
      {queue.data && <p className="mut m-0 text-[13px]" aria-live="polite">{queue.data.length} approved transaction{queue.data.length === 1 ? "" : "s"} awaiting a plate · only plates of the vehicle&apos;s category can be assigned</p>}
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
            lines={[
              <strong key="o">{fullName(r.owner)}</strong>,
              `${transactionLabel(r.application.type, true)} · ${vehicleLabel(r.vehicle)}`,
              vehicleUse(r).text,
              <span key="c" className="flex flex-wrap gap-1"><span className="mut">Plate category:</span>{categoryCell(r)}</span>,
              `Reg. No. ${r.application.registrationNumber ?? "—"} · ${officeName(r.application.officeId)}`,
            ]}
            footer={action(r, true) ?? <Link href={`/registrations/${r.application.id}`}>View registration</Link>}
          />
        )}
        empty={{ title: "No transactions awaiting a plate", message: "Approved new registrations, replacement plates and reclassifications appear here until a plate is assigned." }}
      />
      {active && <AssignPlateModal key={active.application.id} item={active} officeName={officeName} onClose={() => setActive(null)} />}
    </div>
  );
}
