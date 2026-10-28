"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { searchService } from "@/services/search.service";
import type { SearchResultGroup } from "@/services/interfaces";

/** Header search with debounce and grouped results. Press "/" to focus. */
export function GlobalSearch({ dark = true, autoFocus, onDone }: { dark?: boolean; autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(q, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setGroups([]);
      return;
    }
    setLoading(true);
    searchService.search(debounced).then((r) => {
      if (!cancelled) {
        setGroups(r);
        setActive(0);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    onDone?.();
    router.push(href);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <label htmlFor="gsearch" className="sr">Search registrations, plates, VIN, owners, receipts</label>
      <div className={`flex h-10 items-center gap-2.5 rounded-lg px-3 ${dark ? "border border-[#2e303a] bg-[#1c1d24]" : "border border-[#c9ced8] bg-white"}`}>
        <Search size={16} className="flex-none text-[#9ea2ae]" aria-hidden="true" />
        <input
          ref={inputRef}
          id="gsearch"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open && q.length >= 2}
          aria-controls="gsearch-results"
          aria-autocomplete="list"
          autoComplete="off"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && flat[active]) go(flat[active].href);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Plate, registration, VIN, engine, owner, receipt…"
          className={`min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-none ${dark ? "text-white placeholder:text-[#9ea2ae]" : "text-[#0b0b0f]"}`}
        />
        {loading ? <span className="spin text-[#9ea2ae]" aria-hidden="true" /> : <span className="mono hidden rounded border border-[#3a3d48] px-1.5 py-0.5 text-[11px] text-[#9ea2ae] sm:inline">/</span>}
      </div>
      {open && q.trim().length >= 2 && (
        <div id="gsearch-results" role="listbox" className="absolute top-12 right-0 left-0 z-[60] max-h-[70vh] overflow-y-auto rounded-xl border border-[#e1e4ea] bg-white text-[#0b0b0f] shadow-2xl">
          {!loading && groups.length === 0 && <p className="mut m-0 p-4 text-[13px]">No matches for “{q}”.</p>}
          {groups.map((g) => (
            <div key={g.group} className="border-b border-[#edeff3] py-1.5 last:border-0">
              <p className="eb px-4 py-1.5 text-[10.5px]">{g.group}</p>
              {g.items.map((it) => {
                const idx = flat.indexOf(it);
                return (
                  <button
                    key={`${g.group}-${it.id}`}
                    type="button"
                    role="option"
                    aria-selected={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(it.href)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left ${idx === active ? "bg-[#eeeefe]" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="mono block truncate text-[13px] font-semibold">{it.title}</span>
                      <span className="mut block truncate text-[12px]">{it.subtitle}</span>
                    </span>
                    {it.badge && <span className="badge s-draft flex-none capitalize">{it.badge.replace(/_/g, " ")}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
