const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function relanceEmailHtml({
  nom,
  prenom,
  categorie,
  solde,
}: {
  nom: string;
  prenom: string;
  categorie: string;
  solde: number;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <p>Bonjour ${escapeHtml(prenom)},</p>
      <p>
        Nous vous rappelons qu'il reste un solde de
        <strong>${eur.format(solde)}</strong> à régler pour votre licence.
      </p>
      <table style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 2px 12px 2px 0; color: #71717a;">Nom</td>
          <td style="padding: 2px 0;"><strong>${escapeHtml(nom.toUpperCase())}</strong></td>
        </tr>
        <tr>
          <td style="padding: 2px 12px 2px 0; color: #71717a;">Prénom</td>
          <td style="padding: 2px 0;"><strong>${escapeHtml(prenom)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 2px 12px 2px 0; color: #71717a;">Catégorie</td>
          <td style="padding: 2px 0;"><strong>${escapeHtml(categorie)}</strong></td>
        </tr>
      </table>
      <p>Merci de procéder au règlement auprès du club dans les meilleurs délais.</p>
      <p>Cordialement,<br />Le club</p>
    </div>
  `;
}
