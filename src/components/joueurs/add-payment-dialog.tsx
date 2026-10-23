"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { createPayment } from "@/app/(app)/joueurs/actions";
import {
  PAYMENT_MODE_LABELS,
  DEFAULT_AMOUNT_BY_MODE,
  type PaymentFormValues,
} from "@/lib/joueurs/schemas";
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

export function AddPaymentDialog({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("espece");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [cheques, setCheques] = useState<ChequeRow[]>([emptyCheque]);
  const [echeances, setEcheances] = useState<EcheanceRow[]>([emptyEcheance]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function resetForm() {
    setMode("espece");
    setAmount("");
    setNote("");
    setCheques([emptyCheque]);
    setEcheances([emptyEcheance]);
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setAmount(DEFAULT_AMOUNT_BY_MODE[next]?.toString() ?? "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let values: unknown;
    if (mode === "cheque") {
      values = {
        mode,
        note: note || undefined,
        cheques: cheques.map((c) => ({
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
          montant: Number(row.montant),
          date_prelevement: row.date_prelevement,
        })),
      };
    } else {
      values = { mode, amount: Number(amount), note: note || undefined };
    }

    const result = await createPayment(playerId, values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Impossible d'enregistrer le paiement", {
        description: result.error,
      });
      return;
    }

    toast.success("Paiement enregistré");
    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Ajouter un paiement
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un paiement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mode de paiement</Label>
            <Select
              value={mode}
              onValueChange={(v) => handleModeChange(v as Mode)}
            >
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

          {SIMPLE_MODES.includes(mode) && (
            <div className="space-y-1.5">
              <Label htmlFor="amount">Montant (€)</Label>
              <Input
                id="amount"
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
            <Label htmlFor="note">Note (facultatif)</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer le paiement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
