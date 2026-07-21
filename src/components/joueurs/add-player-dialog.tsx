"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createPlayer } from "@/app/(app)/joueurs/actions";
import {
  playerSchema,
  type PlayerFormInput,
} from "@/lib/joueurs/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    defaultValues: { sexe: "M", licence_price: 0 },
  });

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
            La catégorie est calculée automatiquement à partir de la date de
            naissance.
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
          <div className="space-y-1.5">
            <Label htmlFor="licence_price">Prix de la licence (€)</Label>
            <Input
              id="licence_price"
              type="number"
              step="0.01"
              {...register("licence_price")}
            />
            {errors.licence_price && (
              <p className="text-sm text-destructive">
                {errors.licence_price.message}
              </p>
            )}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" {...register("adresse")} />
          </div>
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
