"use client";

import { FileTextIcon } from "lucide-react";

import { exportPlayerToPdf, type PlayerPdfInfo } from "@/lib/export-pdf";
import { PAYMENT_MODE_LABELS, type PaymentFormValues } from "@/lib/joueurs/schemas";
import { CHEQUE_STATUT_LABEL, PRELEVEMENT_STATUT_LABEL } from "@/lib/joueurs/statut-labels";
import { formatDateFr } from "@/lib/date";
import { Button } from "@/components/ui/button";
import type { PaymentRow } from "@/components/joueurs/payment-history";

export function ExportPlayerPdfButton({
  player,
  payments,
}: {
  player: PlayerPdfInfo;
  payments: PaymentRow[];
}) {
  function handleExport() {
    const rows = payments.flatMap((p) => {
      if (p.mode === "cheque") {
        return p.cheques.map((c) => ({
          date: formatDateFr(c.date_encaissement),
          mode: PAYMENT_MODE_LABELS.cheque,
          detail: `N°${c.numero_ordre}${c.numero_cheque ? ` - ${c.numero_cheque}` : ""}${c.banque ? ` (${c.banque})` : ""}`,
          montant: Number(c.montant),
          statut: CHEQUE_STATUT_LABEL[c.statut],
          note: p.note ?? "",
        }));
      }
      if (p.mode === "prelevement") {
        return p.prelevements.map((e) => ({
          date: formatDateFr(e.date_prelevement),
          mode: PAYMENT_MODE_LABELS.prelevement,
          detail: `Échéance ${e.numero_echeance}`,
          montant: Number(e.montant),
          statut: PRELEVEMENT_STATUT_LABEL[e.statut],
          note: p.note ?? "",
        }));
      }
      return [
        {
          date: formatDateFr(p.created_at),
          mode: PAYMENT_MODE_LABELS[p.mode as PaymentFormValues["mode"]],
          detail: "—",
          montant: p.amount,
          statut: "Encaissé",
          note: p.note ?? "",
        },
      ];
    });

    exportPlayerToPdf(player, rows);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport}>
      <FileTextIcon />
      Exporter en PDF
    </Button>
  );
}
