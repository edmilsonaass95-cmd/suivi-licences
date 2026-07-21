"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { updatePlayer } from "@/app/(app)/joueurs/actions";
import {
  playerEditSchema,
  type PlayerEditFormInput,
  type RemiseMotif,
} from "@/lib/joueurs/schemas";
import {
  getLicencePrice,
  isHorsSarcelles,
  resolveRemise,
} from "@/lib/joueurs/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RemiseFields } from "@/components/joueurs/remise-fields";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function EditPlayerDialog({
  playerId,
  categorie,
  mute,
  initial,
}: {
  playerId: string;
  categorie: string;
  mute: boolean;
  initial: {
    email: string | null;
    telephone: string | null;
    ville: string;
    remise: number;
    remise_motif: "parente" | "autre" | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlayerEditFormInput>({
    resolver: zodResolver(playerEditSchema),
    defaultValues: {
      email: initial.email ?? "",
      telephone: initial.telephone ?? "",
      ville: initial.ville,
      remise_motif: initial.remise_motif ?? "aucune",
      remise: initial.remise_motif === "autre" ? initial.remise : 0,
    },
  });

  const ville = watch("ville");
  const remiseMotif = (watch("remise_motif") ?? "aucune") as RemiseMotif;
  const remise = watch("remise") ?? 0;
  const horsSarcelles = isHorsSarcelles(ville ?? "");
  const prix = getLicencePrice(
    categorie,
    mute,
    horsSarcelles,
    resolveRemise(remiseMotif, Number(remise))
  );

  const onSubmit = async (values: PlayerEditFormInput) => {
    const result = await updatePlayer(playerId, values);
    if (result.error) {
      toast.error("Impossible de modifier le joueur", {
        description: result.error,
      });
      return;
    }
    toast.success("Joueur modifié");
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PencilIcon />
        Modifier
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le joueur</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-2 gap-3"
        >
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

          <div className="col-span-2 rounded-lg bg-muted p-3 text-sm">
            Nouveau prix de la licence : <strong>{eur.format(prix)}</strong>
          </div>

          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
