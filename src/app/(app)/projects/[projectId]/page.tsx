"use client";

/**
 * Project detail is now handled inline by the Projects sidebar layout.
 * This route redirects to /projects so the sidebar can take over.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProjectDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/projects");
  }, [router]);
  return null;
}
