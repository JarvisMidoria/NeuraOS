"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ALLOWED_CURRENCY_CODES } from "@/lib/currency";
import { ActionButton } from "../action-button";
import { AdminInlineAlert } from "../admin-inline-alert";
import { AdminToolbarInput, AdminToolbarSelect } from "../admin-toolbar";

type CompanySettings = {
  id: string;
  name: string;
  domain: string | null;
  currencyCode: string;
  productUnitMode: "GLOBAL" | "PER_PRODUCT";
  defaultProductUnit: "EA" | "M" | "L" | "KG";
  locale: string;
  timezone: string;
};

type LlmSettings = {
  configured: boolean;
  accessMode: "SHARED" | "BYOK";
  provider: "OPENAI" | "OPENAI_COMPATIBLE";
  baseUrl: string;
  defaultModel: string;
  isEnabled: boolean;
  keyHint: string | null;
  sharedAvailable: boolean;
  usage: {
    period: "month";
    consumedTokens: number;
    monthlyLimitTokens: number | null;
    remainingTokens: number | null;
  };
};

type MessagingSettings = {
  companyId: string;
  whatsappEnabled: boolean;
  whatsappPhoneNumber: string;
  whatsappBusinessAccountId: string;
  whatsappAccessTokenHint: string | null;
  whatsappWebhookUrl: string;
  whatsappVerifyToken: string;
  telegramEnabled: boolean;
  telegramBotUsername: string;
  telegramBotTokenHint: string | null;
};

type TaxRule = {
  id: string;
  code: string;
  label: string;
  rate: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type StockRule = {
  id: string;
  allowNegativeStock: boolean;
  defaultLowStockThreshold: string | null;
};

type Permission = {
  id: string;
  code: string;
  description: string | null;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: Permission[];
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: Array<{ id: string; name: string }>;
};

type CustomField = {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
};

type SettingsSectionKey =
  | "company"
  | "ai"
  | "messaging"
  | "stock"
  | "tax"
  | "roles"
  | "users"
  | "customFields";

type QuickAction = {
  key: string;
  title: string;
  description: string;
  section: SettingsSectionKey;
  label: string;
};

const FIELD_CLASS = "h-11 px-3 text-sm";
const SECTION_CARD_CLASS = "liquid-surface rounded-2xl p-5 sm:p-6";
const SURFACE_CARD_CLASS = "liquid-surface rounded-xl p-4";
const PILL_CLASS =
  "inline-flex items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-soft-bg)] px-2.5 py-1 text-xs text-[var(--admin-muted)]";
const LABEL_CLASS = "text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--admin-muted)]";

const PRODUCT_UNIT_OPTIONS = [
  { value: "EA", en: "Units (EA)", fr: "Unites (EA)" },
  { value: "M", en: "Meters (M)", fr: "Metres (M)" },
  { value: "L", en: "Liters (L)", fr: "Litres (L)" },
  { value: "KG", en: "Kilograms (KG)", fr: "Kilogrammes (KG)" },
] as const;

const ENTITY_TYPE_OPTIONS = [
  { value: "product", label: "Product" },
  { value: "client", label: "Client" },
  { value: "supplier", label: "Supplier" },
  { value: "sales_order", label: "Sales order" },
  { value: "purchase_order", label: "Purchase order" },
] as const;

function t(lang: "en" | "fr", en: string, fr: string) {
  return lang === "fr" ? fr : en;
}

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString();
}

function formatRate(rate: string | null) {
  if (!rate) return "-";
  return `${rate}%`;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body as T;
}

function StatusPill({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return <span className={selected ? `${PILL_CLASS} liquid-selected text-[var(--admin-text)]` : PILL_CLASS}>{children}</span>;
}

function SettingsMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className={SURFACE_CARD_CLASS}>
      <p className={LABEL_CLASS}>{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--admin-text)]">{value}</p>
      {helper ? <p className="mt-1 text-sm text-[var(--admin-muted)]">{helper}</p> : null}
    </div>
  );
}

