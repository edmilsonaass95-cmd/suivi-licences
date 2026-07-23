"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";

import { getPaymentsForExport } from "@/app/(app)/joueurs/actions";
import { PAYMENT_MODE_LABELS, type PaymentFormValues } from "@/lib/joueurs/schemas";
import { formatDateFr } from "@/lib/date";
import { exportToExcel, todayStamp } from "@/lib/export-xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODE_OPTIONS = Object.entries(PAYMENT_MODE_LABELS) as [
  PaymentFormValues["mode"],
  string,
][];

export function ExportPaymentsDialog({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("tous");
  const [categorie, setCategorie] = useState("toutes");
  const [genre, setGenre] = useState("tous");

  async function handleExport() {
    setLoading(true);
    const result = await getPaymentsForExport({ mode, categorie, genre });
    setLoading(false);

    if ("error" in result) {
      toast.error("Export impossible", { description: result.error });
      return;
    }

    const exportRows = result.rows.map((p) => ({
      Joueur: p.joueur,
      Genre: p.sexe ?? "",
      Catégorie: p.categorie ?? "",
      Mode: PAYMENT_MODE_LABELS[p.mode as PaymentFormValues["mode"]],
      "Montant (€)": p.amount,
      Date: formatDateFr(p.created_at),
      Note: p.note ?? "",
    }));

    exportToExcel(`paiements-${todayStamp()}.xlsx`, "Paiements", exportRows);
    toast.success("Export généré");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <DownloadIcon />
        Exporter les paiements
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter les paiements</DialogTitle>
          <DialogDescription>
            Choisissez les critères de l&apos;export.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mode de paiement</Label>
            <Select value={mode} onValueChange={(v) => setMode(v ?? "tous")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v === "tous"
                      ? "Tous les modes"
                      : PAYMENT_MODE_LABELS[v as PaymentFormValues["mode"]]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les modes</SelectItem>
                {MODE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={categorie}
              onValueChange={(v) => setCategorie(v ?? "toutes")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === "toutes" ? "Toutes catégories" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={(v) => setGenre(v ?? "tous")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v === "tous" ? "Tous genres" : v === "M" ? "Masculin" : "Féminin"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous genres</SelectItem>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={loading} onClick={handleExport}>
            {loading ? "Export..." : "Générer l'export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
