import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="font-heading text-5xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="max-w-sm text-muted-foreground">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Button
        render={<Link href="/dashboard" />}
        nativeButton={false}
        className="mt-2"
      >
        Retour au tableau de bord
      </Button>
    </main>
  );
}
