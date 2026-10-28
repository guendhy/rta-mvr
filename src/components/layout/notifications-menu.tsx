"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { formatRelative } from "@/lib/formatting";
import { notificationService } from "@/services/notification.service";
import type { NotificationSeverity } from "@/types";

const DOT: Record<NotificationSeverity, string> = { info: "#1515e8", success: "#137a3b", warning: "#c25a00", danger: "#c4141b" };

export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useServiceQuery(() => notificationService.list(), []);
  const unread = (data ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications, ${unread} unread`} className="relative grid h-11 w-11 place-items-center rounded-lg text-white hover:bg-[#1c1d24]">
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && <span className="absolute top-1.5 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ed1c24] px-1 text-[10.5px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="fixed top-[68px] right-2 left-2 z-[60] overflow-hidden rounded-xl border border-[#e1e4ea] bg-white text-[#0b0b0f] shadow-2xl sm:absolute sm:top-12 sm:right-0 sm:left-auto sm:w-[400px]" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-[#e1e4ea] px-4 py-3">
            <p className="h3">Notifications</p>
            <button type="button" className="btn btn-g btn-sm" disabled={!unread} onClick={() => notificationService.markAllRead()}>
              <CheckCheck size={16} aria-hidden="true" />Mark all read
            </button>
          </div>
          <ul className="m-0 max-h-[60vh] list-none overflow-y-auto p-0">
            {(data ?? []).length === 0 && <li className="mut p-4 text-[13px]">No notifications.</li>}
            {(data ?? []).slice(0, 30).map((n) => (
              <li key={n.id} className={`border-b border-[#edeff3] last:border-0 ${n.read ? "" : "bg-[#f7f7ff]"}`}>
                <div className="flex gap-3 px-4 py-3">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: DOT[n.severity] }} aria-hidden="true" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      notificationService.markRead(n.id);
                      setOpen(false);
                      if (n.link) router.push(n.link);
                    }}
                  >
                    <span className="block text-[13.5px] font-semibold">{n.title}{!n.read && <span className="sr"> (unread)</span>}</span>
                    <span className="mut block text-[12.5px] leading-snug">{n.message}</span>
                    <span className="mut mt-1 block text-[11.5px]">{formatRelative(n.createdAt)}</span>
                  </button>
                  {!n.read && (
                    <button type="button" className="btn btn-g btn-sm flex-none self-start" onClick={() => notificationService.markRead(n.id)}>Mark read</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
