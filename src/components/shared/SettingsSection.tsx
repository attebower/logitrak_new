/**
 * LogiTrak SettingsSection Component
 * Reusable section wrapper for the Settings page.
 *
 * Layout: title + description on the left (1/3), content slot on the right (2/3).
 * Matches the standard two-column settings layout used by Vercel, Linear, etc.
 *
 * Usage:
 *   <SettingsSection
 *     title="Workspace"
 *     description="Your workspace name and department are shown to all team members."
 *   >
 *     <WorkspaceNameForm />
 *   </SettingsSection>
 *
 *   // Danger zone variant
 *   <SettingsSection
 *     title="Delete workspace"
 *     description="Permanently delete this workspace and all its data. This cannot be undone."
 *     variant="danger"
 *   >
 *     <DeleteWorkspaceButton />
 *   </SettingsSection>
 */

import { cn } from "@/lib/utils";

export type SettingsSectionVariant = "default" | "danger";

export interface SettingsSectionProps {
  title:       string;
  description?: string;
  variant?:    SettingsSectionVariant;
  children:    React.ReactNode;
  /** Optional — show a Save/action button aligned with the section title */
  action?:     React.ReactNode;
  className?:  string;
}

export function SettingsSection({
  title,
  description,
  variant = "default",
  children,
  action,
  className,
}: SettingsSectionProps) {
  const isDanger = variant === "danger";

  return (
    <section
      className={cn(
        "py-8 border-b border-grey-mid last:border-b-0",
        isDanger && "border-l-4 border-l-status-red pl-4",
        className
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
        {/* Left — title + description */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "text-[15px] font-semibold",
                isDanger ? "text-status-red" : "text-surface-dark"
              )}
            >
              {title}
            </h3>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {description && (
            <p className="text-[13px] text-grey mt-1.5 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Right — content */}
        <div className="md:col-span-2">
          {children}
        </div>
      </div>
    </section>
  );
}

// ── Settings page wrapper ─────────────────────────────────────────────────

/**
 * Wrap all SettingsSection components in SettingsPage for consistent padding.
 *
 * Usage:
 *   <SettingsPage title="General">
 *     <SettingsSection ... />
 *     <SettingsSection ... />
 *   </SettingsPage>
 */
export function SettingsPage({
  title,
  children,
}: {
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-heading text-surface-dark mb-8">{title}</h1>
      <div>{children}</div>
    </div>
  );
}

// ── Settings form field ───────────────────────────────────────────────────

/**
 * Standard form field for use inside SettingsSection.
 * Applies consistent label + input + optional hint text.
 *
 * Usage:
 *   <SettingsField label="Workspace name" hint="Visible to all team members.">
 *     <input ... />
 *   </SettingsField>
 */
export function SettingsField({
  label,
  hint,
  children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <label className="block text-caption text-grey uppercase mb-1.5">{label}</label>
      {children}
      {hint && (
        <p className="text-[11px] text-grey mt-1.5">{hint}</p>
      )}
    </div>
  );
}
