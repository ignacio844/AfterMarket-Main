import "server-only";

// Autorizaciones versionadas del portal. Estos valores no son secretos y se
// modifican aquí cuando cambian los usuarios o el dominio habilitado.
const portalAllowedDomain = "grupo-aftermarket.com";

// Si esta lista contiene correos, reemplaza la autorización general por dominio.
const portalAllowedEmails: string[] = [];

// Accesos individuales fuera del dominio corporativo.
const externalPortalUsers = [
  "marcos@distrimar.com.ar",
];

const portalEditors = [
  "ignacio@grupo-aftermarket.com",
  "etelias@grupo-aftermarket.com",
  "jpajon@grupo-aftermarket.com",
];

const executiveViewers = [
  "ignacio@grupo-aftermarket.com",
  "etelias@grupo-aftermarket.com",
  "marcos@distrimar.com.ar",
];

function includesNormalizedEmail(emails: readonly string[], email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return emails.some((allowedEmail) => allowedEmail.toLowerCase() === normalizedEmail);
}

export function isPortalEditor(email: string | null | undefined) {
  return includesNormalizedEmail(portalEditors, email);
}

export function isExecutiveViewer(email: string | null | undefined) {
  return includesNormalizedEmail(executiveViewers, email);
}

export function isPortalUserAllowed(email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();

  if (includesNormalizedEmail(externalPortalUsers, normalizedEmail)) return true;

  if (portalAllowedEmails.length > 0) {
    return portalAllowedEmails.some((allowedEmail) => allowedEmail.toLowerCase() === normalizedEmail);
  }

  return normalizedEmail.endsWith(`@${portalAllowedDomain.toLowerCase()}`);
}
