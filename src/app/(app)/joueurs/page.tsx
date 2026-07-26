import { createClient } from "@/lib/supabase/server";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { parseDateOnly } from "@/lib/date";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { AddPlayerDialog } from "@/components/joueurs/add-player-dialog";
import { PlayersTable, type PlayerRow } from "@/components/joueurs/players-table";
import { ExportPaymentsDialog } from "@/components/joueurs/export-payments-dialog";

export default async function JoueursPage() {
  const supabase = await createClient();
  const { canWrite, isAdmin } = await getCurrentUserRoles();
  const [{ data: players }, { data: balances }] = await Promise.all([
    supabase.from("players").select("*").order("nom"),
    supabase.from("player_balances").select("*"),
  ]);

  const balanceByPlayer = new Map(
    (balances ?? []).map((b) => [b.player_id, b])
  );
  const saisonStart = getSaisonStart();

  const rows: PlayerRow[] = (players ?? []).map((p) => {
    const balance = balanceByPlayer.get(p.id);
    const licencePrice = Number(p.licence_price);
    const paid = Number(balance?.paid ?? 0);
    const solde = Number(balance?.solde ?? licencePrice);
    return {
      id: p.id,
      nom: p.nom,
      prenom: p.prenom,
      sexe: p.sexe as "M" | "F",
      categorie: getCategorieFFF(
        parseDateOnly(p.date_naissance),
        p.sexe as "M" | "F",
        saisonStart
      ),
      licencePrice,
      paid,
      solde,
    };
  });

  const categories = Array.from(new Set(rows.map((r) => r.categorie))).sort();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Joueurs</h1>
          <p className="text-muted-foreground">{rows.length} joueur(s)</p>
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
      <PlayersTable rows={rows} isAdmin={isAdmin} />
    </div>
  );
}
