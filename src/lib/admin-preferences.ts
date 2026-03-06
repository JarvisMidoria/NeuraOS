import { cookies } from "next/headers";

export type AdminLang = "en" | "fr";

export async function getAdminLang(): Promise<AdminLang> {
  const cookieStore = await cookies();
  return cookieStore.get("neura_lang")?.value === "fr" ? "fr" : "en";
}
