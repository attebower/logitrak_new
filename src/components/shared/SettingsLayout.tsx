/**
 * Shared settings layout primitives.
 *
 * Use SettingsPageShell on every /settings/* route for consistent
 * header + padding + max-width. Inside, compose SettingsSection blocks.
 */

import { cn } from "@/lib/utils";

export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title:       string;
  description?: string;
  children:    React.ReactNode;
}) {
  return (
    <div className="max-w-3xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-surface-dark">{title}</h1>
        {description && (
          <p className="text-[13px] text-grey mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export type SettingsSectionVariant = "default" | "danger";

export interface SettingsSectionProps {
  title:        string;
  description?: string;
  variant?:     SettingsSectionVariant;
  children:     React.ReactNode;
  action?:      React.ReactNode;
  className?:   string;
}

export function SettingsSection({
  title, description, variant = "default", children, action, className,
}: SettingsSectionProps) {
  const isDanger = variant === "danger";
  return (
    <section
      className={cn(
        "bg-white rounded-card border border-grey-mid p-6 mb-4",
        isDanger && "border-status-red/30",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className={cn("text-[15px] font-semibold", isDanger ? "text-status-red" : "text-surface-dark")}>
            {title}
          </h3>
          {description && <p className="text-[12px] text-grey mt-1">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function SettingsField({
  label, hint, children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-[11px] font-semibold text-grey uppercase tracking-wide mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-grey mt-1">{hint}</p>}
    </div>
  );
}
