"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Coffee,
  CreditCard,
  Download,
  FileText,
  Flag,
  Heart,
  Home,
  KeyRound,
  ListChecks,
  Lock,
  Palette,
  Pencil,
  Plane,
  Plus,
  Save,
  Shield,
  Sparkles,
  Target,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createUserCategory,
  deleteUserCategory,
  exportUserData,
  updateUserCategory,
  updateUserSettings,
} from "@/lib/actions/settings";
import {
  AI_BEHAVIOR_OPTIONS,
  AI_MODEL_OPTIONS,
  AI_TONE_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  CATEGORY_SCOPE_LABELS,
  CATEGORY_SCOPES,
  SETTINGS_CALENDAR_VIEW_OPTIONS,
  SETTINGS_TASK_PRIORITY_OPTIONS,
  SETTINGS_THEME_OPTIONS,
  type CategoryFormInput,
  type CategoryIconName,
  type CategoryOption,
  type CategoryScope,
  type SettingsPageData,
  type UserSettingsRecord,
  type UserSettingsUpdateInput,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

type SettingsPageClientProps = {
  initialData: SettingsPageData | null;
};

type SectionId = "profile" | "subscription" | "categories" | "ai" | "preferences" | "privacy";

const sections: Array<{ id: SectionId; label: string; icon: typeof User; color: string }> = [
  { id: "profile", label: "Profile", icon: User, color: "#8B5CF6" },
  { id: "subscription", label: "Subscription", icon: CreditCard, color: "#06B6D4" },
  { id: "categories", label: "Categories", icon: Palette, color: "#F97316" },
  { id: "ai", label: "AI", icon: Bot, color: "#8B5CF6" },
  { id: "preferences", label: "Preferences", icon: Sparkles, color: "#10B981" },
  { id: "privacy", label: "Privacy", icon: Shield, color: "#64748B" },
];

const categoryIconMap = {
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  Clock,
  Coffee,
  FileText,
  Flag,
  Heart,
  Home,
  ListChecks,
  Palette,
  Plane,
  Sparkles,
  Target,
  User,
};

function CategoryIcon({
  name,
  className,
  size = 14,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const Icon = categoryIconMap[name as CategoryIconName] ?? Sparkles;
  return <Icon size={size} className={className} />;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "Account";
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function labelize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ToggleControl({
  checked,
  label,
  icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  icon: ReactNode;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left transition hover:border-violet-100 hover:bg-violet-50/40"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          {icon}
        </span>
        <span className="truncate text-[12px] font-semibold text-slate-600">{label}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-violet-600" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      >
        {options.map((option) => {
          const next = typeof option === "string" ? { value: option, label: labelize(option) } : option;
          return (
            <option key={next.value} value={next.value}>
              {next.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function CategoryEditorRow({
  category,
  onSave,
  onDelete,
  disabled,
}: {
  category: CategoryOption;
  onSave: (id: number, input: Omit<CategoryFormInput, "scope">) => void;
  onDelete: (id: number) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState({
    name: category.name,
    color: category.color,
    icon: category.icon,
  });
  const dirty =
    draft.name !== category.name || draft.color !== category.color || draft.icon !== category.icon;

  return (
    <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 lg:grid-cols-[1fr_140px_150px_auto] lg:items-end">
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Name
        </span>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
        />
      </label>
      <SelectField
        label="Color"
        value={draft.color}
        options={CATEGORY_COLOR_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onChange={(color) => setDraft((current) => ({ ...current, color }))}
      />
      <SelectField
        label="Icon"
        value={draft.icon}
        options={CATEGORY_ICON_OPTIONS.map((icon) => ({ value: icon, label: icon }))}
        onChange={(icon) => setDraft((current) => ({ ...current, icon }))}
      />
      <div className="flex items-center justify-end gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl border"
          style={{ borderColor: category.border, backgroundColor: category.bg, color: draft.color }}
        >
          <CategoryIcon name={draft.icon} />
        </span>
        <button
          type="button"
          onClick={() => onSave(category.id, draft)}
          disabled={!dirty || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Save ${category.name}`}
          title="Save"
        >
          <Save size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(category.id)}
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
          aria-label={`Delete ${category.name}`}
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function SettingsPageClient({ initialData }: SettingsPageClientProps) {
  const clerk = useClerk();
  const { user } = useUser();
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [activeScope, setActiveScope] = useState<CategoryScope>("calendar");
  const [settings, setSettings] = useState<UserSettingsRecord | null>(initialData?.settings ?? null);
  const [subscription] = useState(initialData?.subscription ?? null);
  const [categories, setCategories] = useState(initialData?.categories ?? null);
  const [categoryDraft, setCategoryDraft] = useState<{ name: string; color: string; icon: string }>({
    name: "",
    color: CATEGORY_COLOR_OPTIONS[0].value,
    icon: "Sparkles",
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const profileName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "FlowBase user";
  const profileEmail = user?.primaryEmailAddress?.emailAddress ?? "No email";
  const activeCategories = categories?.[activeScope] ?? [];

  const usageEntries = useMemo(() => {
    return Object.entries(subscription?.usageLimits ?? {});
  }, [subscription]);

  if (!initialData || !settings || !subscription || !categories) {
    return (
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center p-6">
        <Card className="w-full border-violet-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-[18px] text-indigo-950">Settings unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-[13px] font-medium text-slate-500">
            Sign in to manage your workspace settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  function saveSettings(patch: UserSettingsUpdateInput) {
    const previous = settings;
    setSettings({ ...settings!, ...patch });
    setNotice(null);

    startTransition(async () => {
      try {
        const updated = await updateUserSettings(patch);
        setSettings(updated);
      } catch (caught) {
        setSettings(previous);
        setNotice(caught instanceof Error ? caught.message : "Could not save settings.");
      }
    });
  }

  function handleCreateCategory() {
    if (!categoryDraft.name.trim()) {
      setNotice("Add a category name first.");
      return;
    }

    setNotice(null);
    startTransition(async () => {
      try {
        const created = await createUserCategory({
          scope: activeScope,
          name: categoryDraft.name,
          color: categoryDraft.color,
          icon: categoryDraft.icon,
        });

        setCategories((current) => {
          if (!current) return current;
          return {
            ...current,
            [activeScope]: [...current[activeScope], created],
          };
        });
        setCategoryDraft({ name: "", color: CATEGORY_COLOR_OPTIONS[0].value, icon: "Sparkles" });
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Could not create category.");
      }
    });
  }

  function handleSaveCategory(id: number, input: Omit<CategoryFormInput, "scope">) {
    setNotice(null);
    startTransition(async () => {
      try {
        const updated = await updateUserCategory(id, input);
        setCategories((current) => {
          if (!current) return current;
          return {
            ...current,
            [updated.scope]: current[updated.scope].map((category) =>
              category.id === updated.id ? updated : category
            ),
          };
        });
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Could not update category.");
      }
    });
  }

  function handleDeleteCategory(id: number) {
    const shouldDelete = window.confirm("Delete this category?");
    if (!shouldDelete) return;

    setNotice(null);
    startTransition(async () => {
      try {
        const deleted = await deleteUserCategory(id);
        setCategories((current) => {
          if (!current) return current;
          return {
            ...current,
            [deleted.scope]: current[deleted.scope].filter((category) => category.id !== id),
          };
        });
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Could not delete category.");
      }
    });
  }

  function handleExport() {
    setNotice(null);
    startTransition(async () => {
      try {
        const exported = await exportUserData();
        const blob = new Blob([exported.content], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = exported.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Could not export data.");
      }
    });
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-400">
                FlowBase
              </span>
            </div>
            <h1 className="text-[28px] font-bold tracking-normal text-indigo-950">Settings</h1>
          </div>
          {notice && (
            <div className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-[12px] font-semibold text-violet-600 shadow-sm">
              {notice}
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-violet-100 bg-white p-2 shadow-sm lg:sticky lg:top-6 lg:self-start">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold transition",
                      active
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    )}
                  >
                    <Icon size={15} style={{ color: section.color }} className="shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            {activeSection === "profile" && (
              <Card className="border-violet-100 bg-white shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-2 text-[16px] text-indigo-950">
                    <User size={16} className="text-violet-500" />
                    Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                    {user?.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt=""
                        className="h-16 w-16 rounded-2xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-[18px] font-bold text-white shadow-sm">
                        {getInitials(profileName, profileEmail)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[18px] font-bold text-indigo-950">{profileName}</p>
                      <p className="truncate text-[12.5px] font-semibold text-slate-400">
                        {profileEmail}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => clerk.openUserProfile()}
                      className="gap-2 rounded-xl bg-violet-600 text-[12px] hover:bg-violet-700"
                    >
                      <Pencil size={14} />
                      Edit profile
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => clerk.openUserProfile()}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-violet-100 hover:bg-violet-50/40"
                    >
                      <KeyRound size={15} className="text-violet-500" />
                      <span className="text-[12px] font-semibold text-slate-600">Account security</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => clerk.signOut({ redirectUrl: "/sign-in" })}
                      className="flex items-center gap-3 rounded-xl border border-rose-100 bg-white px-4 py-3 text-left transition hover:bg-rose-50"
                    >
                      <Lock size={15} className="text-rose-500" />
                      <span className="text-[12px] font-semibold text-rose-500">Sign out</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "subscription" && (
              <Card className="border-violet-100 bg-white shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-2 text-[16px] text-indigo-950">
                    <CreditCard size={16} className="text-cyan-500" />
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-500">
                        Current plan
                      </p>
                      <p className="mt-2 text-[20px] font-bold text-indigo-950">{subscription.planName}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-500">
                        Status
                      </p>
                      <p className="mt-2 text-[20px] font-bold capitalize text-indigo-950">
                        {subscription.status}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-500">
                        Renewal
                      </p>
                      <p className="mt-2 text-[20px] font-bold text-indigo-950">
                        {subscription.renewalDate ?? "Not set"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {usageEntries.map(([key, usage]) => (
                      <div key={key} className="rounded-xl border border-slate-100 bg-white p-3">
                        <p className="text-[11px] font-semibold text-slate-500">{usage.label}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{
                              width: usage.limit ? `${Math.min((usage.used / usage.limit) * 100, 100)}%` : "100%",
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10.5px] font-medium text-slate-400">
                          {usage.used}
                          {usage.limit ? ` / ${usage.limit}` : " used"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    onClick={() => setNotice("Billing provider is not connected yet.")}
                    className="gap-2 rounded-xl bg-violet-600 text-[12px] hover:bg-violet-700"
                  >
                    <CreditCard size={14} />
                    Manage Subscription
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeSection === "categories" && (
              <Card className="border-violet-100 bg-white shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-2 text-[16px] text-indigo-950">
                    <Palette size={16} className="text-orange-500" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CATEGORY_SCOPES.map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setActiveScope(scope)}
                        className={cn(
                          "whitespace-nowrap rounded-xl px-3 py-2 text-[11.5px] font-semibold transition",
                          activeScope === scope
                            ? "bg-orange-50 text-orange-600"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {CATEGORY_SCOPE_LABELS[scope]}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-3 lg:grid-cols-[1fr_140px_150px_auto] lg:items-end">
                    <label className="block min-w-0">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        New category
                      </span>
                      <input
                        value={categoryDraft.name}
                        onChange={(event) =>
                          setCategoryDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Deep work"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      />
                    </label>
                    <SelectField
                      label="Color"
                      value={categoryDraft.color}
                      options={CATEGORY_COLOR_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      onChange={(color) => setCategoryDraft((current) => ({ ...current, color }))}
                    />
                    <SelectField
                      label="Icon"
                      value={categoryDraft.icon}
                      options={CATEGORY_ICON_OPTIONS.map((icon) => ({ value: icon, label: icon }))}
                      onChange={(icon) => setCategoryDraft((current) => ({ ...current, icon }))}
                    />
                    <Button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={isPending}
                      className="gap-2 rounded-xl bg-orange-500 text-[12px] hover:bg-orange-600"
                    >
                      <Plus size={14} />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {activeCategories.map((category) => (
                      <CategoryEditorRow
                        key={category.id}
                        category={category}
                        disabled={isPending}
                        onSave={handleSaveCategory}
                        onDelete={handleDeleteCategory}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "ai" && (
              <Card className="border-violet-100 bg-white shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-2 text-[16px] text-indigo-950">
                    <Bot size={16} className="text-violet-500" />
                    AI Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SelectField
                      label="Model"
                      value={settings.aiModel}
                      options={AI_MODEL_OPTIONS}
                      onChange={(aiModel) => saveSettings({ aiModel })}
                    />
                    <SelectField
                      label="Behavior"
                      value={settings.aiBehavior}
                      options={AI_BEHAVIOR_OPTIONS}
                      onChange={(aiBehavior) => saveSettings({ aiBehavior })}
                    />
                    <SelectField
                      label="Tone"
                      value={settings.aiTone}
                      options={AI_TONE_OPTIONS}
                      onChange={(aiTone) => saveSettings({ aiTone })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleControl
                      checked={settings.aiRefineEnabled}
                      label="AI Refine"
                      icon={<Wand2 size={14} className="text-violet-500" />}
                      onChange={() => saveSettings({ aiRefineEnabled: !settings.aiRefineEnabled })}
                    />
                    <ToggleControl
                      checked={settings.aiAssistantEnabled}
                      label="AI Assistant"
                      icon={<Bot size={14} className="text-violet-500" />}
                      onChange={() =>
                        saveSettings({ aiAssistantEnabled: !settings.aiAssistantEnabled })
                      }
                    />
                    <ToggleControl
                      checked={settings.aiTemplateBuilderEnabled}
                      label="AI Template Builder"
                      icon={<Sparkles size={14} className="text-violet-500" />}
                      onChange={() =>
                        saveSettings({
                          aiTemplateBuilderEnabled: !settings.aiTemplateBuilderEnabled,
                        })
                      }
                    />
                    <ToggleControl
                      checked={settings.aiDiagramEnabled}
                      label="AI Diagram"
                      icon={<Palette size={14} className="text-violet-500" />}
                      onChange={() => saveSettings({ aiDiagramEnabled: !settings.aiDiagramEnabled })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "preferences" && (
              <Card className="border-violet-100 bg-white shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-2 text-[16px] text-indigo-950">
                    <Sparkles size={16} className="text-emerald-500" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SelectField
                      label="Theme"
                      value={settings.themePreference}
                      options={SETTINGS_THEME_OPTIONS}
                      onChange={(themePreference) => saveSettings({ themePreference })}
                    />
                    <SelectField
                      label="Calendar view"
                      value={settings.defaultCalendarView}
                      options={SETTINGS_CALENDAR_VIEW_OPTIONS}
                      onChange={(defaultCalendarView) => saveSettings({ defaultCalendarView })}
                    />
                    <SelectField
                      label="Task priority"
                      value={settings.defaultTaskPriority}
                      options={SETTINGS_TASK_PRIORITY_OPTIONS}
                      onChange={(defaultTaskPriority) => saveSettings({ defaultTaskPriority })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleControl
                      checked={settings.notificationsEnabled}
                      label="Notifications"
                      icon={<Bell size={14} className="text-emerald-500" />}
                      onChange={() =>
                        saveSettings({ notificationsEnabled: !settings.notificationsEnabled })
                      }
                    />
                    <ToggleControl
                      checked={settings.emailNotifications}
                      label="Email notifications"
                      icon={<FileText size={14} className="text-emerald-500" />}
                      onChange={() =>
                        saveSettings({ emailNotifications: !settings.emailNotifications })
                      }
                    />
                    <ToggleControl
                      checked={settings.desktopNotifications}
                      label="Desktop notifications"
                      icon={<Bell size={14} className="text-emerald-500" />}
                      onChange={() =>
                        saveSettings({ desktopNotifications: !settings.desktopNotifications })
                      }
                    />
                    <ToggleControl
                      checked={settings.autoSaveEnabled}
                      label="Auto-save"
                      icon={<Save size={14} className="text-emerald-500" />}
                      onChange={() => saveSettings({ autoSaveEnabled: !settings.autoSaveEnabled })}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleExport}
                    disabled={isPending}
                    className="gap-2 rounded-xl bg-emerald-600 text-[12px] hover:bg-emerald-700"
                  >
                    <Download size={14} />
                    Export Data
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeSection === "privacy" && (
              <Card className="border-violet-100 bg-white shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="flex items-center gap-2 text-[16px] text-indigo-950">
                    <Shield size={16} className="text-slate-500" />
                    Privacy & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleControl
                      checked={settings.privacyAnalyticsEnabled}
                      label="Product analytics"
                      icon={<Shield size={14} className="text-slate-500" />}
                      onChange={() =>
                        saveSettings({
                          privacyAnalyticsEnabled: !settings.privacyAnalyticsEnabled,
                        })
                      }
                    />
                    <ToggleControl
                      checked={settings.securityAlertsEnabled}
                      label="Security alerts"
                      icon={<Lock size={14} className="text-slate-500" />}
                      onChange={() =>
                        saveSettings({ securityAlertsEnabled: !settings.securityAlertsEnabled })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => clerk.openUserProfile()}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-violet-100 hover:bg-violet-50/40"
                    >
                      <KeyRound size={15} className="text-violet-500" />
                      <span className="text-[12px] font-semibold text-slate-600">Password and sessions</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExport}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-emerald-100 hover:bg-emerald-50/50"
                    >
                      <Download size={15} className="text-emerald-600" />
                      <span className="text-[12px] font-semibold text-slate-600">Download account data</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
