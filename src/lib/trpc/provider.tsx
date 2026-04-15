"use client";

/**
 * tRPC + React Query provider.
 * Wrap the app shell layout with this once Sage's tRPC server is live.
 *
 * Add to src/app/(app)/layout.tsx:
 *   import { TRPCProvider } from "@/lib/trpc/provider";
 *   return <TRPCProvider>...</TRPCProvider>
 *
 * TODO Sprint 2 (Sage): replace `any` cast with:
 *   import type { AppRouter } from "@/server/routers/_app";
 *   and update client.ts to use AppRouter
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

// Deferred import — avoids tsc errors until AppRouter type exists
// When Sage delivers the router, swap this for:
//   import { trpc } from "./client";
// and add the AppRouter generic.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trpc } = require("./client") as { trpc: any };

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
