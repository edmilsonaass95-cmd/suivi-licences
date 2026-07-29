"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { addNextSaison, setSaisonSelectionnee } from "@/app/(app)/dashboard/actions";
import { saisonLabel } from "@/lib/saison-selection";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SeasonSelector({
  saisons,
  selected,
  canAddSaison,
}: {
  saisons: number[];
  selected: number;
  canAddSaison: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function handleChange(value: string | null) {
    if (!value) return;
    const result = await setSaisonSelectionnee(Number(value));
    if (result.error) {
      toast.error("Impossible de changer de saison", {
        description: result.error,
      });
      return;
    }
    router.refresh();
  }

  async function handleAdd() {
    setAdding(true);
    const result = await addNextSaison();
    setAdding(false);
    if ("error" in result) {
      toast.error("Impossible d'ajouter la saison", {
        description: result.error,
      });
      return;
    }
    toast.success(`Saison ${saisonLabel(result.saisonStart)} ajoutée`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={String(selected)} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue>{() => `Saison ${saisonLabel(selected)}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {saisons.map((s) => (
            <SelectItem key={s} value={String(s)}>
              Saison {saisonLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canAddSaison && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={adding}
          onClick={handleAdd}
          title="Ajouter la saison suivante"
        >
          <PlusIcon />
        </Button>
      )}
    </div>
  );
}
