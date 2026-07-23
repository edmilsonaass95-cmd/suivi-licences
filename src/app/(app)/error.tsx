"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-3">
          <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
          <p className="text-sm text-muted-foreground">
            Impossible d&apos;afficher cette page. Réessayez, ou revenez plus
            tard si le problème persiste.
          </p>
          <Button onClick={() => reset()}>Réessayer</Button>
        </CardContent>
      </Card>
    </div>
  );
}
