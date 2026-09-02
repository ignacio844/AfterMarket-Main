import "server-only";

// Autorizaciones versionadas del portal. Estos valores no son secretos y se
// modifican aquí cuando cambian los usuarios o el dominio habilitado.
const portalAllowedDomain = "grupo-aftermarket.com";

// Si esta lista contiene correos, reemplaza la autorización general por dominio.
const portalAllowedEmails: string[] = [];

const portalEditors = [
  "ignacio@grupo-aftermarket.com",
  "etelias@grupo-aftermarket.com",
  "jpajon@grupo-aftermarket.com",
];

export function isPortalEditor(email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();
  return portalEditors.some((editor) => editor.toLowerCase() === normalizedEmail);
}

export function isPortalUserAllowed(email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();

  if (portalAllowedEmails.length > 0) {
    return portalAllowedEmails.some((allowedEmail) => allowedEmail.toLowerCase() === normalizedEmail);
  }

  return normalizedEmail.endsWith(`@${portalAllowedDomain.toLowerCase()}`);
}
