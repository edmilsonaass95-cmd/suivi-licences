import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import {
  PrelevementsTable,
  type PrelevementRow,
} from "@/components/prelevements/prelevements-table";
import { ImportPrelevementsDialog } from "@/components/prelevements/import-prelevements-dialog";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

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

  const rows: PrelevementRow[] = (data ?? []).map((p) => ({
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
