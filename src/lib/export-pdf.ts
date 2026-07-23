import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PlayerPdfInfo = {
  nom: string;
  prenom: string;
  sexe: "M" | "F";
  categorie: string;
  dateNaissance: string;
  email: string | null;
  telephone: string | null;
  ville: string | null;
  mute: boolean;
  remiseLabel: string;
  notes: string | null;
  licencePrice: number;
  paid: number;
  solde: number;
  statutLabel: string;
};

export type PaymentPdfRow = {
  date: string;
  mode: string;
  detail: string;
  montant: number;
  statut: string;
  note: string;
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function exportPlayerToPdf(
  player: PlayerPdfInfo,
  payments: PaymentPdfRow[]
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`${player.nom} ${player.prenom}`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Catégorie ${player.categorie} — ${player.statutLabel}`,
    14,
    25
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1 },
    body: [
      ["Date de naissance", player.dateNaissance, "E-mail", player.email ?? "—"],
      ["Téléphone", player.telephone ?? "—", "Ville", player.ville ?? "—"],
      ["Muté", player.mute ? "Oui" : "Non", "Remise", player.remiseLabel],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35 },
      2: { fontStyle: "bold", cellWidth: 35 },
    },
  });

  const afterInfoY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + (player.notes ? 6 : 0);

  if (player.notes) {
    doc.setFontSize(9);
    doc.text(`Notes : ${player.notes}`, 14, afterInfoY);
  }

  autoTable(doc, {
    startY: afterInfoY + (player.notes ? 6 : 4),
    theme: "grid",
    head: [["Prix licence", "Payé", "Solde"]],
    body: [
      [
        eur.format(player.licencePrice),
        eur.format(player.paid),
        eur.format(player.solde),
      ],
    ],
    styles: { fontSize: 10, halign: "center" },
    headStyles: { fillColor: [30, 90, 50] },
  });

  const afterSummaryY = (
    doc as unknown as { lastAutoTable: { finalY: number } }
  ).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text("Historique des paiements", 14, afterSummaryY + 10);

  autoTable(doc, {
    startY: afterSummaryY + 14,
    theme: "striped",
    head: [["Date", "Mode", "Détail", "Montant", "Statut", "Note"]],
    body: payments.map((p) => [
      p.date,
      p.mode,
      p.detail,
      eur.format(p.montant),
      p.statut,
      p.note,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 90, 50] },
  });

  const filename = `fiche-${player.nom}-${player.prenom}.pdf`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");

  doc.save(filename);
}
