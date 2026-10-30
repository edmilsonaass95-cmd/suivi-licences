"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ReceiptTextIcon } from "lucide-react";

import { getReceiptData } from "@/app/(app)/joueurs/actions";
import { buildInvoicePdf } from "@/lib/export-invoice";
import { Button } from "@/components/ui/button";

async function loadLogo(): Promise<string> {
  const response = await fetch("/logo-club-noir.png");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ExportReceiptButton({ playerId }: { playerId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await getReceiptData(playerId);
      if ("error" in result) {
        toast.error("Impossible de générer le reçu", {
          description: result.error,
        });
        return;
      }
      const doc = buildInvoicePdf(result.data, await loadLogo());
      const { nom, prenom } = result.data.player;
      const filename = `recu-${nom}-${prenom}-${result.data.numero}.pdf`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "-");
      doc.save(filename);
    } catch {
      toast.error("Impossible de générer le reçu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
    >
      <ReceiptTextIcon />
      {loading ? "Génération..." : "Reçu parent"}
    </Button>
  );
}
