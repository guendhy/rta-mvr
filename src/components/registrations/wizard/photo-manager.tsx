"use client";

import { useState } from "react";
import { Camera, Eye, RefreshCw, Trash2 } from "lucide-react";
import { PHOTO_SLOTS } from "@/lib/constants";
import { formatBytes } from "@/lib/formatting";
import { previewStore } from "@/lib/preview-store";
import { toFileMeta } from "@/components/ui/file-upload";
import { Modal } from "@/components/ui/modal";
import type { FileMeta, PhotoSlot } from "@/types";

/** Vehicle photo slots (engine-number slot only for vehicles with an engine). Images stay in the browser (object URLs); only metadata is saved. */
export function PhotoManager({ scope, photos, onChange, readOnly, hasEngine = true }: { scope: string; photos: Partial<Record<PhotoSlot, FileMeta>>; onChange: (p: Partial<Record<PhotoSlot, FileMeta>>) => void; readOnly?: boolean; hasEngine?: boolean }) {
  const [preview, setPreview] = useState<{ slot: PhotoSlot; url: string | null } | null>(null);
  const [, force] = useState(0);
  const key = (s: PhotoSlot) => `${scope}:photo:${s}`;

  const pick = (slot: PhotoSlot, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    previewStore.set(key(slot), file);
    onChange({ ...photos, [slot]: toFileMeta(file) });
    force((n) => n + 1);
  };

  return (
    <div className="g3">
      {PHOTO_SLOTS.filter((p) => hasEngine || !p.engineOnly).map(({ slot, label }) => {
        const meta = photos[slot];
        const local = previewStore.get(key(slot));
        const inputId = `${scope}-${slot}`;
        return (
          <div key={slot} className="flex flex-col gap-2 rounded-[10px] border border-[#e1e4ea] p-3">
            <div className="flex items-center justify-between">
              <p className="m-0 text-[13px] font-semibold">{label}</p>
              {meta ? <span className="badge s-ok">Added</span> : <span className="badge s-draft">Missing</span>}
            </div>
            <div className="grid h-28 place-items-center overflow-hidden rounded-md bg-[#f4f5f8]">
              {local ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={local.url} alt={`${label} photo preview`} className="h-full w-full object-cover" />
              ) : meta ? (
                <span className="mut px-3 text-center text-[12px]">{meta.name}<br />Preview available in this session only</span>
              ) : (
                <Camera size={28} className="text-[#aeb3bd]" aria-hidden="true" />
              )}
            </div>
            {meta && <p className="mut m-0 truncate text-[11.5px]">{meta.name} · {formatBytes(meta.size)}</p>}
            {!readOnly && (
              <div className="flex flex-wrap gap-1.5">
                <label htmlFor={inputId} className="btn btn-s btn-sm cursor-pointer">
                  {meta ? <RefreshCw size={14} aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}{meta ? "Replace" : "Add photo"}
                </label>
                <input id={inputId} type="file" accept="image/*" capture="environment" className="sr" onChange={(e) => { pick(slot, e.target.files?.[0]); e.target.value = ""; }} />
                {meta && <button type="button" className="btn btn-g btn-sm" onClick={() => setPreview({ slot, url: local?.url ?? null })}><Eye size={14} aria-hidden="true" />Preview</button>}
                {meta && (
                  <button type="button" className="btn btn-g btn-sm !text-[#a3111a]" onClick={() => {
                    previewStore.remove(key(slot));
                    const next = { ...photos };
                    delete next[slot];
                    onChange(next);
                  }}><Trash2 size={14} aria-hidden="true" />Remove</button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Photo — ${PHOTO_SLOTS.find((p) => p.slot === preview?.slot)?.label ?? ""}`} size="lg">
        {preview?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Vehicle photo" className="max-h-[70vh] w-full rounded-md object-contain" />
        ) : (
          <p className="mut text-[14px]">Preview is not available after a page refresh — this prototype keeps images only in the current browser session. The file details are saved.</p>
        )}
      </Modal>
    </div>
  );
}
