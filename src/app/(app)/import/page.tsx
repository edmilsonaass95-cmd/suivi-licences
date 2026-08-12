import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "@/components/import/import-form";

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

  const { data: players } = await supabase
    .from("players")
    .select("nom, prenom, date_naissance");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Import de joueurs</h1>
      <p className="mt-2 text-muted-foreground">
        Importe une liste de joueurs depuis un fichier CSV ou Excel. Les
        doublons certains (même nom, prénom et date de naissance) sont
        détectés automatiquement et ignorés. Les homonymes probables (même
        nom, prénom et année de naissance, mais date exacte différente) sont
        signalés « À vérifier » et ne sont pas importés automatiquement : il
        faut cocher « Pas un doublon, importer quand même » après
        vérification manuelle pour les inclure.
      </p>
      <div className="mt-6">
        <ImportForm existingPlayers={players ?? []} />
      </div>
    </div>
  );
}
