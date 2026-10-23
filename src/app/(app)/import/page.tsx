import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "@/components/import/import-form";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export default async function ImportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id ?? "");
  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="mt-2 text-muted-foreground">
          Cette page est réservée aux administrateurs.
        </p>
      </div>
    );
  }

  const { data: players } = await fetchAllRows((from, to) =>
    supabase
      .from("players")
      .select("nom, prenom, date_naissance")
      .order("id")
      .range(from, to)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Import de joueurs</h1>
      <p className="mt-2 text-muted-foreground">
        Importe une liste de joueurs depuis un fichier CSV ou Excel, puis
        vérifie l&apos;aperçu : chaque cellule est modifiable et chaque ligne a
        un statut que tu choisis (« À importer », « Ignoré » ou « Supprimer »).
        Les doublons et les homonymes sont proposés « Ignoré ». Colonnes
        facultatives : « Montant » (enregistré en paiement « Non renseigné »),
        « Date de règlement » et « Note ».
      </p>
      <div className="mt-6">
        <ImportForm existingPlayers={players ?? []} />
      </div>
    </div>
  );
}
