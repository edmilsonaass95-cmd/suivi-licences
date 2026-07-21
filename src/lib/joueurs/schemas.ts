import { z } from "zod";

export const remiseMotifs = ["aucune", "parente", "autre"] as const;
export type RemiseMotif = (typeof remiseMotifs)[number];

export const REMISE_MOTIF_LABELS: Record<RemiseMotif, string> = {
  aucune: "Aucune",
  parente: "Lien de parenté",
  autre: "Autre",
};

const remiseFields = {
  remise_motif: z.enum(remiseMotifs).default("aucune"),
  remise: z.coerce.number().nonnegative("Le montant doit être positif ou nul").default(0),
};

function checkRemise(
  data: { remise_motif: RemiseMotif; remise: number },
  ctx: z.RefinementCtx
) {
  if (data.remise_motif === "autre" && data.remise <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["remise"],
      message: "Indique le montant de la remise",
    });
  }
}

const playerBaseSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire"),
  prenom: z.string().min(1, "Le prénom est obligatoire"),
  date_naissance: z.string().min(1, "La date de naissance est obligatoire"),
  sexe: z.enum(["M", "F"]),
  email: z.string().email("E-mail invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  ville: z.string().min(1, "La ville est obligatoire"),
  mute: z.boolean().default(false),
  ...remiseFields,
  notes: z.string().optional(),
});

export const playerSchema = playerBaseSchema.superRefine(checkRemise);

export type PlayerFormValues = z.output<typeof playerSchema>;
export type PlayerFormInput = z.input<typeof playerSchema>;

export const playerEditSchema = z
  .object({
    email: playerBaseSchema.shape.email,
    telephone: playerBaseSchema.shape.telephone,
    ville: playerBaseSchema.shape.ville,
    ...remiseFields,
  })
  .superRefine(checkRemise);

export type PlayerEditFormValues = z.output<typeof playerEditSchema>;
export type PlayerEditFormInput = z.input<typeof playerEditSchema>;

const montantPositif = z.coerce.number().positive("Le montant doit être positif");

export const chequeItemSchema = z.object({
  montant: montantPositif,
  date_encaissement: z.string().min(1, "Date obligatoire"),
  banque: z.string().optional(),
});

export const echeanceItemSchema = z.object({
  montant: montantPositif,
  date_prelevement: z.string().min(1, "Date obligatoire"),
});

const simpleModeSchema = z.object({
  amount: montantPositif,
  note: z.string().optional(),
});

export const paymentSchema = z.discriminatedUnion("mode", [
  simpleModeSchema.extend({ mode: z.literal("espece") }),
  simpleModeSchema.extend({ mode: z.literal("virement") }),
  simpleModeSchema.extend({ mode: z.literal("labaz") }),
  simpleModeSchema.extend({ mode: z.literal("pass_aglo") }),
  simpleModeSchema.extend({ mode: z.literal("pass_sport") }),
  z.object({
    mode: z.literal("cheque"),
    note: z.string().optional(),
    cheques: z.array(chequeItemSchema).min(1).max(4),
  }),
  z.object({
    mode: z.literal("prelevement"),
    note: z.string().optional(),
    echeances: z.array(echeanceItemSchema).min(1).max(4),
  }),
]);

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const PAYMENT_MODE_LABELS: Record<PaymentFormValues["mode"], string> = {
  espece: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  prelevement: "Prélèvement en ligne",
  labaz: "Labaz",
  pass_aglo: "Pass Aglo",
  pass_sport: "Pass Sport",
};

export const DEFAULT_AMOUNT_BY_MODE: Partial<
  Record<PaymentFormValues["mode"], number>
> = {
  labaz: 100,
  pass_aglo: 60,
  pass_sport: 70,
};
