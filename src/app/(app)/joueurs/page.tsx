import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { ensurePlayerSeasons, getMaxKnownSaisonStart } from "@/lib/joueurs/seasons";
import {
  FIRST_SAISON_START,
  saisonLabel,
  saisonShortLabel,
} from "@/lib/saison-selection";
import { getSelectedSaisonStart } from "@/lib/saison-selection-cookie";
import { AddPlayerDialog } from "@/components/joueurs/add-player-dialog";
import { PlayersTable, type PlayerRow } from "@/components/joueurs/players-table";
import { ExportPaymentsDialog } from "@/components/joueurs/export-payments-dialog";

export default async function JoueursPage() {
  const supabase = await createClient();
  const { canWrite, isAdmin } = await getCurrentUserRoles();
  const maxSaisonStart = await getMaxKnownSaisonStart(supabase);
  const selectedSaison = await getSelectedSaisonStart(maxSaisonStart);
  const previousSaison =
    selectedSaison > FIRST_SAISON_START ? selectedSaison - 1 : null;
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("nom");

  const playerAttributes = (players ?? []).map((p) => ({
    id: p.id,
    date_naissance: p.date_naissance,
    sexe: p.sexe as "M" | "F",
    mute: p.mute,
    hors_sarcelles: p.hors_sarcelles,
    remise: Number(p.remise),
  }));

  const [snapshotByPlayer, { data: paidTotals }, previousData] =
    await Promise.all([
      ensurePlayerSeasons(supabase, playerAttributes, selectedSaison, {
        canWrite,
      }),
      supabase.rpc("saison_paid_totals", { _saison_start: selectedSaison }),
      previousSaison !== null
        ? Promise.all([
            ensurePlayerSeasons(supabase, playerAttributes, previousSaison, {
              canWrite,
            }),
            supabase.rpc("saison_paid_totals", {
              _saison_start: previousSaison,
            }),
          ])
        : Promise.resolve(null),
    ]);

  const paidByPlayer = new Map<string, number>(
    (paidTotals ?? []).map((r: { player_id: string; paid: number }) => [
      r.player_id,
      Number(r.paid),
    ])
  );

  let previousSoldeByPlayer: Map<string, number> | null = null;
  if (previousData) {
    const [previousSnapshotByPlayer, { data: previousPaidTotals }] =
      previousData;
    const previousPaidByPlayer = new Map<string, number>(
      (previousPaidTotals ?? []).map(
        (r: { player_id: string; paid: number }) => [r.player_id, Number(r.paid)]
      )
    );
    previousSoldeByPlayer = new Map(
      playerAttributes.map((p) => {
        const snapshot = previousSnapshotByPlayer.get(p.id);
        const licencePrice = snapshot?.licence_price ?? 0;
        const paid = previousPaidByPlayer.get(p.id) ?? 0;
        return [p.id, licencePrice - paid];
      })
    );
  }

  const rows: PlayerRow[] = (players ?? []).map((p) => {
    const snapshot = snapshotByPlayer.get(p.id);
    const licencePrice = snapshot?.licence_price ?? 0;
    const paid = paidByPlayer.get(p.id) ?? 0;
    const solde = licencePrice - paid;
    return {
      id: p.id,
      nom: p.nom,
      prenom: p.prenom,
      sexe: p.sexe as "M" | "F",
      categorie: snapshot?.categorie ?? "—",
      licencePrice,
      paid,
      solde,
      previousSolde: previousSoldeByPlayer?.get(p.id),
    };
  });

  const categories = Array.from(new Set(rows.map((r) => r.categorie))).sort();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Joueurs</h1>
          <p className="text-muted-foreground">
            {rows.length} joueur(s) — saison {saisonLabel(selectedSaison)}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportPaymentsDialog categories={categories} />
          {canWrite && (
            <AddPlayerDialog
              players={(players ?? []).map((p) => ({
                id: p.id,
                nom: p.nom,
                prenom: p.prenom,
              }))}
            />
          )}
        </div>
      </div>
      <PlayersTable
        rows={rows}
        isAdmin={isAdmin}
        canWrite={canWrite}
        soldeLabel={`Solde ${saisonShortLabel(selectedSaison)}`}
        previousSoldeLabel={
          previousSaison !== null
            ? `Solde ${saisonShortLabel(previousSaison)}`
            : undefined
        }
      />
    </div>
  );
}
