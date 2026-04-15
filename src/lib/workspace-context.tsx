"use client";

/**
 * WorkspaceContext — provides the active workspaceId to all client components.
 *
 * The Server Component layout fetches the user's workspaces via Prisma directly
 * (no tRPC round-trip needed at layout level) and passes the active workspace
 * down as a prop into this provider.
 *
 * Usage in client components:
 *   const { workspaceId, workspaceName } = useWorkspace();
 */

import { createContext, useContext } from "react";

export interface WorkspaceContextValue {
  workspaceId: string;
  workspaceName: string;
  userRole: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceContextValue;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return ctx;
}
