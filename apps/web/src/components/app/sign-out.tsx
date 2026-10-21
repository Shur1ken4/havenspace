"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { isAppWindow } from "@/lib/app-window";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("nav");
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={async () => { await authClient.signOut(); router.push(isAppWindow() ? "/login" : "/"); }}>
      {t("signOut")}
    </Button>
  );
}
