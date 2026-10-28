"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useServiceQuery } from "@/hooks/use-service";
import { plateService } from "@/services/plate.service";
import { PageHeader, Tabs } from "@/components/ui/layout-bits";
import { PageSkeleton } from "@/components/ui/feedback";
import { PlateInventory } from "@/components/plates/plate-inventory";
import { PlateAssign } from "@/components/plates/plate-assign";

type Tab = "inventory" | "assign";

function PlatesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = params.get("tab") === "assign" ? "assign" : "inventory";
  const queue = useServiceQuery(() => plateService.awaitingAssignment(), []);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params.toString());
    if (t === "inventory") next.delete("tab");
    else next.set("tab", t);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Plates" title={tab === "assign" ? "Plate Assignment" : "Plate Inventory"} description={tab === "assign" ? "Assign an available plate to each approved transaction. Only plates from the category that matches the vehicle's type and use are offered." : "Number plate stock by plate category across RTA offices."} />
      <Tabs<Tab>
        label="Plate sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "inventory", label: "Inventory" },
          { value: "assign", label: "Assign Plates", count: queue.data?.length },
        ]}
      />
      <div role="tabpanel" aria-label={tab === "assign" ? "Assign Plates" : "Inventory"}>
        {tab === "assign" ? <PlateAssign /> : <PlateInventory />}
      </div>
    </div>
  );
}

export default function PlatesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatesContent />
    </Suspense>
  );
}
