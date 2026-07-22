"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";

import { updatePayment } from "@/app/(app)/joueurs/actions";
import { PAYMENT_MODE_LABELS, type PaymentFormValues } from "@/lib/joueurs/schemas";
import {
  ChequesFields,
  EcheancesFields,
  emptyCheque,
  emptyEcheance,
  type ChequeRow,
  type EcheanceRow,
} from "@/components/joueurs/payment-mode-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = PaymentFormValues["mode"];
const SIMPLE_MODES: Mode[] = [
  "espece",
  "virement",
  "labaz",
  "pass_aglo",
  "pass_sport",
];

export type EditablePayment = {
  id: string;
  mode: Mode;
  amount: number;
  note: string | null;
  cheques: {
    id: string;
    montant: number;
    date_encaissement: string;
    banque: string | null;
    numero_cheque: string | null;
  }[];
  prelevements: {
    id: string;
    montant: number;
    date_prelevement: string;
  }[];
};

export function EditPaymentDialog({ payment }: { payment: EditablePayment }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [note, setNote] = useState(payment.note ?? "");
  const [cheques, setCheques] = useState<ChequeRow[]>(
    payment.cheques.length > 0
      ? payment.cheques.map((c) => ({
          id: c.id,
          montant: String(c.montant),
          date_encaissement: c.date_encaissement,
          banque: c.banque ?? "",
          numero_cheque: c.numero_cheque ?? "",
        }))
      : [emptyCheque]
  );
  const [echeances, setEcheances] = useState<EcheanceRow[]>(
    payment.prelevements.length > 0
      ? payment.prelevements.map((e) => ({
          id: e.id,
          montant: String(e.montant),
          date_prelevement: e.date_prelevement,
        }))
      : [emptyEcheance]
  );
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let values: unknown;
    if (payment.mode === "cheque") {
      values = {
        mode: payment.mode,
        note: note || undefined,
        cheques: cheques.map((c) => ({
          id: c.id,
          montant: Number(c.montant),
          date_encaissement: c.date_encaissement,
          banque: c.banque || undefined,
          numero_cheque: c.numero_cheque || undefined,
        })),
      };
    } else if (payment.mode === "prelevement") {
      values = {
        mode: payment.mode,
        note: note || undefined,
        echeances: echeances.map((row) => ({
          id: row.id,
          montant: Number(row.montant),
          date_prelevement: row.date_prelevement,
        })),
      };
    } else {
      values = {
        mode: payment.mode,
        amount: Number(amount),
        note: note || undefined,
      };
    }

    const result = await updatePayment(payment.id, values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Impossible de modifier le paiement", {
        description: result.error,
      });
      return;
    }

    toast.success("Paiement modifié");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Modifier le paiement"
      >
        <PencilIcon className="size-4" />
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le paiement</DialogTitle>
          <DialogDescription>
            {PAYMENT_MODE_LABELS[payment.mode]}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {SIMPLE_MODES.includes(payment.mode) && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Montant (€)</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}

          {payment.mode === "cheque" && (
            <ChequesFields rows={cheques} onChange={setCheques} />
          )}

          {payment.mode === "prelevement" && (
            <EcheancesFields rows={echeances} onChange={setEcheances} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-note">Note (facultatif)</Label>
            <Textarea
              id="edit-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
