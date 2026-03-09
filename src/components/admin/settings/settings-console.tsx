"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALLOWED_CURRENCY_CODES } from "@/lib/currency";

type CompanySettings = {
  id: string;
  name: string;
  domain: string | null;
  currencyCode: string;
  backgroundPreset: string;
  backgroundImageUrl: string | null;
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

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body as T;
}

export function SettingsConsole({ lang = "en" }: { lang?: "en" | "fr" }) {
  const [company, setCompany] = useState<CompanySettings | null>(null);
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
    backgroundPreset: "FROZEN_INDIGO",
    backgroundMode: "PRESET" as "PRESET" | "IMAGE",
    backgroundImageUrl: "",
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

  const [taxForm, setTaxForm] = useState({ code: "", label: "", rate: "20", isDefault: false, isActive: true });
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissionIds: [] as string[] });
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyRes, llmRes, messagingRes, stockRes, taxesRes, permsRes, rolesRes, usersRes, fieldsRes] = await Promise.all([
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

      setCompany(companyBody.data);
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
      setCompanyForm({
        name: companyBody.data.name,
        domain: companyBody.data.domain ?? "",
        currencyCode: companyBody.data.currencyCode,
        backgroundPreset: companyBody.data.backgroundPreset ?? "FROZEN_INDIGO",
        backgroundMode: companyBody.data.backgroundImageUrl ? "IMAGE" : "PRESET",
        backgroundImageUrl: companyBody.data.backgroundImageUrl ?? "",
        productUnitMode: companyBody.data.productUnitMode,
        defaultProductUnit: companyBody.data.defaultProductUnit,
        locale: companyBody.data.locale,
        timezone: companyBody.data.timezone,
      });
      setStockRule(stockBody.data);
      setTaxes(taxesBody.data);
      setPermissions(permsBody.data);
      setRoles(rolesBody.data);
      setUsers(usersBody.data);
      setCustomFields(fieldsBody.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!llmSettings || llmSettings.sharedAvailable) return;
    setLlmForm((prev) =>
      prev.accessMode === "SHARED" && prev.isEnabled ? { ...prev, isEnabled: false } : prev,
    );
  }, [llmSettings]);

  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        id: role.id,
        name: role.name,
      })),
    [roles],
  );
  const sharedUnavailable = Boolean(llmSettings && !llmSettings.sharedAvailable);
  const tCompany = useMemo(
    () => ({
      loading: lang === "fr" ? "Chargement des parametres..." : "Loading settings...",
      title: lang === "fr" ? "Entreprise" : "Company",
      name: lang === "fr" ? "Nom de l'entreprise" : "Company name",
      domain: lang === "fr" ? "Domaine" : "Domain",
      currency: lang === "fr" ? "Devise" : "Currency",
      unitMode: lang === "fr" ? "Mode d'unite produit" : "Product unit mode",
      unitModePerProduct:
        lang === "fr" ? "Unite definie par produit" : "Per-product unit mode",
      unitModeGlobal:
        lang === "fr" ? "Unite unique pour tous les produits" : "Single unit for all products",
      defaultUnit: lang === "fr" ? "Unite par defaut" : "Default unit",
      unitEa: lang === "fr" ? "Unites (EA)" : "Units (EA)",
      unitM: lang === "fr" ? "Metres (M)" : "Meters (M)",
      unitL: lang === "fr" ? "Litres (L)" : "Liters (L)",
      unitKg: lang === "fr" ? "Kilogrammes (KG)" : "Kilograms (KG)",
      locale: lang === "fr" ? "Locale" : "Locale",
      timezone: lang === "fr" ? "Fuseau horaire" : "Timezone",
      helper:
        lang === "fr"
          ? "Si le mode GLOBAL est actif, l'unite par defaut est appliquee automatiquement a tous les produits."
          : "If unit mode is GLOBAL, all products will use the default unit automatically.",
      save: lang === "fr" ? "Enregistrer les parametres entreprise" : "Save company settings",
    }),
    [lang],
  );

  const updateCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const { backgroundPreset: _ignoredPreset, backgroundMode: _ignoredMode, backgroundImageUrl: _ignoredImage, ...payload } = companyForm;
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await jsonOrThrow<{ data: CompanySettings }>(res);
      setStatus("Company settings updated");
      await fetchAll();
      window.dispatchEvent(new Event("neura:company-settings-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update company");
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
      setStatus("LLM provider settings updated");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update LLM settings");
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
      setStatus("Messaging settings updated");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update messaging settings");
    }
  };

  const testLlm = async () => {
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/llm/test", {
        method: "POST",
      });
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
        ? ` · shared quota ${body.data.sharedQuota.used}/${body.data.sharedQuota.limit}`
        : "";
      setStatus(
        `LLM connection OK (${body.data.accessMode} ${body.data.provider}/${body.data.model})${quotaPart}: ${body.data.output}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test LLM settings");
    }
  };

  const deleteLlm = async () => {
    if (!window.confirm("Remove LLM provider configuration?")) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/llm", { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus("LLM provider settings removed");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove LLM settings");
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
      setStatus("Stock rules updated");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stock rules");
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
      setStatus("Tax rule created");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tax rule");
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
      setStatus("Tax rule updated");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tax rule");
    }
  };

  const deleteTax = async (taxId: string) => {
    if (!window.confirm("Delete this tax rule?")) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/taxes/${taxId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus("Tax rule deleted");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tax rule");
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
      setStatus("Role created");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!window.confirm("Delete this role?")) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/roles/${roleId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus("Role deleted");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
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
      setStatus("User created");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
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
      setStatus("User updated");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm("Delete this user?")) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/users/${userId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus("User deleted");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
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
      setStatus("Custom field created");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom field");
    }
  };

  const deleteCustomField = async (fieldId: string) => {
    if (!window.confirm("Delete this custom field?")) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/settings/custom-fields/${fieldId}`, { method: "DELETE" });
      await jsonOrThrow<{ success: boolean }>(res);
      setStatus("Custom field deleted");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete custom field");
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">{tCompany.loading}</p>;
  }

  return (
    <div className="space-y-6">
      {status ? <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">{tCompany.title}</h2>
        <form onSubmit={updateCompany} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={companyForm.name} onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))} placeholder={tCompany.name} />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={companyForm.domain} onChange={(e) => setCompanyForm((p) => ({ ...p, domain: e.target.value }))} placeholder={tCompany.domain} />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={companyForm.currencyCode}
            onChange={(e) =>
              setCompanyForm((p) => ({
                ...p,
                currencyCode: e.target.value,
              }))
            }
            aria-label={tCompany.currency}
          >
            {ALLOWED_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={companyForm.productUnitMode}
            onChange={(e) =>
              setCompanyForm((p) => ({
                ...p,
                productUnitMode: e.target.value as "GLOBAL" | "PER_PRODUCT",
              }))
            }
            aria-label={tCompany.unitMode}
          >
            <option value="PER_PRODUCT">{tCompany.unitModePerProduct}</option>
            <option value="GLOBAL">{tCompany.unitModeGlobal}</option>
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={companyForm.defaultProductUnit}
            onChange={(e) =>
              setCompanyForm((p) => ({
                ...p,
                defaultProductUnit: e.target.value as "EA" | "M" | "L" | "KG",
              }))
            }
            aria-label={tCompany.defaultUnit}
          >
            <option value="EA">{tCompany.unitEa}</option>
            <option value="M">{tCompany.unitM}</option>
            <option value="L">{tCompany.unitL}</option>
            <option value="KG">{tCompany.unitKg}</option>
          </select>
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={companyForm.locale} onChange={(e) => setCompanyForm((p) => ({ ...p, locale: e.target.value }))} placeholder={tCompany.locale} />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2" value={companyForm.timezone} onChange={(e) => setCompanyForm((p) => ({ ...p, timezone: e.target.value }))} placeholder={tCompany.timezone} />
          <p className="text-xs text-zinc-500 md:col-span-2">
            {tCompany.helper}
          </p>
          <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">{tCompany.save}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">AI Assistant</h2>
        <p className="mt-1 text-xs text-zinc-500">Choose a simple mode: shared AI by NeuraOS, or your own provider key.</p>
        {llmSettings ? (
          <div className="mt-3 space-y-3">
            {llmSettings.usage.monthlyLimitTokens !== null ? (
              (() => {
                const limit = llmSettings.usage.monthlyLimitTokens;
                const consumed = llmSettings.usage.consumedTokens;
                const usedPct = limit > 0 ? Math.min(100, Math.round((consumed / limit) * 100)) : 0;
                const barClass =
                  usedPct >= 90
                    ? "bg-rose-500"
                    : usedPct >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500";
                return (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-zinc-600">Monthly token usage</p>
                      <p className="font-semibold text-zinc-900">{usedPct}%</p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                      <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${usedPct}%` }} />
                    </div>
                  </div>
                );
              })()
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                <p className="text-zinc-500">Tokens used ({llmSettings.usage.period})</p>
                <p className="text-sm font-semibold text-zinc-900">{llmSettings.usage.consumedTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                <p className="text-zinc-500">Token limit</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {llmSettings.usage.monthlyLimitTokens === null
                    ? "BYOK (your provider)"
                    : llmSettings.usage.monthlyLimitTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                <p className="text-zinc-500">Tokens left</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {llmSettings.usage.remainingTokens === null
                    ? "N/A"
                    : llmSettings.usage.remainingTokens.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {llmSettings && !llmSettings.sharedAvailable ? (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Shared AI is not available yet on the platform. You can still use BYOK mode.
          </div>
        ) : null}
        <form onSubmit={updateLlm} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <input
                type="radio"
                name="llm-mode"
                checked={llmForm.accessMode === "SHARED"}
                onChange={() => setLlmForm((p) => ({ ...p, accessMode: "SHARED" }))}
                disabled={sharedUnavailable}
              />
              <span>
                <span className="block font-medium text-zinc-900">NeuraOS Shared AI</span>
                <span className="block text-xs text-zinc-500">Plug-and-play. No API key required.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <input
                type="radio"
                name="llm-mode"
                checked={llmForm.accessMode === "BYOK"}
                onChange={() => setLlmForm((p) => ({ ...p, accessMode: "BYOK" }))}
              />
              <span>
                <span className="block font-medium text-zinc-900">Bring Your Own Key</span>
                <span className="block text-xs text-zinc-500">Connect OpenAI/OpenRouter/Groq/Together…</span>
              </span>
            </label>
          </div>

          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={llmForm.provider}
            onChange={(e) =>
              setLlmForm((p) => ({ ...p, provider: e.target.value as "OPENAI" | "OPENAI_COMPATIBLE" }))
            }
            disabled={llmForm.accessMode !== "BYOK"}
          >
            <option value="OPENAI">OpenAI</option>
            <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
          </select>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={llmForm.defaultModel}
            onChange={(e) => setLlmForm((p) => ({ ...p, defaultModel: e.target.value }))}
            placeholder="Default model (e.g. gpt-4o-mini)"
            disabled={llmForm.accessMode !== "BYOK"}
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            value={llmForm.baseUrl}
            onChange={(e) => setLlmForm((p) => ({ ...p, baseUrl: e.target.value }))}
            placeholder="Base URL (required for OPENAI_COMPATIBLE, ex: https://openrouter.ai/api/v1)"
            disabled={llmForm.accessMode !== "BYOK"}
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            value={llmForm.apiKey}
            onChange={(e) => setLlmForm((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder={llmSettings?.keyHint ? `Current key: ${llmSettings.keyHint} (leave blank to keep)` : "API key"}
            disabled={llmForm.accessMode !== "BYOK"}
          />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={llmForm.isEnabled}
              onChange={(e) => setLlmForm((p) => ({ ...p, isEnabled: e.target.checked }))}
              disabled={sharedUnavailable && llmForm.accessMode === "SHARED"}
            />
            Enable provider
          </label>
          {sharedUnavailable && llmForm.accessMode === "SHARED" ? (
            <p className="md:col-span-2 text-xs text-amber-600">
              Shared AI cannot be enabled yet. Switch to BYOK, or ask platform admin to set `SHARED_LLM_API_KEY`.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={sharedUnavailable && llmForm.accessMode === "SHARED" && llmForm.isEnabled}
              className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save AI settings
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
              onClick={testLlm}
            >
              Test connection
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
              onClick={deleteLlm}
            >
              Remove config
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">WhatsApp & Telegram</h2>
        <p className="mt-1 text-xs text-zinc-500">Configure tenant channels for copilot messaging integrations.</p>
        <form onSubmit={updateMessaging} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={messagingForm.whatsappEnabled}
              onChange={(e) => setMessagingForm((p) => ({ ...p, whatsappEnabled: e.target.checked }))}
            />
            Enable WhatsApp
          </label>
          <div />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={messagingForm.whatsappPhoneNumber}
            onChange={(e) => setMessagingForm((p) => ({ ...p, whatsappPhoneNumber: e.target.value }))}
            placeholder="WhatsApp phone number (E.164)"
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={messagingForm.whatsappBusinessAccountId}
            onChange={(e) => setMessagingForm((p) => ({ ...p, whatsappBusinessAccountId: e.target.value }))}
            placeholder="WhatsApp Business Account ID"
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            value={messagingForm.whatsappAccessToken}
            onChange={(e) => setMessagingForm((p) => ({ ...p, whatsappAccessToken: e.target.value }))}
            placeholder={
              messagingSettings?.whatsappAccessTokenHint
                ? `Current WhatsApp token: ${messagingSettings.whatsappAccessTokenHint} (leave blank to keep)`
                : "WhatsApp access token"
            }
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs md:col-span-2"
            value={messagingSettings?.whatsappWebhookUrl ?? ""}
            readOnly
            placeholder="WhatsApp webhook URL"
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs md:col-span-2"
            value={messagingSettings?.whatsappVerifyToken ?? ""}
            readOnly
            placeholder="WhatsApp verify token"
          />

          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={messagingForm.telegramEnabled}
              onChange={(e) => setMessagingForm((p) => ({ ...p, telegramEnabled: e.target.checked }))}
            />
            Enable Telegram
          </label>
          <div />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={messagingForm.telegramBotUsername}
            onChange={(e) => setMessagingForm((p) => ({ ...p, telegramBotUsername: e.target.value }))}
            placeholder="Telegram bot username (without @)"
          />
          <div />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
            value={messagingForm.telegramBotToken}
            onChange={(e) => setMessagingForm((p) => ({ ...p, telegramBotToken: e.target.value }))}
            placeholder={
              messagingSettings?.telegramBotTokenHint
                ? `Current Telegram token: ${messagingSettings.telegramBotTokenHint} (leave blank to keep)`
                : "Telegram bot token"
            }
          />
          <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            Save messaging settings
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Stock Rules</h2>
        {stockRule ? (
          <form onSubmit={updateStockRule} className="mt-4 flex flex-col gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={stockRule.allowNegativeStock} onChange={(e) => setStockRule((p) => (p ? { ...p, allowNegativeStock: e.target.checked } : p))} />
              Allow negative stock
            </label>
            <input className="max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm" value={stockRule.defaultLowStockThreshold ?? ""} onChange={(e) => setStockRule((p) => (p ? { ...p, defaultLowStockThreshold: e.target.value } : p))} placeholder="Default low-stock threshold" />
            <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save stock rules</button>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Tax Rules</h2>
        <form onSubmit={createTax} className="mt-4 grid gap-3 md:grid-cols-5">
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={taxForm.code} onChange={(e) => setTaxForm((p) => ({ ...p, code: e.target.value }))} placeholder="Code" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={taxForm.label} onChange={(e) => setTaxForm((p) => ({ ...p, label: e.target.value }))} placeholder="Label" />
          <input type="number" step="0.001" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={taxForm.rate} onChange={(e) => setTaxForm((p) => ({ ...p, rate: e.target.value }))} placeholder="Rate" />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={taxForm.isDefault} onChange={(e) => setTaxForm((p) => ({ ...p, isDefault: e.target.checked }))} />Default</label>
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Add tax</button>
        </form>
        <div className="mt-4 space-y-2">
          {taxes.map((tax) => (
            <div key={tax.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 p-3">
              <div className="text-sm">
                <span className="font-semibold">{tax.code}</span> · {tax.label} · {tax.rate}%
              </div>
              <div className="flex gap-2 text-xs">
                <button className="rounded border px-2 py-1" onClick={() => toggleTax(tax, { isDefault: true })}>{tax.isDefault ? "Default" : "Set default"}</button>
                <button className="rounded border px-2 py-1" onClick={() => toggleTax(tax, { isActive: !tax.isActive })}>{tax.isActive ? "Disable" : "Enable"}</button>
                <button className="rounded border border-red-200 px-2 py-1 text-red-600" onClick={() => deleteTax(tax.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Roles & Permissions</h2>
        <form onSubmit={createRole} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} placeholder="Role name" />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {permissions.map((perm) => (
              <label key={perm.id} className="inline-flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={roleForm.permissionIds.includes(perm.id)}
                  onChange={(e) =>
                    setRoleForm((p) => ({
                      ...p,
                      permissionIds: e.target.checked ? [...p.permissionIds, perm.id] : p.permissionIds.filter((id) => id !== perm.id),
                    }))
                  }
                />
                {perm.code}
              </label>
            ))}
          </div>
          <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Create role</button>
        </form>

        <div className="mt-4 space-y-2">
          {roles.map((role) => (
            <div key={role.id} className="rounded-xl border border-zinc-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{role.name} <span className="text-zinc-500">({role.userCount} users)</span></p>
                <button className="text-xs text-red-600" onClick={() => deleteRole(role.id)}>Delete</button>
              </div>
              <p className="text-xs text-zinc-500">{role.description ?? "No description"}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {role.permissions.map((perm) => (
                  <span key={perm.id} className="rounded-full bg-zinc-100 px-2 py-0.5">{perm.code}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Users</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password (min 8)" />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm((p) => ({ ...p, isActive: e.target.checked }))} />Active</label>
          <div className="md:col-span-2 grid gap-2 md:grid-cols-3">
            {roleOptions.map((role) => (
              <label key={role.id} className="inline-flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={userForm.roleIds.includes(role.id)}
                  onChange={(e) =>
                    setUserForm((p) => ({
                      ...p,
                      roleIds: e.target.checked ? [...p.roleIds, role.id] : p.roleIds.filter((id) => id !== role.id),
                    }))
                  }
                />
                {role.name}
              </label>
            ))}
          </div>
          <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Create user</button>
        </form>

        <div className="mt-4 space-y-2">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-zinc-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button className="rounded border px-2 py-1" onClick={() => patchUser(user.id, { isActive: !user.isActive })}>{user.isActive ? "Deactivate" : "Activate"}</button>
                  <button className="rounded border border-red-200 px-2 py-1 text-red-600" onClick={() => deleteUser(user.id)}>Delete</button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {user.roles.map((role) => (
                  <span key={role.id} className="rounded-full bg-zinc-100 px-2 py-0.5">{role.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Custom Fields</h2>
        <form onSubmit={createCustomField} className="mt-4 grid gap-3 md:grid-cols-2">
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fieldForm.entityType} onChange={(e) => setFieldForm((p) => ({ ...p, entityType: e.target.value }))}>
            <option value="product">product</option>
            <option value="client">client</option>
            <option value="supplier">supplier</option>
            <option value="sales_order">sales_order</option>
            <option value="purchase_order">purchase_order</option>
          </select>
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fieldForm.fieldKey} onChange={(e) => setFieldForm((p) => ({ ...p, fieldKey: e.target.value }))} placeholder="field_key" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fieldForm.label} onChange={(e) => setFieldForm((p) => ({ ...p, label: e.target.value }))} placeholder="Label" />
          <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fieldForm.fieldType} onChange={(e) => setFieldForm((p) => ({ ...p, fieldType: e.target.value }))} placeholder="Type (text|number|date)" />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={fieldForm.isRequired} onChange={(e) => setFieldForm((p) => ({ ...p, isRequired: e.target.checked }))} />Required</label>
          <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Create field</button>
        </form>

        <div className="mt-4 space-y-2">
          {customFields.map((field) => (
            <div key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 p-3">
              <div className="text-sm">
                <span className="font-semibold">{field.entityType}</span> · {field.label} ({field.fieldKey}) · {field.fieldType} {field.isRequired ? "· required" : ""}
              </div>
              <button className="text-xs text-red-600" onClick={() => deleteCustomField(field.id)}>Delete</button>
            </div>
          ))}
        </div>
      </section>

      <div className="text-xs text-zinc-500">Company ID: {company?.id}</div>
    </div>
  );
}
