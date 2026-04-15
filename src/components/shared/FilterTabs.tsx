/**
 * LogiTrak FilterTabs Component
 *
 * Horizontal tab strip for filtering lists by status or category.
 * Used on the Equipment Registry and Damage Reports pages.
 * Supports optional count badges on each tab.
 *
 * Usage:
 *   <FilterTabs
 *     options={[
 *       { label: "All",         value: "all" },
 *       { label: "Available",   value: "available",   count: 24 },
 *       { label: "Checked Out", value: "checked-out", count: 8  },
 *       { label: "Damaged",     value: "damaged",     count: 3  },
 *     ]}
 *     value={filter}
 *     onChange={setFilter}
 *   />
 */

export interface FilterTabOption<T extends string = string> {
  /** Display label for the tab */
  label: string;
  /** Value emitted when this tab is selected */
  value: T;
  /** Optional count badge — shown as a pill inside the tab */
  count?: number;
}

export interface FilterTabsProps<T extends string = string> {
  options:    FilterTabOption<T>[];
  value:      T;
  onChange:   (value: T) => void;
  className?: string;
}

export function FilterTabs<T extends string = string>({
  options,
  value,
  onChange,
  className = "",
}: FilterTabsProps<T>) {
  return (
    <div role="tablist" aria-label="Filter" className={`flex gap-1 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[11px] font-semibold transition-colors",
              active
                ? "bg-brand-blue text-white"
                : "bg-grey-light text-grey hover:bg-grey-mid",
            ].join(" ")}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-px leading-none ${
                  active ? "bg-white/20 text-white" : "bg-grey-mid text-grey"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
