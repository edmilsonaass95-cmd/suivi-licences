"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon } from "lucide-react";

import { updateChequeStatut } from "@/app/(app)/echeancier/actions";
import { updatePrelevementStatut } from "@/app/(app)/prelevements/actions";
import { PAYMENT_MODE_LABELS, type PaymentFormValues } from "@/lib/joueurs/schemas";
import {
  CHEQUE_STATUT_LABEL,
  PRELEVEMENT_STATUT_LABEL,
  type ChequeStatut,
  type PrelevementStatut,
} from "@/lib/joueurs/statut-labels";
import { formatDateFr } from "@/lib/date";
import { EditPaymentDialog } from "@/components/joueurs/edit-payment-dialog";
import { DeletePaymentButton } from "@/components/joueurs/delete-payment-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type Cheque = {
  id: string;
  numero_ordre: number;
  numero_cheque: string | null;
  montant: number;
  date_encaissement: string;
  statut: ChequeStatut;
  banque: string | null;
};

type Prelevement = {
  id: string;
  numero_echeance: number;
  montant: number;
  date_prelevement: string;
  statut: PrelevementStatut;
};

export type PaymentRow = {
  id: string;
  mode: PaymentFormValues["mode"];
  amount: number;
  note: string | null;
  created_at: string;
  cheques: Cheque[];
  prelevements: Prelevement[];
};

export function PaymentHistory({
  payments,
  canWrite,
}: {
  payments: PaymentRow[];
  canWrite: boolean;
}) {
  const router = useRouter();

  const handleChequeStatut = async (
    chequeId: string,
    statut: Cheque["statut"]
  ) => {
    const result = await updateChequeStatut(chequeId, statut);
    if (result.error) {
      toast.error("Impossible de mettre à jour le chèque", {
        description: result.error,
      });
      return;
    }
    toast.success("Statut mis à jour");
    router.refresh();
  };

  const handlePrelevementStatut = async (
    id: string,
    statut: Prelevement["statut"]
  ) => {
    const result = await updatePrelevementStatut(id, statut);
    if (result.error) {
      toast.error("Impossible de mettre à jour le prélèvement", {
        description: result.error,
      });
      return;
    }
    toast.success("Statut mis à jour");
    router.refresh();
  };

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun paiement enregistré pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">
                {PAYMENT_MODE_LABELS[payment.mode]}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {formatDateFr(payment.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-heading text-lg font-semibold">
                {eur.format(payment.amount)}
              </span>
              {canWrite && (
                <>
                  <EditPaymentDialog payment={payment} />
                  <DeletePaymentButton paymentId={payment.id} />
                </>
              )}
            </div>
          </div>
          {payment.note && (
            <p className="mt-1 text-sm text-muted-foreground">
              {payment.note}
            </p>
          )}

          {payment.cheques.length > 0 && (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>N° chèque</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date d&apos;encaissement</TableHead>
                  <TableHead>Banque</TableHead>
                  <TableHead>Statut</TableHead>
                  {canWrite && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.cheques.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.numero_ordre}</TableCell>
                    <TableCell>{c.numero_cheque ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {eur.format(c.montant)}
                    </TableCell>
                    <TableCell>{formatDateFr(c.date_encaissement)}</TableCell>
                    <TableCell>{c.banque ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.statut === "encaisse" ? "default" : "outline"
                        }
                      >
                        {CHEQUE_STATUT_LABEL[c.statut]}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={c.statut === "encaisse"}
                              onClick={() =>
                                handleChequeStatut(c.id, "encaisse")
                              }
                            >
                              Marquer encaissé
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={c.statut === "impaye"}
                              onClick={() => handleChequeStatut(c.id, "impaye")}
                            >
                              Marquer impayé
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={c.statut === "a_encaisser"}
                              onClick={() =>
                                handleChequeStatut(c.id, "a_encaisser")
                              }
                            >
                              Remettre à encaisser
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {payment.prelevements.length > 0 && (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  {canWrite && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.prelevements.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.numero_echeance}</TableCell>
                    <TableCell className="text-right">
                      {eur.format(e.montant)}
                    </TableCell>
                    <TableCell>{formatDateFr(e.date_prelevement)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.statut === "preleve" ? "default" : "outline"
                        }
                      >
                        {PRELEVEMENT_STATUT_LABEL[e.statut]}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={e.statut === "preleve"}
                              onClick={() =>
                                handlePrelevementStatut(e.id, "preleve")
                              }
                            >
                              Marquer prélevé
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={e.statut === "echec"}
                              onClick={() =>
                                handlePrelevementStatut(e.id, "echec")
                              }
                            >
                              Marquer échec
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={e.statut === "prevu"}
                              onClick={() =>
                                handlePrelevementStatut(e.id, "prevu")
                              }
                            >
                              Remettre à venir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
    </div>
  );
}
