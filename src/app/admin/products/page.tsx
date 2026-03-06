import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ProductsManager } from "@/components/admin/products/products-manager";
import { getAdminLang } from "@/lib/admin-preferences";

export default async function ProductsPage() {
  const session = await auth();
  const lang = await getAdminLang();
  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const companyId = session.user.companyId;

  const [categories, customFields] = await Promise.all([
    prisma.productCategory.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.customFieldDefinition.findMany({
      where: { companyId, entityType: "product" },
      orderBy: { label: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          {lang === "fr" ? "Catalogue" : "Catalog"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {lang === "fr" ? "Produits" : "Products"}
        </h1>
        <p className="text-sm text-zinc-500">
          {lang === "fr"
            ? "Gerez les fiches produit, categories et attributs personnalises."
            : "Manage product master data, categories, and custom attributes."}
        </p>
      </div>
      <ProductsManager categories={categories} customFieldDefinitions={customFields} lang={lang} />
    </div>
  );
}
