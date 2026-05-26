"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { Content } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Bold,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  MoveRight,
  Quote,
  Redo2,
  Share2,
  Star,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import {
  archivePage,
  deletePage,
  duplicatePage,
  exportPage,
  movePage,
  renamePage,
  togglePageFavorite,
  updatePage,
} from "@/lib/actions/pages";
import {
  EMPTY_PAGE_CONTENT,
  formatWorkspaceRelativeTime,
  getPageTemplateMeta,
  type PageContent,
  type PageDetailRecord,
  type PageUpdateInput,
  type SpaceSummaryRecord,
} from "@/lib/pages";
import { cn } from "@/lib/utils";

type PageEditorClientProps = {
  initialPage: PageDetailRecord;
  availableSpaces: SpaceSummaryRecord[];
};

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

function wordCount(text: string | null) {
  return text?.trim().split(/\s+/).filter(Boolean).length ?? 0;
}

export function PageEditorClient({ availableSpaces, initialPage }: PageEditorClientProps) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [spaces] = useState(availableSpaces);
  const [titleDraft, setTitleDraft] = useState(initialPage.name);
  const [descriptionDraft, setDescriptionDraft] = useState(initialPage.description ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [activeMenuOpen, setActiveMenuOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState(initialPage.spaceId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<PageUpdateInput>({});

  const template = getPageTemplateMeta(page.template);

  const flushPendingSaves = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const payload = pendingSaveRef.current;
    if (Object.keys(payload).length === 0) return;

    pendingSaveRef.current = {};
    setSaveStatus("saving");

    startTransition(async () => {
      try {
        const saved = await updatePage(page.id, payload);
        setPage(saved);
        setTitleDraft(saved.name);
        setDescriptionDraft(saved.description ?? "");
        setSaveStatus("saved");
        setError(null);
      } catch (caught) {
        setSaveStatus("error");
        setError(caught instanceof Error ? caught.message : "Could not save the page.");
      }
    });
  }, [page.id]);

  const queuePageSave = useCallback(
    (patch: PageUpdateInput) => {
      pendingSaveRef.current = { ...pendingSaveRef.current, ...patch };
      setSaveStatus("unsaved");

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(flushPendingSaves, 700);
    },
    [flushPendingSaves]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing or press the toolbar for structure",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: (page.content ?? EMPTY_PAGE_CONTENT) as Content,
    editorProps: {
      attributes: {
        class:
          "notes-editor-content min-h-[560px] w-full max-w-none px-5 pb-24 pt-6 text-[15px] leading-8 text-slate-700 outline-none sm:px-8 lg:px-12",
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON() as PageContent;
      const plainText = editor.getText();
      const now = new Date().toISOString();

      setPage((current) => ({
        ...current,
        content,
        plainText,
        updatedAt: now,
      }));
      queuePageSave({ content, plainText });
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  function handleTitleChange(value: string) {
    setTitleDraft(value);

    if (!value.trim()) return;

    setPage((current) => ({
      ...current,
      name: value,
      updatedAt: new Date().toISOString(),
    }));
    queuePageSave({ name: value });
  }

  function handleDescriptionChange(value: string) {
    setDescriptionDraft(value);
    setPage((current) => ({
      ...current,
      description: value || null,
      updatedAt: new Date().toISOString(),
    }));
    queuePageSave({ description: value });
  }

  function handleRenamePrompt() {
    const nextName = window.prompt("Rename page", titleDraft);
    if (nextName === null) return;

    startTransition(async () => {
      try {
        const updated = await renamePage(page.id, nextName);
        setPage(updated);
        setTitleDraft(updated.name);
        setActiveMenuOpen(false);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the page.");
      }
    });
  }

  function handleMovePage() {
    startTransition(async () => {
      try {
        const moved = await movePage(page.id, moveTargetId);
        router.push(`/pages/${moved.spaceId}/${moved.id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not move the page.");
      }
    });
  }

  function handleDuplicatePage() {
    startTransition(async () => {
      try {
        const duplicated = await duplicatePage(page.id);
        router.push(`/pages/${duplicated.spaceId}/${duplicated.id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not duplicate the page.");
      }
    });
  }

  function handleToggleFavorite() {
    startTransition(async () => {
      try {
        const updated = await togglePageFavorite(page.id);
        setPage(updated);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the favorite.");
      }
    });
  }

  function handleSharePage() {
    const url = `${window.location.origin}/pages/${page.spaceId}/${page.id}`;
    void navigator.clipboard?.writeText(url);
    setActiveMenuOpen(false);
  }

  function handleExportPage() {
    startTransition(async () => {
      try {
        const exported = await exportPage(page.id);
        const blob = new Blob([exported.content], { type: "text/markdown;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = exported.filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
        setActiveMenuOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not export the page.");
      }
    });
  }

  function handleArchivePage() {
    startTransition(async () => {
      try {
        await archivePage(page.id, true);
        router.push(`/pages/${page.spaceId}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not archive the page.");
      }
    });
  }

  function handleDeletePage() {
    const confirmed = window.confirm(`Delete "${page.name}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deletePage(page.id);
        router.push(`/pages/${page.spaceId}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the page.");
      }
    });
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-slate-400">
              <Link href="/pages" className="transition hover:text-violet-600">
                All Spaces
              </Link>
              <ChevronRight size={14} />
              <Link href={`/pages/${page.spaceId}`} className="transition hover:text-violet-600">
                {page.space.name}
              </Link>
              <ChevronRight size={14} />
              <span className="text-indigo-950">{page.name}</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: template.bg, color: template.color }}
                  >
                    {template.label}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-300">
                    {wordCount(page.plainText)} words
                  </span>
                  <SaveStatusBadge status={saveStatus} />
                </div>
                <input
                  value={titleDraft}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  className="w-full min-w-0 border-none bg-transparent text-[30px] font-bold leading-tight tracking-normal text-indigo-950 outline-none placeholder:text-slate-200 sm:text-[36px]"
                  placeholder="Untitled page"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  aria-label={page.isFavorite ? "Remove favorite" : "Add favorite"}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-300 transition hover:border-violet-200 hover:text-violet-600"
                >
                  <Star
                    size={17}
                    className={page.isFavorite ? "fill-amber-400 text-amber-400" : undefined}
                  />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenuOpen((current) => !current)}
                    aria-label="More page actions"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 transition hover:border-violet-200 hover:text-violet-600"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeMenuOpen && (
                    <div className="absolute right-0 top-12 z-20 w-52 rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg">
                      <MenuButton icon={<FileText size={13} />} label="Rename" onClick={handleRenamePrompt} />
                      <MenuButton icon={<MoveRight size={13} />} label="Move" onClick={() => setMoveDialogOpen(true)} />
                      <MenuButton icon={<Copy size={13} />} label="Duplicate" onClick={handleDuplicatePage} />
                      <MenuButton icon={<Star size={13} />} label="Favorite" onClick={handleToggleFavorite} />
                      <MenuButton icon={<Share2 size={13} />} label="Share" onClick={handleSharePage} />
                      <MenuButton icon={<Download size={13} />} label="Export" onClick={handleExportPage} />
                      <MenuButton icon={<Archive size={13} />} label="Archive" onClick={handleArchivePage} />
                      <MenuButton danger icon={<Trash2 size={13} />} label="Delete" onClick={handleDeletePage} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[1fr_280px_280px]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                Description
              </span>
              <input
                value={descriptionDraft}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                placeholder="Add a short description"
                className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[12px] font-medium text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </label>
            <DetailPill label="Comments" value={String(page.commentsCount)} />
            <DetailPill label="Linked tasks" value={String(page.linkedTasksCount)} />
          </div>

          <div className="grid gap-3 px-5 py-4 text-[12px] font-semibold text-slate-400 sm:grid-cols-3">
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Space
              </span>
              <span className="text-slate-600">{page.space.name}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Last edited by
              </span>
              <span className="text-slate-600">
                {page.updatedBy?.name || page.updatedBy?.email || "-"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Last updated
              </span>
              <span className="text-slate-600">{formatWorkspaceRelativeTime(page.updatedAt)}</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-600">
            {error}
          </div>
        )}

        <main className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
          {editor && <EditorToolbar editor={editor} onFlush={flushPendingSaves} />}
          <div className="notes-editor sidebar-scroll min-h-[640px] overflow-y-auto bg-white">
            <EditorContent editor={editor} />
          </div>
        </main>
      </div>

      {moveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/20 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-violet-100 bg-white p-5 shadow-xl">
            <h2 className="text-[18px] font-bold text-indigo-950">Move page</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-400">{page.name}</p>
            <select
              value={moveTargetId}
              onChange={(event) => setMoveTargetId(Number(event.target.value))}
              className="mt-4 h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[13px] font-semibold text-slate-600 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              {spaces
                .filter((space) => !space.archivedAt)
                .map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveDialogOpen(false)}
                className="h-10 rounded-xl px-4 text-[12px] font-semibold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMovePage}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                <MoveRight size={14} />
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorToolbar({ editor, onFlush }: { editor: Editor; onFlush: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-white px-4 py-2">
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </ToolbarButton>
      <Divider />
      <button
        type="button"
        onClick={onFlush}
        className="ml-auto inline-flex h-8 items-center rounded-xl bg-violet-600 px-3 text-[11px] font-semibold text-white transition hover:bg-violet-700"
      >
        Save
      </button>
    </div>
  );
}

function ToolbarButton({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-violet-50 hover:text-violet-600",
        active && "bg-violet-50 text-violet-600"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-100" />;
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
        {label}
      </span>
      <span className="text-[15px] font-bold text-indigo-950">{value}</span>
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const labels: Record<SaveStatus, string> = {
    saved: "Saved",
    unsaved: "Unsaved",
    saving: "Saving",
    error: "Save error",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
        status === "saved" && "bg-emerald-50 text-emerald-600",
        status === "unsaved" && "bg-amber-50 text-amber-600",
        status === "saving" && "bg-violet-50 text-violet-600",
        status === "error" && "bg-rose-50 text-rose-600"
      )}
    >
      {labels[status]}
    </span>
  );
}

function MenuButton({
  danger,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11.5px] font-semibold transition",
        danger
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
