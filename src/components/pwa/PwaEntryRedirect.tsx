"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type PwaEntryRedirectProps = {
  children?: ReactNode;
};

export function PwaEntryRedirect({ children }: PwaEntryRedirectProps) {
  const router = useRouter();
  const { status } = useSession();
  const [standalone, setStandalone] = useState<boolean | null>(null);

  useEffect(() => {
    setStandalone(isStandalonePwa());
  }, []);

  useEffect(() => {
    if (standalone !== true) return;
    if (status === "loading") return;

    router.replace(status === "authenticated" ? "/dashboard" : "/auth");
  }, [router, standalone, status]);

  if (standalone !== false) return null;

  return <>{children}</>;
}
