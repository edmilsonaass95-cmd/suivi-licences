"use client";

import {
  REMISE_MOTIF_LABELS,
  remiseMotifs,
  type RemiseMotif,
} from "@/lib/joueurs/schemas";
import { REMISE_PARENTE } from "@/lib/joueurs/pricing";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlayerOption = { id: string; nom: string; prenom: string };

export function RemiseFields({
  motif,
  remise,
  onMotifChange,
  onRemiseChange,
  error,
  players,
  linkedPlayerId,
  onLinkedPlayerChange,
  linkedError,
}: {
  motif: RemiseMotif;
  remise: number | string;
  onMotifChange: (motif: RemiseMotif) => void;
  onRemiseChange: (value: string) => void;
  error?: string;
  players: PlayerOption[];
  linkedPlayerId: string | undefined;
  onLinkedPlayerChange: (id: string) => void;
  linkedError?: string;
}) {
  return (
    <div className="col-span-2 space-y-1.5">
      <Label>Remise</Label>
      <Select
        value={motif}
        onValueChange={(v) => onMotifChange((v ?? "aucune") as RemiseMotif)}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {(v: string) => REMISE_MOTIF_LABELS[v as RemiseMotif]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {remiseMotifs.map((m) => (
            <SelectItem key={m} value={m}>
              {REMISE_MOTIF_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {motif === "parente" && (
        <>
          <p className="text-sm text-muted-foreground">
            Remise fixe de {REMISE_PARENTE}€ appliquée.
          </p>
          <Label className="pt-1.5">Joueur ou joueuse concerné(e)</Label>
          <Select
            value={linkedPlayerId ?? ""}
            onValueChange={(v) => onLinkedPlayerChange(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir un joueur ou une joueuse">
                {(v: string) => {
                  const p = players.find((pl) => pl.id === v);
                  return p ? `${p.nom} ${p.prenom}` : "Choisir";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {players.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Aucun autre joueur enregistré
                </div>
              )}
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom} {p.prenom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linkedError && (
            <p className="text-sm text-destructive">{linkedError}</p>
          )}
        </>
      )}

      {motif === "autre" && (
        <>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Montant de la remise (€)"
            value={remise}
            onChange={(e) => onRemiseChange(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
