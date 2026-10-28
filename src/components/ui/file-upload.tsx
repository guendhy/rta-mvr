"use client";

import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { FileMeta } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024;

export function toFileMeta(file: File): FileMeta {
  return { name: file.name, size: file.size, type: file.type || "application/octet-stream", uploadedAt: new Date().toISOString() };
}

/**
 * Local-only file picker: nothing is uploaded. Returns the File so callers can
 * show an object-URL preview, plus metadata to persist.
 */
export function FileDrop({ onFile, accept = "image/*,application/pdf", label = "Drop file or browse", hint = "PDF, JPG or PNG · max 10 MB · camera capture on tablets", compact }: { onFile: (file: File, meta: FileMeta) => void; accept?: string; label?: string; hint?: string; compact?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (f?: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("File is larger than 10 MB.");
      return;
    }
    setError(null);
    onFile(f, toFileMeta(f));
  };

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
        className={`flex cursor-pointer flex-wrap items-center gap-3.5 rounded-[10px] border-2 border-dashed ${drag ? "border-[#1515e8] bg-[#f5f5ff]" : "border-[#c9ced8]"} ${compact ? "p-3" : "p-[18px]"}`}
      >
        <Upload size={compact ? 20 : 26} className="text-[#1515e8]" aria-hidden="true" />
        <span className="min-w-[150px] flex-1">
          <span className="block text-[14px] font-semibold">{label.includes("browse") ? <>{label.replace("browse", "")}<span className="text-[#1515e8] underline">browse</span></> : label}</span>
          {!compact && <span className="help mt-0.5 block">{hint}</span>}
        </span>
        <input ref={ref} id={id} type="file" accept={accept} capture={accept.startsWith("image") ? "environment" : undefined} className="sr" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
