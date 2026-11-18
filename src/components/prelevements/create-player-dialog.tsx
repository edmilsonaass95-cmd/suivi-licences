"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { createPlayer } from "@/app/(app)/joueurs/actions";
import { getCategorieFFF, getSaisonStart } from "@/lib/categorie-fff";
import { parseDateOnly } from "@/lib/date";
import {
  getLicencePrice,
  isHorsSarcelles,
  NATURES,
  NATURE_LABELS,
  type Nature,
} from "@/lib/joueurs/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

/**
 * « NOM Prénom » (nom en majuscules en tête) -> { nom, prenom }. Faute de mot
 * en majuscules, le premier mot est pris pour le nom.
 */
export function splitNomPrenom(value: string): { nom: string; prenom: string } {
  const words = value.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (
    i < words.length - 1 &&
    words[i] === words[i].toUpperCase() &&
    words[i] !== words[i].toLowerCase()
  ) {
    i++;
  }
  if (i === 0) i = Math.min(1, words.length);
  return { nom: words.slice(0, i).join(" "), prenom: words.slice(i).join(" ") };
}

export type CreatedPlayer = { id: string; nom: string; prenom: string };

/**
 * Création d'un joueur depuis l'import des paiements en ligne : le fichier ne
 * donne que le nom et le prénom, la date de naissance et le sexe sont à saisir.
 */
export function CreatePlayerDialog({
  nomPrenom,
  open,
  onOpenChange,
  onCreated,
}: {
  nomPrenom: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (player: CreatedPlayer) => void;
}) {
  const initial = splitNomPrenom(nomPrenom);
  const [nom, setNom] = useState(initial.nom);
  const [prenom, setPrenom] = useState(initial.prenom);
  const [dateNaissance, setDateNaissance] = useState("");
  const [sexe, setSexe] = useState<"M" | "F">("M");
  const [ville, setVille] = useState("Sarcelles");
  const [nature, setNature] = useState<Nature>("nouvelle_demande");
  const [submitting, setSubmitting] = useState(false);

  const categorie = dateNaissance
    ? getCategorieFFF(parseDateOnly(dateNaissance), sexe, getSaisonStart())
    : "";
  const prix = categorie
    ? getLicencePrice(categorie, sexe, nature, isHorsSarcelles(ville), 0)
    : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createPlayer({
      nom: nom.trim(),
      prenom: prenom.trim(),
      date_naissance: dateNaissance,
      sexe,
      ville: ville.trim(),
      nature,
    });
    setSubmitting(false);

    if (result.error || !result.id) {
      toast.error("Impossible de créer le joueur", {
        description: result.error,
      });
      return;
    }
    toast.success("Joueur créé");
    onCreated({ id: result.id, nom: nom.trim(), prenom: prenom.trim() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer le joueur</DialogTitle>
          <DialogDescription>
            « {nomPrenom} » n&apos;existe pas encore. Le fichier ne contient
            pas la date de naissance : renseigne-la pour calculer la catégorie
            et le prix de la licence.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-nom">Nom</Label>
            <Input
              id="create-nom"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-prenom">Prénom</Label>
            <Input
              id="create-prenom"
              required
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-naissance">Date de naissance</Label>
            <Input
              id="create-naissance"
              type="date"
              required
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sexe</Label>
            <Select value={sexe} onValueChange={(v) => setSexe(v as "M" | "F")}>
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
          <div className="space-y-1.5">
            <Label htmlFor="create-ville">Ville</Label>
            <Input
              id="create-ville"
              required
              value={ville}
              onChange={(e) => setVille(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nature</Label>
            <Select value={nature} onValueChange={(v) => setNature(v as Nature)}>
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
          {prix !== null && (
            <p className="col-span-2 text-sm text-muted-foreground">
              Catégorie {categorie} — Prix de la licence : {eur.format(prix)}
            </p>
          )}
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Création..." : "Créer le joueur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
