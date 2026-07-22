"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ChequeRow = {
  id?: string;
  montant: string;
  date_encaissement: string;
  banque: string;
  numero_cheque: string;
};
export type EcheanceRow = { id?: string; montant: string; date_prelevement: string };

export const emptyCheque: ChequeRow = {
  montant: "",
  date_encaissement: "",
  banque: "",
  numero_cheque: "",
};
export const emptyEcheance: EcheanceRow = { montant: "", date_prelevement: "" };

export function ChequesFields({
  rows,
  onChange,
}: {
  rows: ChequeRow[];
  onChange: (rows: ChequeRow[]) => void;
}) {
  function update(i: number, patch: Partial<ChequeRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Chèques ({rows.length}/4)</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length <= 1}
            onClick={() => onChange(rows.slice(0, -1))}
          >
            <Trash2Icon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length >= 4}
            onClick={() => onChange([...rows, emptyCheque])}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2"
        >
          <div className="space-y-1">
            <Label className="text-xs">Montant (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={row.montant}
              onChange={(e) => update(i, { montant: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">N° du chèque</Label>
            <Input
              value={row.numero_cheque}
              onChange={(e) => update(i, { numero_cheque: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date d&apos;encaissement</Label>
            <Input
              type="date"
              required
              value={row.date_encaissement}
              onChange={(e) =>
                update(i, { date_encaissement: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Banque</Label>
            <Input
              value={row.banque}
              onChange={(e) => update(i, { banque: e.target.value })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EcheancesFields({
  rows,
  onChange,
}: {
  rows: EcheanceRow[];
  onChange: (rows: EcheanceRow[]) => void;
}) {
  function update(i: number, patch: Partial<EcheanceRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Échéances ({rows.length}/4)</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length <= 1}
            onClick={() => onChange(rows.slice(0, -1))}
          >
            <Trash2Icon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length >= 4}
            onClick={() => onChange([...rows, emptyEcheance])}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2"
        >
          <div className="space-y-1">
            <Label className="text-xs">Montant (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={row.montant}
              onChange={(e) => update(i, { montant: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date du prélèvement</Label>
            <Input
              type="date"
              required
              value={row.date_prelevement}
              onChange={(e) =>
                update(i, { date_prelevement: e.target.value })
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
