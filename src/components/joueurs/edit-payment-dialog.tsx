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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  "cb",
  "autre",
  "non_renseigne",
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
  // Le mode ne peut changer que pour un paiement simple (par ex. un montant
  // importé « Non renseigné ») : un chèque ou un prélèvement a ses propres lignes.
  const canChangeMode = SIMPLE_MODES.includes(payment.mode);
  const [mode, setMode] = useState<Mode>(payment.mode);
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
    if (mode === "cheque") {
      values = {
        mode,
        note: note || undefined,
        cheques: cheques.map((c) => ({
          id: c.id,
          montant: Number(c.montant),
          date_encaissement: c.date_encaissement,
          banque: c.banque || undefined,
          numero_cheque: c.numero_cheque || undefined,
        })),
      };
    } else if (mode === "prelevement") {
      values = {
        mode,
        note: note || undefined,
        echeances: echeances.map((row) => ({
          id: row.id,
          montant: Number(row.montant),
          date_prelevement: row.date_prelevement,
        })),
      };
    } else {
      values = {
        mode,
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMode(payment.mode);
      }}
    >
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
          {!canChangeMode && (
            <DialogDescription>
              {PAYMENT_MODE_LABELS[payment.mode]}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {canChangeMode && (
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => PAYMENT_MODE_LABELS[v as Mode]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {SIMPLE_MODES.includes(mode) && (
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

          {mode === "cheque" && (
            <ChequesFields rows={cheques} onChange={setCheques} />
          )}

          {mode === "prelevement" && (
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
