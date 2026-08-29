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
  NATURE_LABELS,
  NATURES,
  NIVEAU_LABELS,
  NIVEAUX,
  resolveRemise,
  type Nature,
  type Niveau,
} from "@/lib/joueurs/pricing";
import { parseDateOnly } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RemiseFields, type PlayerOption } from "@/components/joueurs/remise-fields";
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

export function AddPlayerDialog({ players }: { players: PlayerOption[] }) {
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
      nature: "renouvellement",
      niveau: "standard",
      ville: "Sarcelles",
      remise_motif: "aucune",
      remise: 0,
      remise_lien_joueur_id: "",
    },
  });

  const dateNaissance = watch("date_naissance");
  const sexe = watch("sexe");
  const nature = (watch("nature") ?? "renouvellement") as Nature;
  const niveau = (watch("niveau") ?? "standard") as Niveau;
  const ville = watch("ville");
  const remiseMotif = watch("remise_motif") ?? "aucune";
  const remise = watch("remise") ?? 0;
  const remiseLienJoueurId = watch("remise_lien_joueur_id");
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
        sexe,
        nature,
        horsSarcelles,
        resolveRemise(remiseMotif, Number(remise)),
        niveau
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

          <div className="col-span-2 space-y-1.5">
            <Label>Nature</Label>
            <Select
              value={nature}
              onValueChange={(v) => setValue("nature", v as Nature)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => NATURE_LABELS[v as Nature]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NATURES.map((n) => (
                  <SelectItem key={n} value={n}>
                    {NATURE_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Niveau</Label>
            <Select
              value={niveau}
              onValueChange={(v) => setValue("niveau", v as Niveau)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => NIVEAU_LABELS[v as Niveau]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NIVEAUX.map((n) => (
                  <SelectItem key={n} value={n}>
                    {NIVEAU_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RemiseFields
            motif={remiseMotif}
            remise={remise as number}
            onMotifChange={(m) => {
              setValue("remise_motif", m);
              if (m !== "autre") setValue("remise", 0);
              if (m !== "parente") setValue("remise_lien_joueur_id", "");
            }}
            onRemiseChange={(v) => setValue("remise", v as unknown as number)}
            error={errors.remise?.message}
            players={players}
            linkedPlayerId={remiseLienJoueurId}
            onLinkedPlayerChange={(id) =>
              setValue("remise_lien_joueur_id", id)
            }
            linkedError={errors.remise_lien_joueur_id?.message}
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
