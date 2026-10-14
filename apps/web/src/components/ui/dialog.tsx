"use client";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";

export function Dialog({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] fade-up" />
        <D.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-line bg-surface p-6 shadow-soft fade-up">
          <D.Title className="font-serif text-2xl text-ink">{title}</D.Title>
          {description && <D.Description className="mt-2 text-muted">{description}</D.Description>}
          <div className="mt-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
