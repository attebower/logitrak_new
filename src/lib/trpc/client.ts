/**
 * tRPC client — browser-side.
 *
 * Usage in Client Components:
 *   import { trpc } from "@/lib/trpc/client";
 *   const { data } = trpc.equipment.list.useQuery({ workspaceId });
 *
 * TODO Sprint 2 (Sage): once routers are live, import AppRouter type from
 * the server and replace `any` with the real router type:
 *   import type { AppRouter } from "@/server/routers/_app";
 *   export const trpc = createTRPCReact<AppRouter>();
 */

import { createTRPCReact } from "@trpc/react-query";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();
