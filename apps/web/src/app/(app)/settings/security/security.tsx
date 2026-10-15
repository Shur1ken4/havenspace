"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { KeyRound, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { disableTwoFactor, signOutEverywhere } from "../actions";

type Passkey = { id: string; name?: string | null; createdAt?: string };

export function Security({ twoFactorOn }: { twoFactorOn: boolean }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ qr: string; secret: string; backup: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  async function loadPasskeys() {
    const res = await authClient.$fetch<Passkey[]>("/passkey/list-user-passkeys", { method: "GET" });
    setPasskeys(res.data ?? []);
  }
  useEffect(() => { loadPasskeys(); }, []);

  async function addPasskey() {
    setError(null);
    const res = await authClient.passkey.addPasskey({ name: navigator.platform || "Passkey" });
    if (res?.error) setError(tc("somethingWrong"));
    await loadPasskeys();
  }

  async function enable2fa() {
    setError(null);
    const res = await authClient.twoFactor.enable({});
    if (res.error || !res.data || !("totpURI" in res.data)) { setError(tc("somethingWrong")); return; }
    const uri = res.data.totpURI;
    const secret = new URL(uri).searchParams.get("secret") ?? "";
    setSetup({ qr: await QRCode.toString(uri, { type: "svg", margin: 1 }), secret, backup: res.data.backupCodes });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const res = await authClient.twoFactor.verifyTotp({ code });
    if (res.error) { setError(t("invalidCode")); return; }
    // Turning 2FA on starts a fresh session, which then needs a code once.
    router.push("/login/verify?enabled=1&next=/settings/security");
  }

  async function turnOff(e: React.FormEvent) {
    e.preventDefault();
    const res = await disableTwoFactor(code);
    if (res.error) { setError(res.error === "locked" ? t("tooManyAttempts") : t("invalidCode")); return; }
    setDisabling(false);
    setCode("");
    router.refresh();
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card className="space-y-4">
        <h2 className="flex items-center gap-2 text-2xl"><KeyRound size={20} aria-hidden /> {t("passkeys")}</h2>
        <p className="text-muted">{t("passkeysBody")}</p>
        {passkeys.length === 0 ? <p className="text-sm text-muted">{t("noPasskeys")}</p> : (
          <ul className="divide-y divide-line">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.name || "Passkey"}</span>
                <Button variant="ghost" size="sm" onClick={async () => { await authClient.passkey.deletePasskey({ id: p.id }); loadPasskeys(); }}>{tc("delete")}</Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" onClick={addPasskey}>{t("addPasskey")}</Button>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl"><ShieldCheck size={20} aria-hidden /> {t("twoFactor")}</h2>
          <Chip tone={twoFactorOn ? "sage" : "plain"}>{twoFactorOn ? t("twoFactorOn") : t("twoFactorOff")}</Chip>
        </div>
        <p className="text-muted">{t("twoFactorBody")}</p>
        {setup ? (
          <div className="space-y-4">
            <p>{t("twoFactorScan")}</p>
            <div className="h-44 w-44 rounded-[12px] bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.qr }} />
            <p className="break-all font-mono text-sm text-muted">{setup.secret}</p>
            <Notice tone="info" title={t("twoFactorBackup")}>
              <p className="font-mono text-sm">{setup.backup.join("  ")}</p>
            </Notice>
            <form onSubmit={verify} className="flex gap-2">
              <Input className="max-w-40" inputMode="numeric" autoComplete="one-time-code" aria-label={t("twoFactorCodeLabel")} value={code} onChange={(e) => setCode(e.target.value)} />
              <Button type="submit">{t("verify")}</Button>
            </form>
          </div>
        ) : twoFactorOn ? (
          disabling ? (
            <form onSubmit={turnOff} className="space-y-2">
              <p className="text-sm text-muted">{t("twoFactorDisableHint")}</p>
              <div className="flex gap-2">
                <Input className="max-w-40" inputMode="numeric" autoComplete="one-time-code" aria-label={t("twoFactorCodeLabel")} value={code} onChange={(e) => setCode(e.target.value)} />
                <Button type="submit" variant="secondary">{t("twoFactorDisable")}</Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setDisabling(true)}>{t("twoFactorDisable")}</Button>
          )
        ) : (
          <Button variant="secondary" onClick={enable2fa}>{t("twoFactorEnable")}</Button>
        )}
      </Card>

      {error && <Notice tone="attention">{error}</Notice>}

      <Card className="space-y-3">
        <form action={signOutEverywhere}><Button variant="secondary" type="submit">{t("signOutEverywhere")}</Button></form>
      </Card>
    </div>
  );
}
