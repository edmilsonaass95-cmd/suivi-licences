const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function relanceEmailHtml(prenom: string, solde: number) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <p>Bonjour ${prenom},</p>
      <p>
        Nous vous rappelons qu'il reste un solde de
        <strong>${eur.format(solde)}</strong> à régler pour votre licence.
      </p>
      <p>Merci de procéder au règlement auprès du club dans les meilleurs délais.</p>
      <p>Cordialement,<br />Le club</p>
    </div>
  `;
}
