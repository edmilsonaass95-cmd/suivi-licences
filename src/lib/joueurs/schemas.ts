import { z } from "zod";

export const playerSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire"),
  prenom: z.string().min(1, "Le prénom est obligatoire"),
  date_naissance: z.string().min(1, "La date de naissance est obligatoire"),
  sexe: z.enum(["M", "F"]),
  email: z.string().email("E-mail invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  mute: z.boolean().default(false),
  hors_sarcelles: z.boolean().default(false),
  notes: z.string().optional(),
});

export type PlayerFormValues = z.output<typeof playerSchema>;
export type PlayerFormInput = z.input<typeof playerSchema>;

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
