/**
 * LogiTrak Button Component
 * Extends shadcn/ui Button with brand-specific variants.
 *
 * Usage: <Button variant="primary">Confirm Check Out</Button>
 * Drop this file into components/ui/button.tsx to replace the shadcn default.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — matches spec font style, rounded, cursor
  "inline-flex items-center justify-center whitespace-nowrap rounded-btn text-[12px] font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /**
         * Primary — Brand Blue
         * Spec: background #1B4FD8, white text
         * Use for: main CTAs (Confirm Check Out, Add Equipment, Save)
         */
        primary:
          "bg-brand-blue text-white hover:bg-brand-blue-hover active:scale-[0.98]",

        /**
         * Secondary — Grey
         * Spec: background #E2E8F0, dark text
         * Use for: supporting actions (Import CSV, QR Labels, View, Cancel)
         */
        secondary:
          "bg-grey-mid text-surface-dark hover:bg-slate-200 active:scale-[0.98]",

        /**
         * Destructive — Red
         * Spec: red background, white text
         * Use for: delete, remove, irreversible actions
         * Note: spec's dark-panel showcase uses #7F1D1D bg — in the light app use full red.
         */
        destructive:
          "bg-status-red text-white hover:bg-red-700 active:scale-[0.98]",

        /**
         * Ghost — no background
         * Use for: icon-only buttons, nav actions, low-emphasis actions
         */
        ghost:
          "hover:bg-grey-light hover:text-surface-dark",

        /**
         * Link — text only
         */
        link:
          "text-brand-blue underline-offset-4 hover:underline",

        // ── shadcn defaults kept for compat ─────────────────────────
        default:
          "bg-brand-blue text-white hover:bg-brand-blue-hover",

        outline:
          "border border-grey-mid bg-white hover:bg-grey-light text-surface-dark",
      },

      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-7 rounded px-2.5 py-1.5 text-[11px]",   // btn-sm from spec: padding 5px 10px
        lg:      "h-11 rounded-[8px] px-6 text-[14px]",     // confirm CTA: padding 11px
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size:    "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
