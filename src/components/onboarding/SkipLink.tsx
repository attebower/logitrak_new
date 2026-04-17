"use client";

/**
 * SkipLink — styled skip text link for skippable onboarding stages.
 * Positioned below the CTA, not a button.
 */

interface SkipLinkProps {
  onClick: () => void;
  children: React.ReactNode;
}

export function SkipLink({ onClick, children }: SkipLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[14px] text-grey hover:text-surface-dark hover:underline transition-colors"
    >
      {children}
    </button>
  );
}
