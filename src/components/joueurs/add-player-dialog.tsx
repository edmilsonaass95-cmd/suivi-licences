"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createPlayer } from "@/app/(app)/joueurs/actions";
import { playerSchema, type PlayerFormInput } from "@/lib/joueurs/schemas";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import {
  getLicencePrice,
  isHorsSarcelles,
  resolveRemise,
} from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RemiseFields } from "@/components/joueurs/remise-fields";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function AddPlayerDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlayerFormInput>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      sexe: "M",
      mute: false,
      ville: "Sarcelles",
      remise_motif: "aucune",
      remise: 0,
    },
  });

  const dateNaissance = watch("date_naissance");
  const sexe = watch("sexe");
  const mute = watch("mute");
  const ville = watch("ville");
  const remiseMotif = watch("remise_motif") ?? "aucune";
  const remise = watch("remise") ?? 0;
  const horsSarcelles = isHorsSarcelles(ville ?? "");

  let preview: { categorie: string; prix: number } | null = null;
  if (dateNaissance) {
    const categorie = getCategorieFFF(
      parseDateOnly(dateNaissance),
      sexe,
      getSaisonStart()
    );
    preview = {
      categorie,
      prix: getLicencePrice(
        categorie,
        !!mute,
        horsSarcelles,
        resolveRemise(remiseMotif, Number(remise))
      ),
    };
  }

  const onSubmit = async (values: PlayerFormInput) => {
    const result = await createPlayer(values);
    if (result.error) {
      toast.error("Impossible d'ajouter le joueur", {
        description: result.error,
      });
      return;
    }
    toast.success("Joueur ajouté");
    reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Ajouter un joueur
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un joueur</DialogTitle>
          <DialogDescription>
            La catégorie et le prix de la licence sont calculés
            automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-2 gap-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" {...register("nom")} />
            {errors.nom && (
              <p className="text-sm text-destructive">{errors.nom.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prenom">Prénom</Label>
            <Input id="prenom" {...register("prenom")} />
            {errors.prenom && (
              <p className="text-sm text-destructive">
                {errors.prenom.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_naissance">Date de naissance</Label>
            <Input
              id="date_naissance"
              type="date"
              {...register("date_naissance")}
            />
            {errors.date_naissance && (
              <p className="text-sm text-destructive">
                {errors.date_naissance.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Sexe</Label>
            <Select
              value={watch("sexe")}
              onValueChange={(v) => setValue("sexe", v as "M" | "F")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === "F" ? "Féminin" : "Masculin")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input id="telephone" {...register("telephone")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ville">Ville</Label>
            <Input id="ville" {...register("ville")} />
            {errors.ville && (
              <p className="text-sm text-destructive">
                {errors.ville.message}
              </p>
            )}
            {ville && horsSarcelles && (
              <p className="text-sm text-muted-foreground">
                Hors Sarcelles : +20€ appliqués automatiquement.
              </p>
            )}
          </div>

          <div className="col-span-2 flex flex-col gap-2 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!mute}
                onCheckedChange={(checked) =>
                  setValue("mute", checked === true)
                }
              />
              Joueur muté (transféré d&apos;un autre club)
            </label>
          </div>

          <RemiseFields
            motif={remiseMotif}
            remise={remise as number}
            onMotifChange={(m) => {
              setValue("remise_motif", m);
              if (m !== "autre") setValue("remise", 0);
            }}
            onRemiseChange={(v) => setValue("remise", v as unknown as number)}
            error={errors.remise?.message}
          />

          {preview && (
            <div className="col-span-2 rounded-lg bg-muted p-3 text-sm">
              Catégorie <strong>{preview.categorie}</strong> — prix de la
              licence : <strong>{eur.format(preview.prix)}</strong>
            </div>
          )}

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ajout..." : "Ajouter le joueur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
