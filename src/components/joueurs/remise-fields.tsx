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

export function RemiseFields({
  motif,
  remise,
  onMotifChange,
  onRemiseChange,
  error,
}: {
  motif: RemiseMotif;
  remise: number | string;
  onMotifChange: (motif: RemiseMotif) => void;
  onRemiseChange: (value: string) => void;
  error?: string;
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
        <p className="text-sm text-muted-foreground">
          Remise fixe de {REMISE_PARENTE}€ appliquée.
        </p>
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
