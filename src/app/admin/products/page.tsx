import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ProductsManager } from "@/components/admin/products/products-manager";

export default async function ProductsPage() {
  const session = await auth();
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
        <p className="text-sm uppercase tracking-wide text-zinc-500">Catalog</p>
        <h1 className="text-3xl font-semibold text-zinc-900">Products</h1>
        <p className="text-sm text-zinc-500">
          Manage product master data, categories, and custom attributes.
        </p>
      </div>
      <ProductsManager categories={categories} customFieldDefinitions={customFields} />
    </div>
  );
}
