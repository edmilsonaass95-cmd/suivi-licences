import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const CLUB_NAME = "AAS Sarcelles Football";
export const CLUB_EMAIL = "500695@lpiff.fr";
// Numéro SIRET de l'association, affiché en pied de page (vide = non affiché).
export const CLUB_SIRET = "410 511 687 000 15";

export type InvoiceData = {
  numero: string;
  dateEmission: string;
  saisonLabel: string;
  player: {
    nom: string;
    prenom: string;
    dateNaissance: string;
    categorie: string;
  };
  natureLabel: string;
  licencePrice: number;
  /** Total des règlements encaissés. */
  paid: number;
  /** Date du dernier règlement encaissé (une seule date). */
  dateReglement: string;
};

const PAGE_MARGIN = 15;
const INK: [number, number, number] = [20, 20, 25];
const MUTED: [number, number, number] = [110, 110, 120];
const ACCENT: [number, number, number] = [30, 90, 50];
const WARNING: [number, number, number] = [180, 90, 0];

// Les espaces insécables d'Intl s'affichent mal avec les polices standard du PDF.
function eur(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(value)
    .replace(/[  ]/g, " ");
}

/**
 * Compose la facture acquittée de la licence d'un joueur, destinée à son parent
 * ou représentant légal.
 * `logoDataUrl` : logo du club en PNG (data URL).
 */
export function buildInvoicePdf(data: InvoiceData, logoDataUrl: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightEdge = pageWidth - PAGE_MARGIN;

  const { paid } = data;
  const reste = Math.max(0, Math.round((data.licencePrice - paid) * 100) / 100);
  const acquittee = data.licencePrice > 0 && reste === 0;

  // --- En-tête : logo + nom du club, titre et références à droite ---
  const logoHeight = 28;
  const logoWidth = (logoHeight * 420) / 492;
  doc.addImage(logoDataUrl, "PNG", PAGE_MARGIN, 14, logoWidth, logoHeight, undefined, "FAST");

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(CLUB_NAME, PAGE_MARGIN + logoWidth + 6, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Association sportive de football", PAGE_MARGIN + logoWidth + 6, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text("FACTURE", rightEdge, 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`N° ${data.numero}`, rightEdge, 31, { align: "right" });
  doc.text(`Émise le ${data.dateEmission}`, rightEdge, 36, { align: "right" });

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  doc.line(PAGE_MARGIN, 48, rightEdge, 48);

  // --- Destinataire / joueur concerné ---
  doc.setTextColor(...MUTED);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURÉ À", PAGE_MARGIN, 57);
  doc.text("JOUEUR CONCERNÉ", pageWidth / 2 + 5, 57);

  doc.setTextColor(...INK);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text("Parent / représentant légal de", PAGE_MARGIN, 64);
  doc.text(`${data.player.prenom} ${data.player.nom.toUpperCase()}`, PAGE_MARGIN, 70);

  doc.setFont("helvetica", "bold");
  doc.text(`${data.player.prenom} ${data.player.nom.toUpperCase()}`, pageWidth / 2 + 5, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`Né(e) le ${data.player.dateNaissance}`, pageWidth / 2 + 5, 70);
  doc.text(`Catégorie ${data.player.categorie}`, pageWidth / 2 + 5, 75);

  // --- Formule de reçu ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const statement =
    paid > 0
      ? `${CLUB_NAME} reconnaît avoir reçu la somme de ${eur(paid).replace("€", "euros")} au titre de la licence de ${data.player.prenom} ${data.player.nom.toUpperCase()} pour la saison ${data.saisonLabel}.`
      : `${CLUB_NAME} n'a reçu à ce jour aucun règlement pour la licence de ${data.player.prenom} ${data.player.nom.toUpperCase()} (saison ${data.saisonLabel}).`;
  doc.text(statement, PAGE_MARGIN, 87, { maxWidth: pageWidth - 2 * PAGE_MARGIN });

  // --- Désignation ---
  autoTable(doc, {
    startY: 99,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: "plain",
    head: [["Désignation", "Montant"]],
    body: [
      [
        `Licence de football — saison ${data.saisonLabel}\n${data.natureLabel} · catégorie ${data.player.categorie}`,
        eur(data.licencePrice),
      ],
    ],
    styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: INK },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 35 } },
    didParseCell: (cell) => {
      if (cell.section === "head" && cell.column.index === 1) {
        cell.cell.styles.halign = "right";
      }
    },
  });

  const afterLinesY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;

  // --- Totaux ---
  const totalsX = rightEdge - 80;
  let y = afterLinesY + 8;
  doc.setFontSize(10);
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...INK);
    doc.text(label, totalsX, y);
    doc.text(value, rightEdge, y, { align: "right" });
    y += 6.5;
  };
  totalRow("Total de la licence", eur(data.licencePrice), true);
  totalRow("Total réglé", eur(paid));
  totalRow("Date de règlement", data.dateReglement);
  doc.setDrawColor(200, 200, 205);
  doc.setLineWidth(0.3);
  doc.line(totalsX, y - 3.5, rightEdge, y - 3.5);
  doc.setTextColor(...(acquittee ? ACCENT : WARNING));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text("Reste à payer", totalsX, y + 1);
  doc.text(eur(reste), rightEdge, y + 1, { align: "right" });

  // --- Tampon « ACQUITTÉE » ---
  if (acquittee) {
    doc.saveGraphicsState();
    doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.85 }));
    doc.setDrawColor(...ACCENT);
    doc.setTextColor(...ACCENT);
    doc.setLineWidth(1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    const stampX = PAGE_MARGIN + 38;
    const stampY = afterLinesY + 22;
    doc.text("ACQUITTÉE", stampX, stampY, { align: "center", angle: 8 });
    doc.roundedRect(PAGE_MARGIN + 8, afterLinesY + 8, 60, 20, 2, 2);
    doc.restoreGraphicsState();
  }

  // --- Pied de page ---
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 205);
  doc.setLineWidth(0.3);
  doc.line(PAGE_MARGIN, pageHeight - 28, rightEdge, pageHeight - 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    acquittee
      ? `La présente facture atteste que la licence de ${data.player.prenom} ${data.player.nom.toUpperCase()} pour la saison ${data.saisonLabel} est intégralement réglée.`
      : `La présente facture atteste des règlements reçus à ce jour pour la licence de ${data.player.prenom} ${data.player.nom.toUpperCase()} (saison ${data.saisonLabel}).`,
    PAGE_MARGIN,
    pageHeight - 22,
    { maxWidth: pageWidth - 2 * PAGE_MARGIN }
  );
  doc.text(
    [CLUB_NAME, CLUB_SIRET ? `SIRET : ${CLUB_SIRET}` : "", CLUB_EMAIL]
      .filter(Boolean)
      .join("  ·  "),
    PAGE_MARGIN,
    pageHeight - 14
  );

  return doc;
}