function SettingsField({
  label,
  helper,
  children,
  className = "",
}: {
  label: string;
  helper?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`.trim()}>
      <span className={LABEL_CLASS}>{label}</span>
      {children}
      {helper ? <span className="text-xs text-[var(--admin-muted)]">{helper}</span> : null}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={SURFACE_CARD_CLASS}>
      <p className={LABEL_CLASS}>{label}</p>
      <p className="mt-2 break-all text-sm text-[var(--admin-text)]">{value || "-"}</p>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  label,
  onClick,
}: {
  title: string;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className={`${SURFACE_CARD_CLASS} flex h-full flex-col justify-between gap-4`}>
      <div>
        <p className="text-sm font-semibold text-[var(--admin-text)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
      </div>
      <ActionButton icon="right" label={label} onClick={onClick} className="w-fit" />
    </div>
  );
}

type SettingsSectionProps = {
  sectionId: SettingsSectionKey;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  toggleOpenLabel: string;
  toggleCloseLabel: string;
  children: ReactNode;
};

function SettingsSection({
  sectionId,
  title,
  subtitle,
  meta,
  isOpen,
  onToggle,
  toggleOpenLabel,
  toggleCloseLabel,
  children,
}: SettingsSectionProps) {
  return (
    <section id={`settings-${sectionId}`} className={SECTION_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
            {meta}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-[var(--admin-muted)]">{subtitle}</p> : null}
        </div>
        <ActionButton
          type="button"
          size="icon"
          icon={isOpen ? "close" : "plus"}
          onClick={onToggle}
          label={isOpen ? toggleCloseLabel : toggleOpenLabel}
          iconOnly
          title={isOpen ? toggleCloseLabel : toggleOpenLabel}
        />
      </div>
      {isOpen ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export function SettingsConsole({ lang = "en" }: { lang?: "en" | "fr" }) {
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [messagingSettings, setMessagingSettings] = useState<MessagingSettings | null>(null);
  const [stockRule, setStockRule] = useState<StockRule | null>(null);
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    domain: "",
    currencyCode: "USD",
    productUnitMode: "PER_PRODUCT" as "GLOBAL" | "PER_PRODUCT",
    defaultProductUnit: "EA" as "EA" | "M" | "L" | "KG",
    locale: "en-US",
    timezone: "UTC",
  });
  const [llmForm, setLlmForm] = useState({
    accessMode: "SHARED" as "SHARED" | "BYOK",
    provider: "OPENAI" as "OPENAI" | "OPENAI_COMPATIBLE",
    baseUrl: "",
    defaultModel: "gpt-4o-mini",
    isEnabled: false,
    apiKey: "",
  });
  const [messagingForm, setMessagingForm] = useState({
    whatsappEnabled: false,
    whatsappPhoneNumber: "",
    whatsappBusinessAccountId: "",
    whatsappAccessToken: "",
    telegramEnabled: false,
    telegramBotUsername: "",
    telegramBotToken: "",
  });
  const [taxForm, setTaxForm] = useState({
    code: "",
    label: "",
    rate: "20",
    isDefault: false,
    isActive: true,
  });
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissionIds: [] as string[],
  });
  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    password: "",
    roleIds: [] as string[],
    isActive: true,
  });
  const [fieldForm, setFieldForm] = useState({
    entityType: "product",
    fieldKey: "",
    label: "",
    fieldType: "text",
    isRequired: false,
  });
  const [openSections, setOpenSections] = useState<Record<SettingsSectionKey, boolean>>({
    company: true,
    ai: false,
    messaging: false,
    stock: false,
    tax: false,
    roles: false,
    users: false,
    customFields: false,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        companyRes,
        llmRes,
        messagingRes,
        stockRes,
        taxesRes,
        permsRes,
        rolesRes,
        usersRes,
        fieldsRes,
      ] = await Promise.all([
        fetch("/api/settings/company"),
        fetch("/api/settings/llm"),
        fetch("/api/settings/messaging"),
        fetch("/api/settings/stock-rules"),
        fetch("/api/settings/taxes"),
        fetch("/api/settings/permissions"),
        fetch("/api/settings/roles"),
        fetch("/api/settings/users"),
        fetch("/api/settings/custom-fields"),
      ]);

      const companyBody = await jsonOrThrow<{ data: CompanySettings }>(companyRes);
      const llmBody = await jsonOrThrow<{ data: LlmSettings }>(llmRes);
      const messagingBody = await jsonOrThrow<{ data: MessagingSettings }>(messagingRes);
      const stockBody = await jsonOrThrow<{ data: StockRule }>(stockRes);
      const taxesBody = await jsonOrThrow<{ data: TaxRule[] }>(taxesRes);
      const permsBody = await jsonOrThrow<{ data: Permission[] }>(permsRes);
      const rolesBody = await jsonOrThrow<{ data: Role[] }>(rolesRes);
      const usersBody = await jsonOrThrow<{ data: UserRow[] }>(usersRes);
      const fieldsBody = await jsonOrThrow<{ data: CustomField[] }>(fieldsRes);

      setCompanyForm({
        name: companyBody.data.name,
        domain: companyBody.data.domain ?? "",
        currencyCode: companyBody.data.currencyCode,
        productUnitMode: companyBody.data.productUnitMode,
        defaultProductUnit: companyBody.data.defaultProductUnit,
        locale: companyBody.data.locale,
        timezone: companyBody.data.timezone,
      });
      setLlmSettings(llmBody.data);
      setLlmForm({
        accessMode: llmBody.data.accessMode,
        provider: llmBody.data.provider,
        baseUrl: llmBody.data.baseUrl,
        defaultModel: llmBody.data.defaultModel,
        isEnabled: llmBody.data.isEnabled,
        apiKey: "",
      });
      setMessagingSettings(messagingBody.data);
      setMessagingForm({
        whatsappEnabled: messagingBody.data.whatsappEnabled,
        whatsappPhoneNumber: messagingBody.data.whatsappPhoneNumber,
        whatsappBusinessAccountId: messagingBody.data.whatsappBusinessAccountId,
        whatsappAccessToken: "",
        telegramEnabled: messagingBody.data.telegramEnabled,
        telegramBotUsername: messagingBody.data.telegramBotUsername,
        telegramBotToken: "",
      });
      setStockRule(stockBody.data);
      setTaxes(taxesBody.data);
      setPermissions(permsBody.data);
      setRoles(rolesBody.data);
      setUsers(usersBody.data);
      setCustomFields(fieldsBody.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to load settings", "Impossible de charger les parametres"));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!llmSettings || llmSettings.sharedAvailable) return;
    setLlmForm((prev) =>
      prev.accessMode === "SHARED" && prev.isEnabled ? { ...prev, isEnabled: false } : prev,
    );
  }, [llmSettings]);

  const sectionLabels = useMemo(
    () => ({
      show: t(lang, "Show section", "Afficher la section"),
      hide: t(lang, "Hide section", "Masquer la section"),
    }),
    [lang],
  );

  const roleOptions = useMemo(
    () => roles.map((role) => ({ id: role.id, name: role.name })),
    [roles],
  );

  const openSection = useCallback((section: SettingsSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [section]: true }));
    window.setTimeout(() => {
      document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const toggleSection = useCallback((section: SettingsSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const sharedUnavailable = Boolean(llmSettings && !llmSettings.sharedAvailable);
  const usedPct = useMemo(() => {
    if (!llmSettings?.usage.monthlyLimitTokens) return 0;
    const pct = (llmSettings.usage.consumedTokens / llmSettings.usage.monthlyLimitTokens) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }, [llmSettings]);

  const recommendedActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [];

    if (!companyForm.domain.trim()) {
      actions.push({
        key: "domain",
        title: t(lang, "Set your workspace domain", "Definir le domaine de l'espace"),
        description: t(lang, "A domain makes the workspace identifiable for your team and customers.", "Un domaine rend l'espace identifiable pour votre equipe et vos clients."),
        section: "company",
        label: t(lang, "Open workspace defaults", "Ouvrir l'espace"),
      });
    }

    if (!llmSettings?.isEnabled) {
      actions.push({
        key: "ai",
        title: t(lang, "Activate the AI copilot", "Activer le copilote IA"),
        description: t(lang, "Turn on shared AI or connect your own provider so uploads and assistant flows are ready.", "Activez l'IA partagee ou connectez votre fournisseur pour preparer les imports et le copilote."),
        section: "ai",
        label: t(lang, "Open AI settings", "Ouvrir l'IA"),
      });
    }

    if (users.length <= 1) {
      actions.push({
        key: "users",
        title: t(lang, "Invite your team", "Inviter l'equipe"),
        description: t(lang, "Create the first additional users so operations are not blocked on one admin account.", "Creez les premiers utilisateurs supplementaires pour ne pas bloquer les operations sur un seul admin."),
        section: "users",
        label: t(lang, "Open team access", "Ouvrir l'equipe"),
      });
    }

    if (taxes.length === 0) {
      actions.push({
        key: "taxes",
        title: t(lang, "Add your first tax rule", "Ajouter une premiere taxe"),
        description: t(lang, "Taxes are required before quotes and orders are reliable for finance operations.", "Les taxes sont necessaires pour fiabiliser les devis et commandes cote finance."),
        section: "tax",
        label: t(lang, "Open taxes", "Ouvrir les taxes"),
      });
    }

    if (!messagingSettings?.whatsappEnabled && !messagingSettings?.telegramEnabled) {
      actions.push({
        key: "messaging",
        title: t(lang, "Connect at least one messaging channel", "Connecter un canal de messagerie"),
        description: t(lang, "WhatsApp or Telegram lets the copilot receive files and operational requests outside the web app.", "WhatsApp ou Telegram permet au copilote de recevoir des fichiers et demandes hors de l'app web."),
        section: "messaging",
        label: t(lang, "Open channels", "Ouvrir les canaux"),
      });
    }

    if (stockRule && !stockRule.defaultLowStockThreshold) {
      actions.push({
        key: "stock",
        title: t(lang, "Set a default stock threshold", "Definir un seuil de stock"),
        description: t(lang, "A default threshold makes stock alerts immediately useful across new products.", "Un seuil par defaut rend les alertes stock utiles des les nouveaux produits."),
        section: "stock",
        label: t(lang, "Open inventory defaults", "Ouvrir le stock"),
      });
    }

    return actions.slice(0, 4);
  }, [companyForm.domain, lang, llmSettings?.isEnabled, messagingSettings?.telegramEnabled, messagingSettings?.whatsappEnabled, stockRule, taxes.length, users.length]);

  const updateCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        name: companyForm.name,
        domain: companyForm.domain,
        currencyCode: companyForm.currencyCode,
        productUnitMode: companyForm.productUnitMode,
        defaultProductUnit: companyForm.defaultProductUnit,
        locale: companyForm.locale,
        timezone: companyForm.timezone,
      };
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await jsonOrThrow<{ data: CompanySettings }>(res);
      setStatus(t(lang, "Workspace defaults updated", "Parametres de l'espace mis a jour"));
      await fetchAll();
      window.dispatchEvent(new Event("neura:company-settings-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to update company", "Impossible de mettre a jour l'entreprise"));
    }
  };

  const updateLlm = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(llmForm),
      });
      await jsonOrThrow<{ data: LlmSettings }>(res);
      setStatus(t(lang, "AI settings updated", "Parametres IA mis a jour"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to update AI settings", "Impossible de mettre a jour l'IA"));
    }
  };

  const updateMessaging = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/messaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messagingForm),
      });
      await jsonOrThrow<{ data: MessagingSettings }>(res);
      setStatus(t(lang, "Messaging settings updated", "Parametres messaging mis a jour"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to update messaging settings", "Impossible de mettre a jour la messagerie"));
    }
  };

  const testLlm = async () => {
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/llm/test", { method: "POST" });
      const body = await jsonOrThrow<{
        data: {
          output: string;
          provider: string;
          model: string;
          accessMode: "SHARED" | "BYOK";
          sharedQuota?: { used: number; limit: number } | null;
        };
      }>(res);
      const quotaPart = body.data.sharedQuota
        ? ` · ${t(lang, "shared quota", "quota partagee")} ${body.data.sharedQuota.used}/${body.data.sharedQuota.limit}`
        : "";
      setStatus(
        `${t(lang, "AI connection OK", "Connexion IA OK")} (${body.data.accessMode} ${body.data.provider}/${body.data.model})${quotaPart}: ${body.data.output}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to test AI settings", "Impossible de tester l'IA"));
    }
  };

  const deleteLlm = async () => {
    if (!window.confirm(t(lang, "Remove AI provider configuration?", "Supprimer la configuration IA ?"))) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/llm", { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus(t(lang, "AI configuration removed", "Configuration IA supprimee"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to remove AI settings", "Impossible de supprimer l'IA"));
    }
  };

  const updateStockRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stockRule) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/stock-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowNegativeStock: stockRule.allowNegativeStock,
          defaultLowStockThreshold:
            stockRule.defaultLowStockThreshold === "" ? null : stockRule.defaultLowStockThreshold,
        }),
      });
      await jsonOrThrow<{ data: StockRule }>(res);
      setStatus(t(lang, "Inventory defaults updated", "Regles stock mises a jour"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to update stock rules", "Impossible de mettre a jour le stock"));
    }
  };

  const createTax = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taxForm),
      });
      await jsonOrThrow<{ data: TaxRule }>(res);
      setTaxForm({ code: "", label: "", rate: "20", isDefault: false, isActive: true });
      setStatus(t(lang, "Tax rule created", "Taxe creee"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to create tax rule", "Impossible de creer la taxe"));
    }
  };

  const toggleTax = async (tax: TaxRule, updates: Partial<TaxRule>) => {
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/taxes/${tax.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await jsonOrThrow<{ data: TaxRule }>(res);
      setStatus(t(lang, "Tax rule updated", "Taxe mise a jour"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to update tax rule", "Impossible de mettre a jour la taxe"));
    }
  };

  const deleteTax = async (taxId: string) => {
    if (!window.confirm(t(lang, "Delete this tax rule?", "Supprimer cette taxe ?"))) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/taxes/${taxId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus(t(lang, "Tax rule deleted", "Taxe supprimee"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to delete tax rule", "Impossible de supprimer la taxe"));
    }
  };

  const createRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm),
      });
      await jsonOrThrow<{ data: Role }>(res);
      setRoleForm({ name: "", description: "", permissionIds: [] });
      setStatus(t(lang, "Role created", "Role cree"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to create role", "Impossible de creer le role"));
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!window.confirm(t(lang, "Delete this role?", "Supprimer ce role ?"))) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/roles/${roleId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus(t(lang, "Role deleted", "Role supprime"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to delete role", "Impossible de supprimer le role"));
    }
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      await jsonOrThrow<{ data: UserRow }>(res);
      setUserForm({ email: "", name: "", password: "", roleIds: [], isActive: true });
      setStatus(t(lang, "User created", "Utilisateur cree"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to create user", "Impossible de creer l'utilisateur"));
    }
  };

  const patchUser = async (userId: string, payload: Record<string, unknown>) => {
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await jsonOrThrow<{ data: UserRow }>(res);
      setStatus(t(lang, "User updated", "Utilisateur mis a jour"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to update user", "Impossible de mettre a jour l'utilisateur"));
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm(t(lang, "Delete this user?", "Supprimer cet utilisateur ?"))) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/users/${userId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus(t(lang, "User deleted", "Utilisateur supprime"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to delete user", "Impossible de supprimer l'utilisateur"));
    }
  };

  const createCustomField = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldForm),
      });
      await jsonOrThrow<{ data: CustomField }>(res);
      setFieldForm({ entityType: "product", fieldKey: "", label: "", fieldType: "text", isRequired: false });
      setStatus(t(lang, "Custom field created", "Champ personnalise cree"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to create custom field", "Impossible de creer le champ"));
    }
  };

  const deleteCustomField = async (fieldId: string) => {
    if (!window.confirm(t(lang, "Delete this custom field?", "Supprimer ce champ personnalise ?"))) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/custom-fields/${fieldId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus(t(lang, "Custom field deleted", "Champ personnalise supprime"));
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "Failed to delete custom field", "Impossible de supprimer le champ"));
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`${SECTION_CARD_CLASS} min-h-32 animate-pulse`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {status ? <AdminInlineAlert tone="success">{status}</AdminInlineAlert> : null}
      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={LABEL_CLASS}>{t(lang, "Workspace overview", "Vue d'ensemble")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">
              {t(lang, "Control the essentials first", "Piloter l'essentiel d'abord")}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {t(
                lang,
                "This page surfaces the few settings that impact day-to-day operations, then keeps secondary administration below.",
                "Cette page met en avant les quelques reglages qui impactent le quotidien, puis laisse l'administration secondaire en dessous.",
              )}
            </p>
          </div>
          <ActionButton icon="refresh" label={t(lang, "Refresh data", "Actualiser")} onClick={fetchAll} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SettingsMetricCard
            label={t(lang, "Workspace", "Espace")}
            value={companyForm.name || "-"}
            helper={
              companyForm.domain
                ? `${companyForm.domain} · ${companyForm.currencyCode}`
                : `${t(lang, "No domain yet", "Pas encore de domaine")} · ${companyForm.currencyCode}`
            }
          />
          <SettingsMetricCard
            label={t(lang, "AI copilot", "Copilote IA")}
            value={
              llmSettings?.isEnabled
                ? llmSettings.accessMode === "SHARED"
                  ? t(lang, "Shared AI active", "IA partagee active")
                  : t(lang, "BYOK active", "BYOK actif")
                : t(lang, "Disabled", "Desactive")
            }
            helper={llmSettings ? `${llmSettings.provider} · ${llmSettings.defaultModel}` : "-"}
          />
          <SettingsMetricCard
            label={t(lang, "Messaging", "Messagerie")}
            value={
              messagingSettings?.whatsappEnabled || messagingSettings?.telegramEnabled
                ? t(lang, "Channels connected", "Canaux connectes")
                : t(lang, "No channel connected", "Aucun canal connecte")
            }
            helper={`WhatsApp ${messagingSettings?.whatsappEnabled ? "ON" : "OFF"} · Telegram ${messagingSettings?.telegramEnabled ? "ON" : "OFF"}`}
          />
          <SettingsMetricCard
            label={t(lang, "Team & structure", "Equipe et structure")}
            value={`${users.length} ${t(lang, "users", "utilisateurs")}`}
            helper={`${roles.length} ${t(lang, "roles", "roles")} · ${taxes.length} ${t(lang, "tax rules", "taxes")}`}
          />
        </div>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={LABEL_CLASS}>{t(lang, "Recommended next steps", "Prochaines actions")}</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--admin-text)]">
              {t(lang, "Remove friction for the team", "Retirer les frictions pour l'equipe")}
            </h2>
          </div>
          {recommendedActions.length === 0 ? (
            <StatusPill selected>{t(lang, "Core setup complete", "Base de configuration complete")}</StatusPill>
          ) : null}
        </div>

        {recommendedActions.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {recommendedActions.map((action) => (
              <QuickActionCard
                key={action.key}
                title={action.title}
                description={action.description}
                label={action.label}
                onClick={() => openSection(action.section)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-[var(--admin-text)]">
            {t(
              lang,
              "The workspace is configured enough for day-to-day use. Only secondary administration remains below.",
              "L'espace est suffisamment configure pour l'usage quotidien. Il ne reste que l'administration secondaire ci-dessous.",
            )}
          </div>
        )}
      </section>

      <SettingsSection
        sectionId="company"
        title={t(lang, "Workspace defaults", "Parametres de l'espace")}
        subtitle={t(
          lang,
          "Keep this block focused on identity, currency and unit defaults. These are the settings users feel first.",
          "Gardez ce bloc concentre sur l'identite, la devise et les unites par defaut. Ce sont les reglages les plus visibles pour les utilisateurs.",
        )}
        meta={<StatusPill>{companyForm.currencyCode}</StatusPill>}
        isOpen={openSections.company}
        onToggle={() => toggleSection("company")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <form onSubmit={updateCompany} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <SettingsField label={t(lang, "Workspace name", "Nom de l'espace")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={companyForm.name}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t(lang, "Workspace name", "Nom de l'espace")}
              />
            </SettingsField>
            <SettingsField label={t(lang, "Domain", "Domaine")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={companyForm.domain}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, domain: e.target.value }))}
                placeholder={t(lang, "workspace.example.com", "espace.exemple.com")}
              />
            </SettingsField>
            <SettingsField label={t(lang, "Currency", "Devise")}>
              <AdminToolbarSelect
                className={FIELD_CLASS}
                value={companyForm.currencyCode}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, currencyCode: e.target.value }))}
              >
                {ALLOWED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </AdminToolbarSelect>
            </SettingsField>
            <SettingsField label={t(lang, "Unit mode", "Mode d'unite")}>
              <AdminToolbarSelect
                className={FIELD_CLASS}
                value={companyForm.productUnitMode}
                onChange={(e) =>
                  setCompanyForm((prev) => ({
                    ...prev,
                    productUnitMode: e.target.value as "GLOBAL" | "PER_PRODUCT",
                  }))
                }
              >
                <option value="PER_PRODUCT">{t(lang, "Per product", "Par produit")}</option>
                <option value="GLOBAL">{t(lang, "Single unit for all products", "Unite unique pour tous les produits")}</option>
              </AdminToolbarSelect>
            </SettingsField>
            <SettingsField
              label={t(lang, "Default unit", "Unite par defaut")}
              helper={t(
                lang,
                "Applied automatically if the workspace uses a single unit for all products.",
                "Appliquee automatiquement si l'espace utilise une unite unique pour tous les produits.",
              )}
            >
              <AdminToolbarSelect
                className={FIELD_CLASS}
                value={companyForm.defaultProductUnit}
                onChange={(e) =>
                  setCompanyForm((prev) => ({
                    ...prev,
                    defaultProductUnit: e.target.value as "EA" | "M" | "L" | "KG",
                  }))
                }
              >
                {PRODUCT_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {lang === "fr" ? option.fr : option.en}
                  </option>
                ))}
              </AdminToolbarSelect>
            </SettingsField>
            <SettingsField label={t(lang, "Locale", "Locale")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={companyForm.locale}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, locale: e.target.value }))}
                placeholder="en-US"
              />
            </SettingsField>
            <SettingsField label={t(lang, "Timezone", "Fuseau horaire")} className="md:col-span-2">
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={companyForm.timezone}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </SettingsField>
          </div>

          <div className="grid gap-4 content-start">
            <div className={SURFACE_CARD_CLASS}>
              <p className={LABEL_CLASS}>{t(lang, "Current behavior", "Comportement actuel")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill selected>{companyForm.currencyCode}</StatusPill>
                <StatusPill selected={companyForm.productUnitMode === "GLOBAL"}>
                  {companyForm.productUnitMode === "GLOBAL"
                    ? t(lang, "Global unit mode", "Mode unite global")
                    : t(lang, "Per-product unit mode", "Mode unite par produit")}
                </StatusPill>
                <StatusPill>{companyForm.defaultProductUnit}</StatusPill>
              </div>
              <p className="mt-3 text-sm text-[var(--admin-muted)]">
                {companyForm.productUnitMode === "GLOBAL"
                  ? t(
                      lang,
                      "Every product inherits the default unit automatically. Use this when operations must stay standardized.",
                      "Chaque produit herite automatiquement de l'unite par defaut. Utilisez ce mode si l'operationnel doit rester standardise.",
                    )
                  : t(
                      lang,
                      "Each product can keep its own unit. Use this when your catalog mixes units like pieces, meters or kilograms.",
                      "Chaque produit garde sa propre unite. Utilisez ce mode si votre catalogue melange pieces, metres ou kilogrammes.",
                    )}
              </p>
            </div>
            <div className="flex justify-start">
              <ActionButton type="submit" tone="primary" icon="save" label={t(lang, "Save workspace defaults", "Enregistrer l'espace")} />
            </div>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        sectionId="ai"
        title={t(lang, "AI copilot", "Copilote IA")}
        subtitle={t(
          lang,
          "Shared AI for plug-and-play usage, or BYOK for teams that want their own provider.",
          "IA partagee pour un usage immediat, ou BYOK pour les equipes qui veulent leur propre fournisseur.",
        )}
        meta={
          <StatusPill selected={Boolean(llmSettings?.isEnabled)}>
            {llmSettings?.isEnabled ? t(lang, "Enabled", "Active") : t(lang, "Disabled", "Desactive")}
          </StatusPill>
        }
        isOpen={openSections.ai}
        onToggle={() => toggleSection("ai")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4 content-start">
            <div className="grid gap-4 md:grid-cols-3">
              <SettingsMetricCard
                label={t(lang, "Used this month", "Utilises ce mois")}
                value={formatNumber(llmSettings?.usage.consumedTokens)}
              />
              <SettingsMetricCard
                label={t(lang, "Monthly limit", "Limite mensuelle")}
                value={
                  llmSettings?.usage.monthlyLimitTokens === null
                    ? t(lang, "BYOK", "BYOK")
                    : formatNumber(llmSettings?.usage.monthlyLimitTokens)
                }
              />
              <SettingsMetricCard
                label={t(lang, "Tokens left", "Tokens restants")}
                value={
                  llmSettings?.usage.remainingTokens === null
                    ? "N/A"
                    : formatNumber(llmSettings?.usage.remainingTokens)
                }
              />
            </div>
            {llmSettings?.usage.monthlyLimitTokens !== null ? (
              <div className={SURFACE_CARD_CLASS}>
                <div className="flex items-center justify-between gap-3">
                  <p className={LABEL_CLASS}>{t(lang, "Monthly usage", "Usage mensuel")}</p>
                  <span className="text-sm font-semibold text-[var(--admin-text)]">{usedPct}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--admin-soft-bg)_70%,transparent)]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usedPct >= 90 ? "bg-rose-500" : usedPct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {sharedUnavailable ? (
              <AdminInlineAlert tone="warning">
                {t(
                  lang,
                  "Shared AI is not available on the platform yet. Use BYOK until the shared provider is online.",
                  "L'IA partagee n'est pas encore disponible sur la plateforme. Utilisez BYOK jusqu'a l'activation du fournisseur partage.",
                )}
              </AdminInlineAlert>
            ) : null}
          </div>

          <form onSubmit={updateLlm} className="grid gap-4 content-start">
            <div className="grid gap-4 md:grid-cols-2">
              <label className={`${SURFACE_CARD_CLASS} cursor-pointer ${llmForm.accessMode === "SHARED" ? "liquid-selected" : ""} ${sharedUnavailable ? "opacity-60" : ""}`.trim()}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="llm-mode"
                    checked={llmForm.accessMode === "SHARED"}
                    onChange={() => setLlmForm((prev) => ({ ...prev, accessMode: "SHARED" }))}
                    disabled={sharedUnavailable}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-text)]">
                      {t(lang, "NeuraOS Shared AI", "IA partagee NeuraOS")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-muted)]">
                      {t(lang, "No API key required for the tenant.", "Aucune cle API a fournir par le tenant.")}
                    </p>
                  </div>
                </div>
              </label>
              <label className={`${SURFACE_CARD_CLASS} cursor-pointer ${llmForm.accessMode === "BYOK" ? "liquid-selected" : ""}`.trim()}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="llm-mode"
                    checked={llmForm.accessMode === "BYOK"}
                    onChange={() => setLlmForm((prev) => ({ ...prev, accessMode: "BYOK" }))}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-text)]">
                      {t(lang, "Bring your own key", "Utiliser sa propre cle")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-muted)]">
                      {t(lang, "Connect OpenAI or any OpenAI-compatible provider.", "Connectez OpenAI ou tout fournisseur compatible OpenAI.")}
                    </p>
                  </div>
                </div>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField label={t(lang, "Provider", "Fournisseur")}>
                <AdminToolbarSelect
                  className={FIELD_CLASS}
                  value={llmForm.provider}
                  onChange={(e) =>
                    setLlmForm((prev) => ({
                      ...prev,
                      provider: e.target.value as "OPENAI" | "OPENAI_COMPATIBLE",
                    }))
                  }
                  disabled={llmForm.accessMode !== "BYOK"}
                >
                  <option value="OPENAI">OpenAI</option>
                  <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
                </AdminToolbarSelect>
              </SettingsField>
              <SettingsField label={t(lang, "Default model", "Modele par defaut")}>
                <AdminToolbarInput
                  className={FIELD_CLASS}
                  value={llmForm.defaultModel}
                  onChange={(e) => setLlmForm((prev) => ({ ...prev, defaultModel: e.target.value }))}
                  placeholder="gpt-4o-mini"
                  disabled={llmForm.accessMode !== "BYOK"}
                />
              </SettingsField>
              <SettingsField
                label={t(lang, "Base URL", "Base URL")}
                helper={t(
                  lang,
                  "Required only for OpenAI-compatible providers.",
                  "Necessaire uniquement pour les fournisseurs compatibles OpenAI.",
                )}
                className="md:col-span-2"
              >
                <AdminToolbarInput
                  className={FIELD_CLASS}
                  value={llmForm.baseUrl}
                  onChange={(e) => setLlmForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://openrouter.ai/api/v1"
                  disabled={llmForm.accessMode !== "BYOK"}
                />
              </SettingsField>
              <SettingsField label={t(lang, "API key", "Cle API")} className="md:col-span-2">
                <AdminToolbarInput
                  className={FIELD_CLASS}
                  value={llmForm.apiKey}
                  onChange={(e) => setLlmForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={
                    llmSettings?.keyHint
                      ? `${t(lang, "Current key", "Cle actuelle")} : ${llmSettings.keyHint}`
                      : t(lang, "Paste provider key", "Coller la cle fournisseur")
                  }
                  disabled={llmForm.accessMode !== "BYOK"}
                />
              </SettingsField>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-text)]">
              <input
                type="checkbox"
                checked={llmForm.isEnabled}
                onChange={(e) => setLlmForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                disabled={sharedUnavailable && llmForm.accessMode === "SHARED"}
              />
              {t(lang, "Enable AI provider", "Activer le fournisseur IA")}
            </label>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                type="submit"
                tone="primary"
                icon="save"
                disabled={sharedUnavailable && llmForm.accessMode === "SHARED" && llmForm.isEnabled}
                label={t(lang, "Save AI settings", "Enregistrer l'IA")}
              />
              <ActionButton type="button" icon="refresh" onClick={testLlm} label={t(lang, "Test connection", "Tester la connexion")} />
              <ActionButton type="button" tone="danger" icon="delete" onClick={deleteLlm} label={t(lang, "Remove config", "Supprimer la config")}
              />
            </div>
          </form>
        </div>
      </SettingsSection>

      <SettingsSection
        sectionId="messaging"
        title={t(lang, "Messaging channels", "Canaux de messagerie")}
        subtitle={t(
          lang,
          "Connect WhatsApp and Telegram so the copilot can receive files and commands outside the app.",
          "Connectez WhatsApp et Telegram pour que le copilote recoive des fichiers et commandes hors de l'application.",
        )}
        meta={
          <StatusPill selected={Boolean(messagingSettings?.whatsappEnabled || messagingSettings?.telegramEnabled)}>
            {messagingSettings?.whatsappEnabled || messagingSettings?.telegramEnabled
              ? t(lang, "Connected", "Connecte")
              : t(lang, "Not connected", "Non connecte")}
          </StatusPill>
        }
        isOpen={openSections.messaging}
        onToggle={() => toggleSection("messaging")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <form onSubmit={updateMessaging} className="grid gap-5 xl:grid-cols-2">
          <div className={`${SURFACE_CARD_CLASS} grid gap-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">WhatsApp</p>
                <p className="text-sm text-[var(--admin-muted)]">
                  {t(lang, "Receive files, messages and operational requests.", "Recevoir des fichiers, messages et demandes operationnelles.")}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-text)]">
                <input
                  type="checkbox"
                  checked={messagingForm.whatsappEnabled}
                  onChange={(e) => setMessagingForm((prev) => ({ ...prev, whatsappEnabled: e.target.checked }))}
                />
                {t(lang, "Enable", "Activer")}
              </label>
            </div>
            <SettingsField label={t(lang, "Phone number", "Numero de telephone")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={messagingForm.whatsappPhoneNumber}
                onChange={(e) => setMessagingForm((prev) => ({ ...prev, whatsappPhoneNumber: e.target.value }))}
                placeholder="+212600000000"
              />
            </SettingsField>
            <SettingsField label={t(lang, "Business account ID", "Business account ID")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={messagingForm.whatsappBusinessAccountId}
                onChange={(e) => setMessagingForm((prev) => ({ ...prev, whatsappBusinessAccountId: e.target.value }))}
                placeholder="1234567890"
              />
            </SettingsField>
            <SettingsField label={t(lang, "Access token", "Token d'acces")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={messagingForm.whatsappAccessToken}
                onChange={(e) => setMessagingForm((prev) => ({ ...prev, whatsappAccessToken: e.target.value }))}
                placeholder={
                  messagingSettings?.whatsappAccessTokenHint
                    ? `${t(lang, "Current token", "Token actuel")} : ${messagingSettings.whatsappAccessTokenHint}`
                    : t(lang, "Paste WhatsApp token", "Coller le token WhatsApp")
                }
              />
            </SettingsField>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label={t(lang, "Webhook URL", "Webhook URL")} value={messagingSettings?.whatsappWebhookUrl ?? ""} />
              <ReadOnlyField label={t(lang, "Verify token", "Verify token")} value={messagingSettings?.whatsappVerifyToken ?? ""} />
            </div>
          </div>

          <div className={`${SURFACE_CARD_CLASS} grid gap-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">Telegram</p>
                <p className="text-sm text-[var(--admin-muted)]">
                  {t(lang, "Offer a fast text-based operational channel for the copilot.", "Offrir un canal operationnel texte rapide au copilote.")}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-text)]">
                <input
                  type="checkbox"
                  checked={messagingForm.telegramEnabled}
                  onChange={(e) => setMessagingForm((prev) => ({ ...prev, telegramEnabled: e.target.checked }))}
                />
                {t(lang, "Enable", "Activer")}
              </label>
            </div>
            <SettingsField label={t(lang, "Bot username", "Nom du bot")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={messagingForm.telegramBotUsername}
                onChange={(e) => setMessagingForm((prev) => ({ ...prev, telegramBotUsername: e.target.value }))}
                placeholder="textico_copilot"
              />
            </SettingsField>
            <SettingsField label={t(lang, "Bot token", "Token du bot")}>
              <AdminToolbarInput
                className={FIELD_CLASS}
                value={messagingForm.telegramBotToken}
                onChange={(e) => setMessagingForm((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
                placeholder={
                  messagingSettings?.telegramBotTokenHint
                    ? `${t(lang, "Current token", "Token actuel")} : ${messagingSettings.telegramBotTokenHint}`
                    : t(lang, "Paste Telegram token", "Coller le token Telegram")
                }
              />
            </SettingsField>
            <div className="pt-1">
              <ActionButton type="submit" tone="primary" icon="save" label={t(lang, "Save channels", "Enregistrer les canaux")} />
            </div>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        sectionId="stock"
        title={t(lang, "Inventory defaults", "Regles de stock")}
        subtitle={t(
          lang,
          "Keep the inventory engine predictable for every new product and warehouse flow.",
          "Gardez le moteur de stock previsible pour chaque nouveau produit et chaque mouvement d'entrepot.",
        )}
        meta={<StatusPill>{stockRule?.allowNegativeStock ? t(lang, "Negative stock allowed", "Stock negatif autorise") : t(lang, "Negative stock blocked", "Stock negatif bloque")}</StatusPill>}
        isOpen={openSections.stock}
        onToggle={() => toggleSection("stock")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        {stockRule ? (
          <form onSubmit={updateStockRule} className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
            <div className="grid gap-4 md:grid-cols-2">
              <label className={`${SURFACE_CARD_CLASS} inline-flex items-start gap-3`}>
                <input
                  type="checkbox"
                  checked={stockRule.allowNegativeStock}
                  onChange={(e) =>
                    setStockRule((prev) =>
                      prev ? { ...prev, allowNegativeStock: e.target.checked } : prev,
                    )
                  }
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                    {t(lang, "Allow negative stock", "Autoriser le stock negatif")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">
                    {t(
                      lang,
                      "Use only if operations accept temporary stock gaps during asynchronous updates.",
                      "A utiliser uniquement si l'operationnel accepte des ecarts de stock temporaires pendant les mises a jour asynchrones.",
                    )}
                  </p>
                </div>
              </label>
              <SettingsField
                label={t(lang, "Default low-stock threshold", "Seuil de stock faible par defaut")}
                helper={t(
                  lang,
                  "Applied to new products unless a product-specific threshold overrides it.",
                  "Applique aux nouveaux produits sauf si un seuil specifique produit le remplace.",
                )}
              >
                <AdminToolbarInput
                  className={FIELD_CLASS}
                  value={stockRule.defaultLowStockThreshold ?? ""}
                  onChange={(e) =>
                    setStockRule((prev) =>
                      prev ? { ...prev, defaultLowStockThreshold: e.target.value } : prev,
                    )
                  }
                  placeholder="100"
                />
              </SettingsField>
            </div>
            <ActionButton type="submit" tone="primary" icon="save" label={t(lang, "Save inventory defaults", "Enregistrer le stock")} />
          </form>
        ) : null}
      </SettingsSection>

      <SettingsSection
        sectionId="tax"
        title={t(lang, "Tax rules", "Taxes")}
        subtitle={t(
          lang,
          "Keep tax creation lightweight, then manage the active/default rules from the list.",
          "Gardez la creation de taxe legere, puis gerez les regles actives et par defaut depuis la liste.",
        )}
        meta={<StatusPill>{`${taxes.length} ${t(lang, "rules", "regles")}`}</StatusPill>}
        isOpen={openSections.tax}
        onToggle={() => toggleSection("tax")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={createTax} className={`${SURFACE_CARD_CLASS} grid gap-4 content-start`}>
            <p className="text-sm font-semibold text-[var(--admin-text)]">{t(lang, "Add a tax rule", "Ajouter une taxe")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField label={t(lang, "Code", "Code")}>
                <AdminToolbarInput className={FIELD_CLASS} value={taxForm.code} onChange={(e) => setTaxForm((prev) => ({ ...prev, code: e.target.value }))} placeholder="VAT20" />
              </SettingsField>
              <SettingsField label={t(lang, "Label", "Libelle")}>
                <AdminToolbarInput className={FIELD_CLASS} value={taxForm.label} onChange={(e) => setTaxForm((prev) => ({ ...prev, label: e.target.value }))} placeholder={t(lang, "VAT 20%", "TVA 20%")}
                />
              </SettingsField>
              <SettingsField label={t(lang, "Rate", "Taux")}>
                <AdminToolbarInput className={FIELD_CLASS} type="number" step="0.001" value={taxForm.rate} onChange={(e) => setTaxForm((prev) => ({ ...prev, rate: e.target.value }))} placeholder="20" />
              </SettingsField>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-text)]">
                  <input type="checkbox" checked={taxForm.isDefault} onChange={(e) => setTaxForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
                  {t(lang, "Set as default", "Mettre par defaut")}
                </label>
              </div>
            </div>
            <div>
              <ActionButton type="submit" tone="primary" icon="plus" label={t(lang, "Create tax rule", "Creer la taxe")} />
            </div>
          </form>

          <div className="grid gap-3 content-start">
            {taxes.length === 0 ? (
              <div className={`${SURFACE_CARD_CLASS} text-sm text-[var(--admin-muted)]`}>
                {t(lang, "No tax rule yet.", "Aucune taxe pour le moment.")}
              </div>
            ) : (
              taxes.map((tax) => (
                <article key={tax.id} className={SURFACE_CARD_CLASS}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-text)]">{tax.label}</p>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">{tax.code} · {formatRate(tax.rate)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tax.isDefault ? <StatusPill selected>{t(lang, "Default", "Par defaut")}</StatusPill> : null}
                      <StatusPill>{tax.isActive ? t(lang, "Active", "Active") : t(lang, "Inactive", "Inactive")}</StatusPill>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!tax.isDefault ? (
                      <ActionButton size="sm" icon="apply" onClick={() => toggleTax(tax, { isDefault: true })} label={t(lang, "Set default", "Par defaut")} />
                    ) : null}
                    <ActionButton
                      size="sm"
                      icon={tax.isActive ? "close" : "apply"}
                      onClick={() => toggleTax(tax, { isActive: !tax.isActive })}
                      label={tax.isActive ? t(lang, "Disable", "Desactiver") : t(lang, "Enable", "Activer")}
                    />
                    <ActionButton size="sm" tone="danger" icon="delete" onClick={() => deleteTax(tax.id)} label={t(lang, "Delete", "Supprimer")} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        sectionId="roles"
        title={t(lang, "Access roles", "Roles d'acces")}
        subtitle={t(
          lang,
          "Keep role creation simple, then expand permissions only where the operation truly needs it.",
          "Gardez la creation de roles simple, puis etendez les permissions seulement la ou l'operationnel en a besoin.",
        )}
        meta={<StatusPill>{`${roles.length} ${t(lang, "roles", "roles")}`}</StatusPill>}
        isOpen={openSections.roles}
        onToggle={() => toggleSection("roles")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={createRole} className={`${SURFACE_CARD_CLASS} grid gap-4 content-start`}>
            <p className="text-sm font-semibold text-[var(--admin-text)]">{t(lang, "Create a role", "Creer un role")}</p>
            <SettingsField label={t(lang, "Role name", "Nom du role")}>
              <AdminToolbarInput className={FIELD_CLASS} value={roleForm.name} onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t(lang, "Warehouse manager", "Responsable entrepot")} />
            </SettingsField>
            <SettingsField label={t(lang, "Description", "Description")}>
              <AdminToolbarInput className={FIELD_CLASS} value={roleForm.description} onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t(lang, "Who should receive this access level?", "Qui doit recevoir ce niveau d'acces ?")} />
            </SettingsField>
            <div>
              <p className={LABEL_CLASS}>{t(lang, "Permissions", "Permissions")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {permissions.map((perm) => {
                  const selected = roleForm.permissionIds.includes(perm.id);
                  return (
                    <button
                      key={perm.id}
                      type="button"
                      onClick={() =>
                        setRoleForm((prev) => ({
                          ...prev,
                          permissionIds: selected
                            ? prev.permissionIds.filter((id) => id !== perm.id)
                            : [...prev.permissionIds, perm.id],
                        }))
                      }
                      className={selected ? `${PILL_CLASS} liquid-selected text-[var(--admin-text)]` : PILL_CLASS}
                    >
                      {perm.code}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <ActionButton type="submit" tone="primary" icon="plus" label={t(lang, "Create role", "Creer le role")} />
            </div>
          </form>

          <div className="grid gap-3 content-start">
            {roles.length === 0 ? (
              <div className={`${SURFACE_CARD_CLASS} text-sm text-[var(--admin-muted)]`}>
                {t(lang, "No role yet.", "Aucun role pour le moment.")}
              </div>
            ) : (
              roles.map((role) => (
                <article key={role.id} className={SURFACE_CARD_CLASS}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-text)]">{role.name}</p>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">{role.description || t(lang, "No description", "Pas de description")}</p>
                    </div>
                    <StatusPill>{`${role.userCount} ${t(lang, "users", "utilisateurs")}`}</StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {role.permissions.slice(0, 6).map((perm) => (
                      <StatusPill key={perm.id}>{perm.code}</StatusPill>
                    ))}
                    {role.permissions.length > 6 ? <StatusPill>{`+${role.permissions.length - 6}`}</StatusPill> : null}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <ActionButton size="sm" tone="danger" icon="delete" onClick={() => deleteRole(role.id)} label={t(lang, "Delete", "Supprimer")} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        sectionId="users"
        title={t(lang, "Team access", "Acces equipe")}
        subtitle={t(
          lang,
          "Invite users from here, then keep activation and role assignment lightweight from the roster.",
          "Invitez les utilisateurs ici, puis gardez l'activation et l'attribution des roles legeres depuis la liste.",
        )}
        meta={<StatusPill>{`${users.length} ${t(lang, "users", "utilisateurs")}`}</StatusPill>}
        isOpen={openSections.users}
        onToggle={() => toggleSection("users")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={createUser} className={`${SURFACE_CARD_CLASS} grid gap-4 content-start`}>
            <p className="text-sm font-semibold text-[var(--admin-text)]">{t(lang, "Invite a user", "Inviter un utilisateur")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField label={t(lang, "Email", "Email")}>
                <AdminToolbarInput className={FIELD_CLASS} type="email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="ops@textico.com" />
              </SettingsField>
              <SettingsField label={t(lang, "Name", "Nom")}>
                <AdminToolbarInput className={FIELD_CLASS} value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Amina Rahal" />
              </SettingsField>
              <SettingsField label={t(lang, "Password", "Mot de passe")} className="md:col-span-2">
                <AdminToolbarInput className={FIELD_CLASS} type="password" value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} placeholder={t(lang, "Minimum 8 characters", "Minimum 8 caracteres")} />
              </SettingsField>
            </div>
            <div>
              <p className={LABEL_CLASS}>{t(lang, "Assigned roles", "Roles attribues")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roleOptions.map((role) => {
                  const selected = userForm.roleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() =>
                        setUserForm((prev) => ({
                          ...prev,
                          roleIds: selected
                            ? prev.roleIds.filter((id) => id !== role.id)
                            : [...prev.roleIds, role.id],
                        }))
                      }
                      className={selected ? `${PILL_CLASS} liquid-selected text-[var(--admin-text)]` : PILL_CLASS}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-text)]">
              <input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              {t(lang, "Create as active user", "Creer comme utilisateur actif")}
            </label>
            <div>
              <ActionButton type="submit" tone="primary" icon="plus" label={t(lang, "Create user", "Creer l'utilisateur")} />
            </div>
          </form>

          <div className="grid gap-3 content-start">
            {users.length === 0 ? (
              <div className={`${SURFACE_CARD_CLASS} text-sm text-[var(--admin-muted)]`}>
                {t(lang, "No user yet.", "Aucun utilisateur pour le moment.")}
              </div>
            ) : (
              users.map((user) => (
                <article key={user.id} className={SURFACE_CARD_CLASS}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-text)]">{user.name}</p>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">{user.email}</p>
                    </div>
                    <StatusPill selected={user.isActive}>{user.isActive ? t(lang, "Active", "Actif") : t(lang, "Inactive", "Inactif")}</StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.roles.length > 0 ? user.roles.map((role) => <StatusPill key={role.id}>{role.name}</StatusPill>) : <StatusPill>{t(lang, "No role", "Aucun role")}</StatusPill>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      size="sm"
                      icon={user.isActive ? "close" : "apply"}
                      onClick={() => patchUser(user.id, { isActive: !user.isActive })}
                      label={user.isActive ? t(lang, "Deactivate", "Desactiver") : t(lang, "Activate", "Activer")}
                    />
                    <ActionButton size="sm" tone="danger" icon="delete" onClick={() => deleteUser(user.id)} label={t(lang, "Delete", "Supprimer")} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        sectionId="customFields"
        title={t(lang, "Custom data", "Champs personnalises")}
        subtitle={t(
          lang,
          "Only keep fields the team will actually fill. Extra fields should earn their place.",
          "Conservez uniquement les champs que l'equipe va vraiment remplir. Chaque champ en plus doit justifier sa place.",
        )}
        meta={<StatusPill>{`${customFields.length} ${t(lang, "fields", "champs")}`}</StatusPill>}
        isOpen={openSections.customFields}
        onToggle={() => toggleSection("customFields")}
        toggleOpenLabel={sectionLabels.show}
        toggleCloseLabel={sectionLabels.hide}
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={createCustomField} className={`${SURFACE_CARD_CLASS} grid gap-4 content-start`}>
            <p className="text-sm font-semibold text-[var(--admin-text)]">{t(lang, "Create a custom field", "Creer un champ personnalise")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField label={t(lang, "Entity", "Entite")}>
                <AdminToolbarSelect className={FIELD_CLASS} value={fieldForm.entityType} onChange={(e) => setFieldForm((prev) => ({ ...prev, entityType: e.target.value }))}>
                  {ENTITY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminToolbarSelect>
              </SettingsField>
              <SettingsField label={t(lang, "Field key", "Cle du champ")}>
                <AdminToolbarInput className={FIELD_CLASS} value={fieldForm.fieldKey} onChange={(e) => setFieldForm((prev) => ({ ...prev, fieldKey: e.target.value }))} placeholder="fabric_finish" />
              </SettingsField>
              <SettingsField label={t(lang, "Label", "Libelle")}>
                <AdminToolbarInput className={FIELD_CLASS} value={fieldForm.label} onChange={(e) => setFieldForm((prev) => ({ ...prev, label: e.target.value }))} placeholder={t(lang, "Fabric finish", "Finition tissu")} />
              </SettingsField>
              <SettingsField label={t(lang, "Field type", "Type de champ")}>
                <AdminToolbarInput className={FIELD_CLASS} value={fieldForm.fieldType} onChange={(e) => setFieldForm((prev) => ({ ...prev, fieldType: e.target.value }))} placeholder="text" />
              </SettingsField>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--admin-text)]">
              <input type="checkbox" checked={fieldForm.isRequired} onChange={(e) => setFieldForm((prev) => ({ ...prev, isRequired: e.target.checked }))} />
              {t(lang, "Required field", "Champ obligatoire")}
            </label>
            <div>
              <ActionButton type="submit" tone="primary" icon="plus" label={t(lang, "Create field", "Creer le champ")} />
            </div>
          </form>

          <div className="grid gap-3 content-start">
            {customFields.length === 0 ? (
              <div className={`${SURFACE_CARD_CLASS} text-sm text-[var(--admin-muted)]`}>
                {t(lang, "No custom field yet.", "Aucun champ personnalise pour le moment.")}
              </div>
            ) : (
              customFields.map((field) => (
                <article key={field.id} className={SURFACE_CARD_CLASS}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-text)]">{field.label}</p>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">{field.entityType} · {field.fieldKey} · {field.fieldType}</p>
                    </div>
                    <StatusPill selected={field.isRequired}>{field.isRequired ? t(lang, "Required", "Obligatoire") : t(lang, "Optional", "Optionnel")}</StatusPill>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <ActionButton size="sm" tone="danger" icon="delete" onClick={() => deleteCustomField(field.id)} label={t(lang, "Delete", "Supprimer")} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
