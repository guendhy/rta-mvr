"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RectangleHorizontal } from "lucide-react";
import { plateService } from "@/services/plate.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { friendlyError } from "@/lib/errors";
import { Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Section } from "@/components/ui/layout-bits";
import type { RegistrationDetail } from "@/services/interfaces";

/** Assign an available plate to an approved registration (spec §39). */
export function PlateAssignInline({ detail }: { detail: RegistrationDetail }) {
  const { can } = useDemoUser();
  const app = detail.application;
  const [allOffices, setAllOffices] = useState(false);
  const { data: plates, reload } = useServiceQuery(() => plateService.listAvailable(allOffices ? undefined : app.officeId), [allOffices, app.officeId]);
  const [plateId, setPlateId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plate = plates?.find((p) => p.id === plateId);

  if (!can("plates.assign")) {
    return <Alert tone="info" title="Waiting for plate assignment">A Plate Officer assigns the number plate. Switch roles in Demo Tools or open <Link href="/plates?tab=assign">Plate Assignment</Link>.</Alert>;
  }

  return (
    <Section title="Assign number plate" description="Only available plates are listed. A plate can never be assigned twice.">
      {error && (
        <Alert tone="bad" title={error} action={<button type="button" className="btn btn-s btn-sm" onClick={() => { setError(null); setPlateId(""); reload(); }}>Pick another plate</button>}>
          Refresh the list and choose a different plate.
        </Alert>
      )}
      {plates && plates.length === 0 ? (
        <EmptyState title="No Plates" message="No available motorcycle plates were found." action={!allOffices ? { label: "Show all offices", onClick: () => setAllOffices(true) } : { label: "Receive plates", href: "/plates" }} icon={<RectangleHorizontal size={36} />} />
      ) : (
        <div className="row items-end">
          <div className="min-w-[220px] flex-1">
            <label className="lbl" htmlFor="plate-pick">Available plate</label>
            <Select id="plate-pick" value={plateId} onChange={(e) => setPlateId(e.target.value)} placeholder={plates ? `Select from ${plates.length} available` : "Loading…"} options={(plates ?? []).map((p) => ({ value: p.id, label: p.plateNumber }))} />
          </div>
          <label className="row min-h-[44px] gap-2 text-[13.5px]"><input type="checkbox" className="chk" checked={allOffices} onChange={(e) => { setAllOffices(e.target.checked); setPlateId(""); }} />All offices</label>
          <button type="button" className="btn btn-p btn-lg" disabled={!plateId || busy} onClick={() => setConfirm(true)}>Assign Plate</button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={busy}
        tone="success"
        title="Assign plate?"
        confirmLabel="Assign Plate"
        message={<>Assign <strong className="mono">{plate?.plateNumber}</strong> to {app.registrationNumber}? The plate, motorcycle and registration are updated and the registration is completed.</>}
        onConfirm={async () => {
          setBusy(true);
          try {
            await plateService.assign(plateId, app.id);
            toast.success(`Plate ${plate?.plateNumber} assigned`, { description: "Motorcycle registered successfully." });
            setConfirm(false);
          } catch (e) {
            setError(friendlyError(e));
            setConfirm(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Section>
  );
}
