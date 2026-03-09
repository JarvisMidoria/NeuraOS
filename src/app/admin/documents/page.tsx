import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAdminLang } from "@/lib/admin-preferences";

type Row = {
  id: string;
  code: string;
  counterpart: string;
  date: Date;
  hrefClean: string;
  hrefCompact: string;
  hrefSource: string;
};

type SectionText = {
  templates: string;
  clean: string;
  compact: string;
  openSource: string;
  empty: string;
  counterpart: string;
  date: string;
};

function ActionLink({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
      aria-label={label}
      title={label}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {external ? (
          <>
            <path d="M14 4H20V10" />
            <path d="M10 14L20 4" />
            <path d="M20 14V18A2 2 0 0 1 18 20H6A2 2 0 0 1 4 18V6A2 2 0 0 1 6 4H10" />
          </>
        ) : (
          <>
            <path d="M12 3V15" />
            <path d="M7 10L12 15L17 10" />
            <path d="M4 20H20" />
          </>
        )}
      </svg>
    </Link>
  );
}

function DocumentsSection({
  label,
  rows,
  text,
  locale,
}: {
  label: string;
  rows: Row[];
  text: SectionText;
  locale: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">{label}</h2>
        <span className="text-xs text-zinc-500">
          {text.templates}: {text.clean} / {text.compact}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{text.empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-zinc-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{row.code}</p>
                  <p className="text-xs text-zinc-500">
                    {text.counterpart}: {row.counterpart}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {text.date}: {row.date.toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ActionLink href={row.hrefSource} label={text.openSource} />
                  <ActionLink href={row.hrefClean} label={text.clean} external />
                  <ActionLink href={row.hrefCompact} label={text.compact} external />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminDocumentsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.companyId || !user.permissions?.includes("VIEW_DASHBOARD")) {
    notFound();
  }

  const lang = await getAdminLang();
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  const [quotes, orders, purchases] = await Promise.all([
    prisma.salesQuote.findMany({
      where: { companyId: user.companyId },
      orderBy: { quoteDate: "desc" },
      take: 10,
      select: {
        id: true,
        quoteNumber: true,
        quoteDate: true,
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.salesOrder.findMany({
      where: { companyId: user.companyId },
      orderBy: { orderDate: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId: user.companyId },
      orderBy: { orderDate: "desc" },
      take: 10,
      select: {
        id: true,
        poNumber: true,
        orderDate: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
  ]);

  const quoteRows: Row[] = quotes.map((quote) => ({
    id: quote.id,
    code: `Q-${quote.quoteNumber.toString().padStart(4, "0")}`,
    counterpart: quote.client.name,
    date: quote.quoteDate,
    hrefClean: `/api/documents/sales-quotes/${quote.id}/pdf?template=clean`,
    hrefCompact: `/api/documents/sales-quotes/${quote.id}/pdf?template=compact`,
    hrefSource: `/admin/sales/quotes?clientId=${encodeURIComponent(quote.client.id)}`,
  }));

  const orderRows: Row[] = orders.map((order) => ({
    id: order.id,
    code: `SO-${order.orderNumber.toString().padStart(4, "0")}`,
    counterpart: order.client.name,
    date: order.orderDate,
    hrefClean: `/api/documents/sales-orders/${order.id}/delivery-note?template=clean`,
    hrefCompact: `/api/documents/sales-orders/${order.id}/delivery-note?template=compact`,
    hrefSource: `/admin/sales/orders?clientId=${encodeURIComponent(order.client.id)}`,
  }));

  const purchaseRows: Row[] = purchases.map((order) => ({
    id: order.id,
    code: `PO-${order.poNumber.toString().padStart(4, "0")}`,
    counterpart: order.supplier.name,
    date: order.orderDate,
    hrefClean: `/api/documents/purchase-orders/${order.id}/pdf?template=clean`,
    hrefCompact: `/api/documents/purchase-orders/${order.id}/pdf?template=compact`,
    hrefSource: "/admin/purchases/orders",
  }));

  const text = {
    title: lang === "fr" ? "Documents PDF" : "PDF Documents",
    subtitle:
      lang === "fr"
        ? "Generation de devis, bons de livraison et bons de commande via templates."
        : "Generate quotes, delivery notes, and purchase orders using templates.",
    templates: lang === "fr" ? "Templates" : "Templates",
    clean: lang === "fr" ? "Clean" : "Clean",
    compact: lang === "fr" ? "Compact" : "Compact",
    openSource: lang === "fr" ? "Ouvrir source" : "Open source",
    quotes: lang === "fr" ? "Devis" : "Sales Quotes",
    delivery: lang === "fr" ? "Bons de livraison" : "Delivery Notes",
    purchases: lang === "fr" ? "Bons de commande" : "Purchase Orders",
    empty: lang === "fr" ? "Aucun document pour le moment." : "No documents yet.",
    counterpart: lang === "fr" ? "Contrepartie" : "Counterparty",
    date: lang === "fr" ? "Date" : "Date",
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">{text.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{text.subtitle}</p>
      </section>

      <DocumentsSection label={text.quotes} rows={quoteRows} text={text} locale={locale} />
      <DocumentsSection label={text.delivery} rows={orderRows} text={text} locale={locale} />
      <DocumentsSection label={text.purchases} rows={purchaseRows} text={text} locale={locale} />
    </div>
  );
}
