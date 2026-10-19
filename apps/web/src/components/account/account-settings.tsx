"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { savePassword, updateAccount, type PasswordResult } from "@/lib/account-actions";
import { Avatar } from "./avatar";

/** Crops the middle square of a photo and shrinks it to 160×160 JPEG. */
async function toAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 160, 160);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function AccountSettings({ name: initialName, email, image: initialImage, hasPassword }: {
  name: string; email: string; image: string | null; hasPassword: boolean;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState<string | null>(initialImage);
  const [profileMsg, setProfileMsg] = useState<"saved" | "error" | null>(null);
  const [pending, start] = useTransition();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pw, setPw] = useState<PasswordResult | null>(null);
  const [pwSet, setPwSet] = useState(hasPassword);

  async function pick(f: File | undefined) {
    if (!f) return;
    try { setImage(await toAvatar(f)); setProfileMsg(null); } catch { setProfileMsg("error"); }
    if (file.current) file.current.value = "";
  }
  const saveProfile = () => start(async () => {
    const res = await updateAccount({ name, image });
    setProfileMsg(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  });
  const savePw = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await savePassword({ current: pwSet ? current : undefined, next, repeat });
      setPw(res);
      if (res.ok) { setPwSet(true); setCurrent(""); setNext(""); setRepeat(""); }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <h2 className="text-2xl">{t("profileTitle")}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} email={email} image={image} size={80} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            <Button variant="secondary" onClick={() => file.current?.click()}><Camera size={16} aria-hidden /> {image ? t("changePhoto") : t("addPhoto")}</Button>
            {image && <Button variant="ghost" onClick={() => setImage(null)}><Trash2 size={16} aria-hidden /> {t("removePhoto")}</Button>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} htmlFor="acc-name">
            <Input id="acc-name" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setProfileMsg(null); }} autoComplete="name" />
          </Field>
          <Field label={t("email")} htmlFor="acc-email" hint={t("emailHint")}>
            <Input id="acc-email" value={email} readOnly disabled />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={saveProfile} disabled={pending || !name.trim()}>{tc("save")}</Button>
          {profileMsg && <span className="text-sm text-muted" aria-live="polite">{profileMsg === "saved" ? t("saved") : tc("somethingWrong")}</span>}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl">{t("passwordTitle")}</h2>
          <p className="text-sm text-muted">{pwSet ? t("passwordOn") : t("passwordOff")}</p>
        </div>
        <form onSubmit={savePw} className="grid gap-4 sm:max-w-md">
          {/* Helps password managers save the right account. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          {pwSet && (
            <Field label={t("currentPassword")} htmlFor="pw-current">
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
          )}
          <Field label={t("newPassword")} htmlFor="pw-new" hint={t("passwordRule")}>
            <Input id="pw-new" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label={t("repeatPassword")} htmlFor="pw-repeat">
            <Input id="pw-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
          </Field>
          {pw?.error && <Notice tone="attention">{t(`pwError_${pw.error}`)}</Notice>}
          {pw?.ok && <Notice tone="success">{t("pwSaved")}</Notice>}
          <div><Button type="submit" disabled={pending}>{pwSet ? t("changePassword") : t("setPassword")}</Button></div>
        </form>
      </Card>
    </div>
  );
}
