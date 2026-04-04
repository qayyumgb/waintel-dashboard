"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    status,
    loading: status === "loading",
    botId: (session as any)?.botId as string | undefined,
    tenantId: (session as any)?.tenantId as string | undefined,
    plan: (session as any)?.plan as string | undefined,
    userName: session?.user?.name || "",
    userEmail: session?.user?.email || "",
  };
}
