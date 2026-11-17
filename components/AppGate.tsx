"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { normalizePath } from "@/lib/basePath";
import { getSetting } from "@/lib/db";

/** Sends first-time users to onboarding, and onboarded users away from it. */
export default function AppGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onboarded = useLiveQuery(
    async () => (await getSetting<boolean>("onboarding_done")) === true,
  );

  const onWelcome = normalizePath(pathname) === "/welcome";
  const redirectTo =
    onboarded === undefined
      ? null
      : !onboarded && !onWelcome
        ? "/welcome"
        : onboarded && onWelcome
          ? "/"
          : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (onboarded === undefined || redirectTo) return null;
  return <>{children}</>;
}
