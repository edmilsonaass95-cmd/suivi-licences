import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { formatDateFr, parseDateOnly } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/joueurs/add-payment-dialog";
import { EditPlayerDialog } from "@/components/joueurs/edit-player-dialog";
import { PaymentHistory, type PaymentRow } from "@/components/joueurs/payment-history";
import { AttachmentsSection } from "@/components/joueurs/attachments-section";
import { ExportPlayerPdfButton } from "@/components/joueurs/export-player-pdf-button";
import { REMISE_MOTIF_LABELS } from "@/lib/joueurs/schemas";
import {
  NATURE_LABELS,
  NIVEAU_LABELS,
  type Nature,
  type Niveau,
} from "@/lib/joueurs/pricing";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

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

  const [
    { data: player },
    { data: balance },
    { data: payments },
    { data: allPlayers },
    { data: attachments },
    { isAdmin, canWrite },
  ] = await Promise.all([
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
    fetchAllRows((from, to) =>
      supabase.from("players").select("id, nom, prenom").order("nom").range(from, to)
    ),
    supabase
      .from("attachments")
      .select("id, filename, file_path, created_at")
      .eq("player_id", id)
      .order("created_at", { ascending: false }),
    getCurrentUserRoles(),
  ]);

  if (!player) notFound();

  const linkedPlayer = player.remise_lien_joueur_id
    ? (allPlayers ?? []).find((p) => p.id === player.remise_lien_joueur_id)
    : null;

  const licencePrice = Number(player.licence_price);
  const paid = Number(balance?.paid ?? 0);
  const solde = Number(balance?.solde ?? licencePrice);
  const categorie = getCategorieFFF(
    parseDateOnly(player.date_naissance),
    player.sexe as "M" | "F",
    getSaisonStart()
  );

  const statutLabel =
    licencePrice > 0 && paid >= licencePrice
      ? "Payé"
      : paid > 0
        ? "Partiel"
        : "Dû";
  const remiseLabel = player.remise_motif
    ? `${eur.format(Number(player.remise))} (${REMISE_MOTIF_LABELS[player.remise_motif as "parente" | "autre"]}${
        linkedPlayer ? ` — ${linkedPlayer.nom} ${linkedPlayer.prenom}` : ""
      })`
    : "Aucune";

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
        <div className="flex gap-2">
          <ExportPlayerPdfButton
            player={{
              nom: player.nom,
              prenom: player.prenom,
              sexe: player.sexe as "M" | "F",
              categorie,
              dateNaissance: formatDateFr(player.date_naissance),
              email: player.email,
              telephone: player.telephone,
              ville: player.ville,
              nature: player.nature as Nature,
              niveau: player.niveau as Niveau,
              remiseLabel,
              notes: player.notes,
              licencePrice,
              paid,
              solde,
              statutLabel,
            }}
            payments={paymentRows}
          />
          {canWrite && (
            <EditPlayerDialog
              playerId={player.id}
              categorie={categorie}
              sexe={player.sexe as "M" | "F"}
              initial={{
                nature: player.nature as Nature,
                niveau: player.niveau as Niveau,
                email: player.email,
                telephone: player.telephone,
                ville: player.ville,
                remise: Number(player.remise ?? 0),
                remise_motif: player.remise_motif,
                remise_lien_joueur_id: player.remise_lien_joueur_id,
              }}
              players={(allPlayers ?? []).map((p) => ({
                id: p.id,
                nom: p.nom,
                prenom: p.prenom,
              }))}
            />
          )}
          {canWrite && <AddPaymentDialog playerId={player.id} />}
        </div>
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
            <span className="text-muted-foreground">Nature : </span>
            {NATURE_LABELS[player.nature as Nature]}
          </p>
          <p>
            <span className="text-muted-foreground">Niveau : </span>
            {NIVEAU_LABELS[player.niveau as Niveau]}
          </p>
          <p>
            <span className="text-muted-foreground">Remise : </span>
            {player.remise_motif
              ? `${eur.format(Number(player.remise))} (${REMISE_MOTIF_LABELS[player.remise_motif as "parente" | "autre"]}${
                  linkedPlayer
                    ? ` — ${linkedPlayer.nom} ${linkedPlayer.prenom}`
                    : ""
                })`
              : "Aucune"}
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
      <PaymentHistory payments={paymentRows} canWrite={canWrite} />

      <div className="mt-6">
        <AttachmentsSection
          playerId={player.id}
          attachments={attachments ?? []}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
