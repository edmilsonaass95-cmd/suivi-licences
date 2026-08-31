import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import {
  PrelevementsTable,
  type PrelevementRow,
} from "@/components/prelevements/prelevements-table";
import { ImportPrelevementsDialog } from "@/components/prelevements/import-prelevements-dialog";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { chunk } from "@/lib/chunk";

const ID_BATCH_SIZE = 150;

export default async function PrelevementsPage() {
  const supabase = await createClient();
  const { canWrite } = await getCurrentUserRoles();

  const [{ data }, { data: players }] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("prelevements")
        .select("*, payments(player_id, players(id, nom, prenom))")
        .order("date_prelevement")
        .range(from, to)
    ),
    canWrite
      ? fetchAllRows((from, to) =>
          supabase
            .from("players")
            .select("id, nom, prenom")
            .order("nom")
            .range(from, to)
        )
      : Promise.resolve({
          data: [] as { id: string; nom: string; prenom: string }[],
          error: null,
        }),
  ]);

  // Un joueur qui a soldé sa licence n'a plus rien à suivre ici : ses
  // échéances (même passées en échec) disparaissent de l'échéancier.
  const playerIds = Array.from(
    new Set(
      (data ?? [])
        .map((p) => p.payments?.players?.id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const balances: { player_id: string; solde: number }[] = [];
  for (const batch of chunk(playerIds, ID_BATCH_SIZE)) {
    const { data: balanceBatch } = await supabase
      .from("player_balances")
      .select("player_id, solde")
      .in("player_id", batch);
    if (balanceBatch) {
      balances.push(
        ...balanceBatch.map((b) => ({ ...b, solde: Number(b.solde) }))
      );
    }
  }
  const soldeByPlayer = new Map(balances.map((b) => [b.player_id, b.solde]));

  const rows: PrelevementRow[] = (data ?? [])
    .filter((p) => {
      const playerId = p.payments?.players?.id;
      if (!playerId) return true;
      return (soldeByPlayer.get(playerId) ?? 0) > 0;
    })
    .map((p) => ({
      id: p.id,
      numeroEcheance: p.numero_echeance,
      montant: Number(p.montant),
      datePrelevement: p.date_prelevement,
      statut: p.statut,
      playerId: p.payments?.players?.id ?? "",
      playerName: p.payments?.players
        ? `${p.payments.players.nom} ${p.payments.players.prenom}`
        : "—",
    }));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Paiements en ligne</h1>
          <p className="mt-2 text-muted-foreground">
            {rows.length} prélèvement(s), triés par date.
          </p>
        </div>
        {canWrite && <ImportPrelevementsDialog players={players ?? []} />}
      </div>
      <div className="mt-6">
        <PrelevementsTable rows={rows} canWrite={canWrite} />
      </div>
    </div>
  );
}
