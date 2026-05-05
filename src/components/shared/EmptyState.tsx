/**
 * EmptyState — reusable "nothing here yet" panel for list pages.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Users className="h-8 w-8" />}
 *     title="No team members yet"
 *     description="Invite your first crew member to get started."
 *     action={<Button onClick={…}>Invite member</Button>}
 *   />
 */

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Optional Lucide / SVG icon. Renders centred above the title. */
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  /** Optional CTA — typically a <Button>. */
  action?:      React.ReactNode;
  className?:   string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-12", className)}>
      {icon && (
        <div className="h-12 w-12 rounded-full bg-grey-light flex items-center justify-center text-grey mb-3">
          {icon}
        </div>
      )}
      <p className="text-[14px] font-semibold text-surface-dark mb-1">{title}</p>
      {description && <p className="text-[12px] text-grey max-w-sm mb-4">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
