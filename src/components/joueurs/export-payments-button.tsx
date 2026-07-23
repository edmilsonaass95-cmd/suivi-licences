"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";

import { getPaymentsForExport } from "@/app/(app)/joueurs/actions";
import { PAYMENT_MODE_LABELS, type PaymentFormValues } from "@/lib/joueurs/schemas";
import { formatDateFr } from "@/lib/date";
import { exportToExcel, todayStamp } from "@/lib/export-xlsx";
import { Button } from "@/components/ui/button";

export function ExportPaymentsButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const result = await getPaymentsForExport();
    setLoading(false);

    if ("error" in result) {
      toast.error("Export impossible", { description: result.error });
      return;
    }

    const exportRows = result.rows.map((p) => ({
      Joueur: p.joueur,
      Mode: PAYMENT_MODE_LABELS[p.mode as PaymentFormValues["mode"]],
      "Montant (€)": p.amount,
      Date: formatDateFr(p.created_at),
      Note: p.note ?? "",
    }));

    exportToExcel(`paiements-${todayStamp()}.xlsx`, "Paiements", exportRows);
    toast.success("Export généré");
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={handleExport}
    >
      <DownloadIcon />
      {loading ? "Export..." : "Exporter les paiements"}
    </Button>
  );
}
