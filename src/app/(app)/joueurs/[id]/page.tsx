import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { formatDateFr, parseDateOnly } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/joueurs/add-payment-dialog";
import { PaymentHistory, type PaymentRow } from "@/components/joueurs/payment-history";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: player }, { data: balance }, { data: payments }] =
    await Promise.all([
      supabase.from("players").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("player_balances")
        .select("*")
        .eq("player_id", id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("*, cheques(*), prelevements(*)")
        .eq("player_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!player) notFound();

  const licencePrice = Number(player.licence_price);
  const paid = Number(balance?.paid ?? 0);
  const solde = Number(balance?.solde ?? licencePrice);
  const categorie = getCategorieFFF(
    parseDateOnly(player.date_naissance),
    player.sexe as "M" | "F",
    getSaisonStart()
  );

  const paymentRows: PaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id,
    mode: p.mode,
    amount: Number(p.amount),
    note: p.note,
    created_at: p.created_at,
    cheques: (p.cheques ?? []).sort(
      (a: { numero_ordre: number }, b: { numero_ordre: number }) =>
        a.numero_ordre - b.numero_ordre
    ),
    prelevements: (p.prelevements ?? []).sort(
      (a: { numero_echeance: number }, b: { numero_echeance: number }) =>
        a.numero_echeance - b.numero_echeance
    ),
  }));

  return (
    <div>
      <Link
        href="/joueurs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Retour aux joueurs
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {player.nom} {player.prenom}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{categorie}</Badge>
            {licencePrice > 0 && paid >= licencePrice ? (
              <Badge>Payé</Badge>
            ) : paid > 0 ? (
              <Badge className="border-transparent bg-amber-500 text-white">
                Partiel
              </Badge>
            ) : (
              <Badge variant="destructive">Dû</Badge>
            )}
          </div>
        </div>
        <AddPaymentDialog playerId={player.id} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Prix licence</p>
            <p className="font-heading text-lg font-semibold">
              {eur.format(licencePrice)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Payé</p>
            <p className="font-heading text-lg font-semibold">
              {eur.format(paid)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Solde</p>
            <p className="font-heading text-lg font-semibold">
              {eur.format(solde)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Date de naissance</p>
            <p className="font-heading text-lg font-semibold">
              {formatDateFr(player.date_naissance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">E-mail : </span>
            {player.email ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Téléphone : </span>
            {player.telephone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Ville : </span>
            {player.ville ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Muté : </span>
            {player.mute ? "Oui" : "Non"}
          </p>
          {player.notes && (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Notes : </span>
              {player.notes}
            </p>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Historique des paiements</h2>
      <PaymentHistory payments={paymentRows} />
    </div>
  );
}
