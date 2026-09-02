import "server-only";

const defaultEditors = [
  "ignacio@grupo-aftermarket.com",
  "etelias@grupo-aftermarket.com",
  "jpajon@grupo-aftermarket.com",
];

function parseEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPortalEditor(email: string | null | undefined) {
  if (!email) return false;
  const editors = parseEmails(process.env.PORTAL_EDITOR_EMAILS);
  return (editors.length > 0 ? editors : defaultEditors).includes(email.toLowerCase());
}

export function isPortalUserAllowed(email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();
  const allowedEmails = parseEmails(process.env.PORTAL_ALLOWED_EMAILS);

  if (allowedEmails.length > 0) return allowedEmails.includes(normalizedEmail);

  const domain = (process.env.PORTAL_ALLOWED_DOMAIN ?? "grupo-aftermarket.com").toLowerCase();
  return normalizedEmail.endsWith(`@${domain}`);
}
