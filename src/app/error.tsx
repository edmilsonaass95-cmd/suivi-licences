"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="max-w-sm text-muted-foreground">
        Quelque chose s&apos;est mal passé. Réessayez, ou rechargez la page si
        le problème persiste.
      </p>
      <Button onClick={() => reset()} className="mt-2">
        Réessayer
      </Button>
    </main>
  );
}
