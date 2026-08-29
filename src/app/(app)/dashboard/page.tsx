import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/date";
import { PAYMENT_MODE_LABELS } from "@/lib/joueurs/schemas";
import { getCurrentUserRoles } from "@/lib/auth/get-role";
import { ensurePlayerSeasons, getMaxKnownSaisonStart } from "@/lib/joueurs/seasons";
import { getSelectableSaisons, saisonLabel } from "@/lib/saison-selection";
import { getSelectedSaisonStart } from "@/lib/saison-selection-cookie";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { SeasonSelector } from "@/components/dashboard/season-selector";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { canWrite } = await getCurrentUserRoles();
  const maxSaisonStart = await getMaxKnownSaisonStart(supabase);
  const selectedSaison = await getSelectedSaisonStart(maxSaisonStart);
  const saisons = getSelectableSaisons(maxSaisonStart);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: players },
    { data: payments },
    { data: upcomingCheques },
    { data: upcomingPrelevements },
    { data: impayesCheques },
    { data: echecPrelevements },
  ] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("players")
        .select("id, date_naissance, sexe, nature, hors_sarcelles, remise")
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("payments")
      .select("mode, amount")
      .eq("saison_start", selectedSaison),
    supabase
      .from("cheques")
      .select("id, montant, date_encaissement, payments(players(id, nom, prenom))")
      .eq("statut", "a_encaisser")
      .gte("date_encaissement", today)
      .lte("date_encaissement", in14Days)
      .order("date_encaissement"),
    supabase
      .from("prelevements")
      .select("id, montant, date_prelevement, payments(players(id, nom, prenom))")
      .eq("statut", "prevu")
      .gte("date_prelevement", today)
      .lte("date_prelevement", in14Days)
      .order("date_prelevement"),
    supabase
      .from("cheques")
      .select("id, montant, date_encaissement, payments(players(id, nom, prenom))")
      .eq("statut", "impaye")
      .order("date_encaissement"),
    supabase
      .from("prelevements")
      .select("id, montant, date_prelevement, payments(players(id, nom, prenom))")
      .eq("statut", "echec")
      .order("date_prelevement"),
  ]);

  const [snapshotByPlayer, { data: paidTotals }] = await Promise.all([
    ensurePlayerSeasons(
      supabase,
      (players ?? []).map((p) => ({
        id: p.id,
        date_naissance: p.date_naissance,
        sexe: p.sexe as "M" | "F",
        nature: p.nature,
        hors_sarcelles: p.hors_sarcelles,
        remise: Number(p.remise),
      })),
      selectedSaison,
      { canWrite }
    ),
    supabase.rpc("saison_paid_totals", { _saison_start: selectedSaison }),
  ]);

  const paidByPlayer = new Map<string, number>(
    (paidTotals ?? []).map((r: { player_id: string; paid: number }) => [
      r.player_id,
      Number(r.paid),
    ])
  );

  const rows = (players ?? []).map((p) => {
    const snapshot = snapshotByPlayer.get(p.id);
    const expected = snapshot?.licence_price ?? 0;
    const paid = paidByPlayer.get(p.id) ?? 0;
    return { expected, paid, solde: expected - paid };
  });

  const totalAttendu = rows.reduce((sum, r) => sum + r.expected, 0);
  const totalPaye = rows.reduce((sum, r) => sum + r.paid, 0);
  const totalReste = rows.reduce(
    (sum, r) => sum + Math.max(r.solde, 0),
    0
  );

  let nbPaye = 0;
  let nbPartiel = 0;
  let nbImpaye = 0;
  for (const r of rows) {
    if (r.expected > 0 && r.paid >= r.expected) nbPaye++;
    else if (r.paid > 0) nbPartiel++;
    else nbImpaye++;
  }

  const totalsByMode = new Map<string, number>();
  for (const p of payments ?? []) {
    totalsByMode.set(
      p.mode,
      (totalsByMode.get(p.mode) ?? 0) + Number(p.amount)
    );
  }

  type EcheanceRow = {
    id: string;
    type: "Chèque" | "Prélèvement";
    date: string;
    montant: number;
    playerId: string;
    playerName: string;
  };

  type RawEcheance = {
    id: string;
    montant: number;
    date_encaissement?: string;
    date_prelevement?: string;
    payments: unknown;
  };

  function toEcheanceRows(
    items: RawEcheance[] | null,
    type: EcheanceRow["type"]
  ): EcheanceRow[] {
    return (items ?? []).map((item) => {
      const paymentsRel = item.payments as
        | { players: unknown }
        | { players: unknown }[]
        | null;
      const paymentRow = Array.isArray(paymentsRel)
        ? paymentsRel[0]
        : paymentsRel;
      const playersRel = paymentRow?.players as
        | { id: string; nom: string; prenom: string }
        | { id: string; nom: string; prenom: string }[]
        | null
        | undefined;
      const player = Array.isArray(playersRel) ? playersRel[0] : playersRel;
      return {
        id: item.id,
        type,
        date: (item.date_encaissement ?? item.date_prelevement)!,
        montant: Number(item.montant),
        playerId: player?.id ?? "",
        playerName: player ? `${player.nom} ${player.prenom}` : "—",
      };
    });
  }

  const echeances = [
    ...toEcheanceRows(upcomingCheques, "Chèque"),
    ...toEcheanceRows(upcomingPrelevements, "Prélèvement"),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const incidents = [
    ...toEcheanceRows(impayesCheques, "Chèque"),
    ...toEcheanceRows(echecPrelevements, "Prélèvement"),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="mt-1 text-muted-foreground">
            Vue d&apos;ensemble des licences et des paiements — saison{" "}
            {saisonLabel(selectedSaison)}.
          </p>
        </div>
        <SeasonSelector
          saisons={saisons}
          selected={selectedSaison}
          canAddSaison={canWrite}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Joueurs</p>
            <p className="font-heading text-lg font-semibold">
              {rows.length}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Attendu</p>
            <p className="font-heading text-lg font-semibold">
              {eur.format(totalAttendu)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Encaissé</p>
            <p className="font-heading text-lg font-semibold">
              {eur.format(totalPaye)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Reste à percevoir</p>
            <p className="font-heading text-lg font-semibold">
              {eur.format(totalReste)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-3 font-heading text-sm font-semibold">
              Statut des joueurs
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <Badge>Payé</Badge>
                <span>{nbPaye}</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="border-transparent bg-amber-500 text-white">
                  Partiel
                </Badge>
                <span>{nbPartiel}</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="destructive">Dû</Badge>
                <span>{nbImpaye}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 font-heading text-sm font-semibold">
              Paiements enregistrés par mode
            </h2>
            {totalsByMode.size === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {Object.entries(PAYMENT_MODE_LABELS)
                  .filter(([mode]) => totalsByMode.has(mode))
                  .map(([mode, label]) => (
                    <div key={mode} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">
                        {eur.format(totalsByMode.get(mode) ?? 0)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-3 font-heading text-sm font-semibold">
              Échéances à venir (14 jours)
            </h2>
            {echeances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune échéance dans les 14 prochains jours.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joueur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {echeances.map((e) => (
                    <TableRow key={`${e.type}-${e.id}`}>
                      <TableCell>
                        <Link
                          href={`/joueurs/${e.playerId}`}
                          className="hover:underline"
                        >
                          {e.playerName}
                        </Link>
                      </TableCell>
                      <TableCell>{e.type}</TableCell>
                      <TableCell>{formatDateFr(e.date)}</TableCell>
                      <TableCell className="text-right">
                        {eur.format(e.montant)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 font-heading text-sm font-semibold">
              Incidents (impayés / échecs)
            </h2>
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun incident.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joueur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((e) => (
                    <TableRow key={`${e.type}-${e.id}`}>
                      <TableCell>
                        <Link
                          href={`/joueurs/${e.playerId}`}
                          className="hover:underline"
                        >
                          {e.playerName}
                        </Link>
                      </TableCell>
                      <TableCell>{e.type}</TableCell>
                      <TableCell>{formatDateFr(e.date)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">
                          {eur.format(e.montant)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
