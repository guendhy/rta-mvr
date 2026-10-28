"use client";

import { forwardRef, useId } from "react";

/** Label + control + help/error, wired for screen readers. */
export function Field({
  label,
  required,
  error,
  help,
  children,
  className = "",
  htmlFor,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: React.ReactNode;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }> | React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      <label className="lbl" htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? <p className="err" role="alert">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; mono?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, mono, className = "", ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={`inp ${mono ? "mono" : ""} ${invalid ? "inp-err" : ""} ${className}`} {...rest} />;
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; options: (string | { value: string; label: string })[]; placeholder?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, options, placeholder, className = "", ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={`inp ${invalid ? "inp-err" : ""} ${className}`} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className = "", ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={`inp ${invalid ? "inp-err" : ""} ${className}`} {...rest} />;
});

/** Field helper that generates the id for you. */
export function useFieldId(prefix = "f") {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-[44px] cursor-pointer items-start justify-between gap-4 py-2 ${disabled ? "opacity-60" : ""}`}>
      <span>
        <span className="block text-[14px] font-semibold">{label}</span>
        {description && <span className="help mt-0.5 block">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex flex-none">
        <input id={id} type="checkbox" role="switch" className="peer sr" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-[#c9ced8] transition-colors peer-checked:bg-[#1515e8] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-[#b9b9fa]" aria-hidden="true" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" aria-hidden="true" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? "on" : ""} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
