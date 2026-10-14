import Link from "next/link";
import { LogoMark, WindowIllustration } from "@/components/illustrations";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5 self-center text-ink">
        <LogoMark className="h-9 w-9" />
        <span className="font-serif text-2xl">Psych Copilot</span>
      </Link>
      <WindowIllustration className="mx-auto mb-2 h-28 w-36" />
      {children}
    </main>
  );
}
