export function isSuperAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowList = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.trim().toLowerCase());
}
