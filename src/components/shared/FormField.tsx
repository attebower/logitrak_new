/**
 * LogiTrak FormField Components
 *
 * Consistent form field wrappers: FormField, FormInput, FormSelect, FormTextarea.
 *
 * Eliminates the repeated inline class string that appears across the Equipment
 * add form, Damage report form, Onboarding page, and anywhere else form fields
 * are used. All fields share the same base styles, label convention, error state,
 * and accessibility attributes.
 *
 * Shared base:
 *   bg-grey-light border border-grey-mid rounded-btn px-3 py-2
 *   text-[13px] text-surface-dark
 *   focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue
 *
 * Usage:
 *   // Self-contained input (label + field in one component):
 *   <FormInput
 *     label="Serial Number"
 *     required
 *     placeholder="e.g. SP-009"
 *     value={serial}
 *     onChange={(e) => setSerial(e.target.value.toUpperCase())}
 *   />
 *
 *   // Select:
 *   <FormSelect label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
 *     <option value="Minor">Minor</option>
 *     <option value="Moderate">Moderate</option>
 *     <option value="Severe">Severe</option>
 *   </FormSelect>
 *
 *   // Textarea:
 *   <FormTextarea label="Description" required rows={3} value={desc} onChange={...} />
 *
 *   // Custom child (use FormField wrapper directly):
 *   <FormField label="Location" hint="Where the item lives when not in use">
 *     <LocationPicker ... />
 *   </FormField>
 */

import { forwardRef } from "react";

// ── Shared input class string ─────────────────────────────────────────────

const inputBase =
  "w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 " +
  "text-[13px] text-surface-dark transition-colors " +
  "placeholder:text-grey/50 " +
  "focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-status-red aria-[invalid=true]:ring-status-red/30";

// ── FormField (wrapper only) ───────────────────────────────────────────────

export interface FormFieldProps {
  label:     string;
  /** Shows a red asterisk after the label */
  required?: boolean;
  /** Hint text shown below the field */
  hint?:     string;
  /** Error message — shown in red, replaces hint */
  error?:    string;
  children:  React.ReactNode;
  className?: string;
}

/**
 * Label + optional hint/error wrapper.
 * Use this when you need to wrap a non-standard field (e.g. LocationPicker, custom select).
 */
export function FormField({ label, required, hint, error, children, className = "" }: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-caption text-grey uppercase tracking-[0.05rem]">
        {label}
        {required && (
          <span className="text-status-red ml-0.5 normal-case" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {!error && hint && (
        <p className="text-[11px] text-grey">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

// ── FormInput ─────────────────────────────────────────────────────────────

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:      string;
  required?:  boolean;
  hint?:      string;
  error?:     string;
  /** Extra className applied to the outer FormField wrapper */
  wrapClass?: string;
}

/**
 * Single-line text input with label, optional hint, and error state.
 * Forwards ref to the underlying <input>.
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, required, hint, error, wrapClass = "", className = "", ...props }, ref) => (
    <FormField label={label} required={required} hint={hint} error={error} className={wrapClass}>
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={`${inputBase} ${className}`}
        {...props}
      />
    </FormField>
  )
);
FormInput.displayName = "FormInput";

// ── FormSelect ────────────────────────────────────────────────────────────

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:      string;
  required?:  boolean;
  hint?:      string;
  error?:     string;
  wrapClass?: string;
  children:   React.ReactNode;
}

/**
 * Styled <select> with label, optional hint, and error state.
 * Forwards ref to the underlying <select>.
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, required, hint, error, wrapClass = "", className = "", children, ...props }, ref) => (
    <FormField label={label} required={required} hint={hint} error={error} className={wrapClass}>
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={`${inputBase} bg-white appearance-none ${className}`}
        {...props}
      >
        {children}
      </select>
    </FormField>
  )
);
FormSelect.displayName = "FormSelect";

// ── FormTextarea ──────────────────────────────────────────────────────────

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label:      string;
  required?:  boolean;
  hint?:      string;
  error?:     string;
  wrapClass?: string;
}

/**
 * Multi-line textarea with label, optional hint, and error state.
 * Forwards ref to the underlying <textarea>.
 * resize is disabled by default — on-set environments don't need manual resize.
 */
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, required, hint, error, wrapClass = "", className = "", ...props }, ref) => (
    <FormField label={label} required={required} hint={hint} error={error} className={wrapClass}>
      <textarea
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={`${inputBase} resize-none ${className}`}
        {...props}
      />
    </FormField>
  )
);
FormTextarea.displayName = "FormTextarea";
