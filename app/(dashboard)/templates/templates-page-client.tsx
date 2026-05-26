"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Loader2,
  PanelLeft,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { GeneratedAppPreview } from "@/components/generated-app-preview";
import { GeneratedTemplateIcon } from "@/components/generated-template-icon";
import { Button } from "@/components/ui/button";
import {
  addAppToSidebar,
  deleteGeneratedApp,
  removeAppFromSidebar,
} from "@/lib/actions/templates";
import { cn } from "@/lib/utils";
import { type GeneratedAppRecord } from "@/lib/templates";

type TemplatesPageClientProps = {
  initialApps: GeneratedAppRecord[];
};

const promptExamples = [
  "Habit tracker with streaks, weekly stats, and a daily checklist",
  "Budget tracker for subscriptions, expenses, and savings goals",
  "Study planner with subjects, revision progress, and exam countdowns",
];

function formatCreatedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function TemplatesPageClient({ initialApps }: TemplatesPageClientProps) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [prompt, setPrompt] = useState("");
  const [generatedApp, setGeneratedApp] = useState<GeneratedAppRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busyAppId, setBusyAppId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const sidebarCount = useMemo(() => apps.filter((app) => app.isInSidebar).length, [apps]);

  function updateApp(updated: GeneratedAppRecord) {
    setApps((current) => current.map((app) => (app.id === updated.id ? updated : app)));
    setGeneratedApp((current) => (current?.id === updated.id ? updated : current));
  }

  function handleGenerate() {
    const trimmedPrompt = prompt.trim();
    setError(null);
    setWarning(null);

    if (!trimmedPrompt) {
      setError("Enter an app idea before generating.");
      return;
    }

    setIsGenerating(true);

    void (async () => {
      try {
        const response = await fetch("/api/templates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmedPrompt }),
        });
        const data = (await response.json()) as { app?: GeneratedAppRecord; error?: string };

        if (!response.ok || !data.app) {
          throw new Error(data.error ?? "Could not generate that template.");
        }

        setApps((current) => [data.app!, ...current.filter((app) => app.id !== data.app!.id)]);
        setGeneratedApp(data.app);
        setPrompt("");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not generate that template.");
      } finally {
        setIsGenerating(false);
      }
    })();
  }

  async function handleSidebarToggle(app: GeneratedAppRecord) {
    setError(null);
    setWarning(null);
    setBusyAppId(app.id);

    try {
      if (app.isInSidebar) {
        const updated = await removeAppFromSidebar(app.id);
        updateApp(updated);
      } else {
        const result = await addAppToSidebar(app.id);
        if (result.warning) {
          setWarning(result.warning);
        }
        if (result.app) {
          updateApp(result.app);
        }
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the sidebar.");
    } finally {
      setBusyAppId(null);
    }
  }

  async function handleDelete(app: GeneratedAppRecord) {
    const confirmed = window.confirm(`Delete "${app.appName}"?`);
    if (!confirmed) return;

    setError(null);
    setWarning(null);
    setBusyAppId(app.id);

    try {
      await deleteGeneratedApp(app.id);
      setApps((current) => current.filter((item) => item.id !== app.id));
      setGeneratedApp((current) => (current?.id === app.id ? null : current));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete that app.");
    } finally {
      setBusyAppId(null);
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-400">
              <Sparkles size={14} />
              AI Template Builder
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-indigo-950">
              Build a mini app from a prompt
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-500">
              Generate a cozy single-page app layout, save it as JSON, and pin your favorite tools to the sidebar.
            </p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 shadow-sm">
            {sidebarCount}/3 sidebar apps pinned
          </div>
        </header>

        <section className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <label className="min-w-0 space-y-2">
              <span className="text-[12px] font-bold text-indigo-950">App idea prompt</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: Meal planner with grocery list, weekly nutrition stats, and prep checklist"
                rows={5}
                maxLength={2000}
                className="min-h-[132px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100 placeholder:text-slate-300"
              />
            </label>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="h-11 gap-2 rounded-lg bg-violet-600 px-5 text-[12px] font-bold text-white shadow-sm hover:bg-violet-700 lg:mt-7"
            >
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              Generate
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {promptExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-600 transition hover:border-violet-200 hover:bg-violet-100"
              >
                {example}
              </button>
            ))}
          </div>

          {(error || warning) && (
            <div
              className={cn(
                "mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium",
                error
                  ? "border-rose-100 bg-rose-50 text-rose-600"
                  : "border-amber-100 bg-amber-50 text-amber-700"
              )}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">{error ?? warning}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setWarning(null);
                }}
                aria-label="Dismiss message"
                className="rounded p-0.5 opacity-70 hover:bg-white/60 hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </section>

        {generatedApp && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Latest generated preview
              </h2>
              <Link
                href={`/templates/${generatedApp.id}`}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-violet-600 hover:text-violet-700"
              >
                Open full page
                <ArrowUpRight size={13} />
              </Link>
            </div>
            <GeneratedAppPreview template={generatedApp.template} />
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-indigo-950">Created Apps</h2>
              <p className="text-[12px] text-slate-500">Saved JSON templates visible only to your account.</p>
            </div>
          </div>

          {isGenerating && !generatedApp && apps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-violet-200 bg-white p-8 text-center text-[13px] text-slate-500">
              <Loader2 size={18} className="mx-auto mb-2 animate-spin text-violet-500" />
              Generating your first app...
            </div>
          ) : apps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-violet-200 bg-white p-8 text-center">
              <Wand2 size={22} className="mx-auto mb-3 text-violet-400" />
              <p className="text-[14px] font-bold text-indigo-950">No generated apps yet</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Describe a tracker, planner, dashboard, or workflow to create your first one.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {apps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  busy={busyAppId === app.id}
                  onOpen={() => router.push(`/templates/${app.id}`)}
                  onSidebarToggle={() => handleSidebarToggle(app)}
                  onDelete={() => handleDelete(app)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AppCard({
  app,
  busy,
  onOpen,
  onSidebarToggle,
  onDelete,
}: {
  app: GeneratedAppRecord;
  busy: boolean;
  onOpen: () => void;
  onSidebarToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex min-h-[232px] cursor-pointer flex-col rounded-lg border border-slate-100 bg-white p-4 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${app.color}18`, color: app.color }}
        >
          <GeneratedTemplateIcon name={app.icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-bold text-indigo-950">{app.appName}</h3>
          <p className="mt-1 line-clamp-2 min-h-[36px] text-[12px] leading-5 text-slate-500">
            {app.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
          {formatCreatedDate(app.createdAt)}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ backgroundColor: `${app.color}18`, color: app.color }}
        >
          {app.color}
        </span>
        {app.isInSidebar && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
            Sidebar
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-3 text-[11px] font-bold text-violet-600 transition hover:bg-violet-100"
        >
          <ArrowUpRight size={12} />
          Preview
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onSidebarToggle();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <PanelLeft size={12} />}
          {app.isInSidebar ? "Remove" : "Add to Sidebar"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${app.appName}`}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition hover:bg-rose-100 disabled:opacity-50"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}
