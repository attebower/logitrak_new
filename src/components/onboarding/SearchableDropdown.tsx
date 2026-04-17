"use client";

/**
 * SearchableDropdown — filterable single-select dropdown.
 * Used for Department, Production Type, Studio/Venue selection in onboarding.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface SearchableDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  id,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative" id={id}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          "w-full flex items-center justify-between gap-2",
          "bg-grey-light border border-grey-mid rounded-btn px-3 py-2",
          "text-[13px] text-left transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue",
          value ? "text-surface-dark" : "text-grey",
        ].join(" ")}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-grey transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-grey-mid rounded-btn shadow-lg max-h-[240px] flex flex-col">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-grey-mid">
            <Search size={13} className="text-grey shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 text-[13px] text-surface-dark bg-transparent outline-none placeholder:text-grey/50"
            />
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-grey">No results found</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={[
                    "w-full text-left px-3 py-2 text-[13px] transition-colors",
                    option === value
                      ? "bg-brand-blue-light text-brand-blue font-medium"
                      : "text-surface-dark hover:bg-grey-light",
                  ].join(" ")}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
