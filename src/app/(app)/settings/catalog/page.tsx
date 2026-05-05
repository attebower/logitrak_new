"use client";

/**
 * Settings → Equipment → Product Catalog
 *
 * View + search the shared product catalog for this account.
 * Products are created via /equipment/new but can be reviewed here.
 */

import { useState } from "react";
import { SettingsPageShell, SettingsSection } from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

export default function SettingsCatalogPage() {
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState("");

  const { data: products } = trpc.product.search.useQuery({
    workspaceId,
    query: search,
    limit: 100,
  });

  return (
    <SettingsPageShell
      title="Product Catalog"
      description="Your shared product library. New products are added automatically when you enter new equipment."
    >
      <SettingsSection
        title={`Products (${products?.length ?? 0})`}
        description="Every product name, category, and description that your account has saved."
      >
        <input
          type="search"
          placeholder="Search catalog…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue mb-4"
        />

        {(!products || products.length === 0) ? (
          <p className="text-[13px] text-grey py-6 text-center">
            {search.trim() ? `No products match "${search}".` : "No products yet. Add your first one via Equipment → + New Entry."}
          </p>
        ) : (
          <div className="border border-grey-mid rounded-card overflow-hidden divide-y divide-grey-mid">
            {products.map((p) => (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-surface-dark">{p.name}</div>
                    <div className="text-[11px] text-grey mt-0.5">
                      {p.category?.name ?? "Uncategorised"}
                    </div>
                  </div>
                </div>
                {p.description && (
                  <p className="text-[12px] text-grey mt-2 leading-relaxed">{p.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </SettingsPageShell>
  );
}
