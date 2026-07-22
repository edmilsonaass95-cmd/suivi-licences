import { createClient } from "@/lib/supabase/server";
import { ChequesTable, type ChequeRow } from "@/components/echeancier/cheques-table";

export default async function EcheancierPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cheques")
    .select("*, payments(player_id, players(id, nom, prenom))")
    .order("date_encaissement");

  const rows: ChequeRow[] = (data ?? []).map((c) => ({
    id: c.id,
    numeroOrdre: c.numero_ordre,
    numeroCheque: c.numero_cheque,
    montant: Number(c.montant),
    dateEncaissement: c.date_encaissement,
    statut: c.statut,
    banque: c.banque,
    playerId: c.payments?.players?.id ?? "",
    playerName: c.payments?.players
      ? `${c.payments.players.nom} ${c.payments.players.prenom}`
      : "—",
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Échéancier chèques</h1>
      <p className="mt-2 text-muted-foreground">
        {rows.length} chèque(s), triés par date d&apos;encaissement.
      </p>
      <div className="mt-6">
        <ChequesTable rows={rows} />
      </div>
    </div>
  );
}
