import { PAYMENT_MODE_LABELS, type PaymentFormValues } from "@/lib/joueurs/schemas";
import { formatDateFr } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type Cheque = {
  numero_ordre: number;
  montant: number;
  date_encaissement: string;
  statut: "a_encaisser" | "encaisse" | "impaye";
  banque: string | null;
};

type Prelevement = {
  numero_echeance: number;
  montant: number;
  date_prelevement: string;
  statut: "prevu" | "preleve" | "echec";
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

const CHEQUE_STATUT_LABEL: Record<Cheque["statut"], string> = {
  a_encaisser: "À encaisser",
  encaisse: "Encaissé",
  impaye: "Impayé",
};

const PRELEVEMENT_STATUT_LABEL: Record<Prelevement["statut"], string> = {
  prevu: "Prévu",
  preleve: "Prélevé",
  echec: "Échec",
};

export function PaymentHistory({ payments }: { payments: PaymentRow[] }) {
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
            <span className="font-heading text-lg font-semibold">
              {eur.format(payment.amount)}
            </span>
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
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Date d&apos;encaissement</TableHead>
                  <TableHead>Banque</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.cheques.map((c) => (
                  <TableRow key={c.numero_ordre}>
                    <TableCell>{c.numero_ordre}</TableCell>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.prelevements.map((e) => (
                  <TableRow key={e.numero_echeance}>
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
