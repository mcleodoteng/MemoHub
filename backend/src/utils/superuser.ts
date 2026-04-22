const DEFAULT_SUPERUSER_EMAILS = ["mcleod.oteng5@gmail.com"];

function getConfiguredSuperuserEmails() {
  const configured =
    process.env.SUPERUSER_EMAILS || process.env.SUPER_ADMIN_EMAILS;
  if (!configured) return DEFAULT_SUPERUSER_EMAILS;

  return configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperuserEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getConfiguredSuperuserEmails().includes(normalized);
}

export function resolveEffectiveRole(
  role?: string | null,
  email?: string | null,
) {
  if (isSuperuserEmail(email)) return "super_admin";
  return role || "member";
}
