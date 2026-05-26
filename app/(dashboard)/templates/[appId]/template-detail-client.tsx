"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  PanelLeft,
  Trash2,
} from "lucide-react";
import { GeneratedAppPreview } from "@/components/generated-app-preview";
import { Button } from "@/components/ui/button";
import {
  addAppToSidebar,
  deleteGeneratedApp,
  removeAppFromSidebar,
} from "@/lib/actions/templates";
import { type GeneratedAppRecord } from "@/lib/templates";

type TemplateDetailClientProps = {
  initialApp: GeneratedAppRecord;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TemplateDetailClient({ initialApp }: TemplateDetailClientProps) {
  const router = useRouter();
  const [app, setApp] = useState(initialApp);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSidebarToggle() {
    setBusy(true);
    setMessage(null);

    try {
      if (app.isInSidebar) {
        const updated = await removeAppFromSidebar(app.id);
        setApp(updated);
      } else {
        const result = await addAppToSidebar(app.id);
        if (result.warning) {
          setMessage(result.warning);
        }
        if (result.app) {
          setApp(result.app);
        }
      }
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not update the sidebar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${app.appName}"?`);
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      await deleteGeneratedApp(app.id);
      router.push("/templates");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not delete that app.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/templates"
              className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-violet-600 hover:text-violet-700"
            >
              <ArrowLeft size={13} />
              Back to templates
            </Link>
            <h1 className="truncate text-[26px] font-bold tracking-tight text-indigo-950">
              {app.appName}
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Created {formatDateTime(app.createdAt)} from saved JSON
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleSidebarToggle}
              disabled={busy}
              variant="outline"
              className="h-9 gap-2 rounded-lg border-violet-100 bg-white text-[12px] font-bold text-slate-600 hover:bg-violet-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PanelLeft size={14} />}
              {app.isInSidebar ? "Remove from Sidebar" : "Add to Sidebar"}
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              variant="outline"
              className="h-9 gap-2 rounded-lg border-rose-100 bg-rose-50 text-[12px] font-bold text-rose-600 hover:bg-rose-100"
            >
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </div>

        {message && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <GeneratedAppPreview template={app.template} />
      </div>
    </div>
  );
}
