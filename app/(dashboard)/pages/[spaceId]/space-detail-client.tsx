"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Folder,
  MoreHorizontal,
  MoveRight,
  Palette,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  archivePage,
  archiveSpace,
  createPage,
  deletePage,
  deleteSpace,
  duplicatePage,
  duplicateSpace,
  exportPage,
  inviteSpaceCollaborator,
  movePage,
  renamePage,
  togglePageFavorite,
  toggleSpaceFavorite,
  updateSpace,
} from "@/lib/actions/pages";
import {
  PAGE_TEMPLATES,
  SPACE_COLORS,
  formatWorkspaceRelativeTime,
  getPageTemplateMeta,
  getSpaceColorMeta,
  type PageDetailRecord,
  type PageListRecord,
  type PageTemplateId,
  type SpaceDetailRecord,
  type SpaceSummaryRecord,
} from "@/lib/pages";
import { cn } from "@/lib/utils";

type SpaceDetailClientProps = {
  initialSpace: SpaceDetailRecord;
  availableSpaces: SpaceSummaryRecord[];
};

type PageFilter = "all" | "favorites" | "archived";

const pageFilters: { id: PageFilter; label: string }[] = [
  { id: "all", label: "All Pages" },
  { id: "favorites", label: "Favorites" },
  { id: "archived", label: "Archived" },
];

export function SpaceDetailClient({ availableSpaces, initialSpace }: SpaceDetailClientProps) {
  const router = useRouter();
  const [space, setSpace] = useState(initialSpace);
  const [spaces, setSpaces] = useState(availableSpaces);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PageFilter>("all");
  const [selectedPageId, setSelectedPageId] = useState<number | null>(() => {
    return initialSpace.pages.find((page) => !page.archivedAt)?.id ?? null;
  });
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [activePageMenuId, setActivePageMenuId] = useState<number | null>(null);
  const [moveDialogPage, setMoveDialogPage] = useState<PageListRecord | null>(null);
  const [moveTargetId, setMoveTargetId] = useState(initialSpace.id);
  const [pageForm, setPageForm] = useState({
    name: "",
    spaceId: initialSpace.id,
    template: "blank" as PageTemplateId,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visiblePages = useMemo(() => {
    const query = search.trim().toLowerCase();

    return space.pages.filter((page) => {
      if (filter !== "archived" && page.archivedAt) return false;
      if (filter === "archived" && !page.archivedAt) return false;
      if (filter === "favorites" && !page.isFavorite) return false;

      if (!query) return true;

      return `${page.name} ${page.description ?? ""} ${getPageTemplateMeta(page.template).label}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, search, space.pages]);

  const selectedPage =
    visiblePages.find((page) => page.id === selectedPageId) ??
    space.pages.find((page) => page.id === selectedPageId) ??
    visiblePages[0] ??
    null;
  const activePageCount = space.pages.filter((page) => !page.archivedAt).length;
  const spaceColor = getSpaceColorMeta(space.color);

  function updateLocalPage(updated: PageListRecord | PageDetailRecord) {
    setSpace((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === updated.id ? updated : page)),
    }));
  }

  function handleCreatePage() {
    if (!pageForm.name.trim()) {
      setError("Add a page name first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const created = await createPage(pageForm);
        if (created.spaceId === space.id) {
          setSpace((current) => ({
            ...current,
            pageCount: current.pageCount + 1,
            pages: [created, ...current.pages],
          }));
          setSelectedPageId(created.id);
        } else {
          router.push(`/pages/${created.spaceId}`);
        }

        setPageForm({ name: "", spaceId: space.id, template: "blank" });
        setNewPageOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create the page.");
      }
    });
  }

  function handleRenamePage(page: PageListRecord) {
    const nextName = window.prompt("Rename page", page.name);
    if (nextName === null) return;

    startTransition(async () => {
      try {
        const updated = await renamePage(page.id, nextName);
        updateLocalPage(updated);
        setActivePageMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the page.");
      }
    });
  }

  function handleMovePage() {
    if (!moveDialogPage) return;

    startTransition(async () => {
      try {
        const moved = await movePage(moveDialogPage.id, moveTargetId);
        if (moved.spaceId === space.id) {
          updateLocalPage(moved);
        } else {
          setSpace((current) => ({
            ...current,
            pageCount: Math.max(0, current.pageCount - 1),
            pages: current.pages.filter((page) => page.id !== moved.id),
          }));
          setSelectedPageId(null);
        }
        setMoveDialogPage(null);
        setActivePageMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not move the page.");
      }
    });
  }

  function handleDuplicatePage(page: PageListRecord) {
    startTransition(async () => {
      try {
        const duplicated = await duplicatePage(page.id);
        setSpace((current) => ({
          ...current,
          pageCount: current.pageCount + 1,
          pages: [duplicated, ...current.pages],
        }));
        setSelectedPageId(duplicated.id);
        setActivePageMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not duplicate the page.");
      }
    });
  }

  function handleTogglePageFavorite(page: PageListRecord) {
    startTransition(async () => {
      try {
        const updated = await togglePageFavorite(page.id);
        updateLocalPage(updated);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the favorite.");
      }
    });
  }

  function handleSharePage(page: PageListRecord) {
    const url = `${window.location.origin}/pages/${page.spaceId}/${page.id}`;
    void navigator.clipboard?.writeText(url);
    setActivePageMenuId(null);
  }

  function handleExportPage(page: PageListRecord) {
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
        setActivePageMenuId(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not export the page.");
      }
    });
  }

  function handleArchivePage(page: PageListRecord) {
    startTransition(async () => {
      try {
        await archivePage(page.id, !page.archivedAt);
        setSpace((current) => ({
          ...current,
          pageCount: current.pageCount + (page.archivedAt ? 1 : -1),
          pages: current.pages.map((item) =>
            item.id === page.id
              ? { ...item, archivedAt: page.archivedAt ? null : new Date().toISOString() }
              : item
          ),
        }));
        setActivePageMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not archive the page.");
      }
    });
  }

  function handleDeletePage(page: PageListRecord) {
    const confirmed = window.confirm(`Delete "${page.name}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deletePage(page.id);
        setSpace((current) => ({
          ...current,
          pageCount: page.archivedAt ? current.pageCount : Math.max(0, current.pageCount - 1),
          pages: current.pages.filter((item) => item.id !== page.id),
        }));
        if (selectedPageId === page.id) setSelectedPageId(null);
        setActivePageMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the page.");
      }
    });
  }

  function handleRenameSpace() {
    const nextName = window.prompt("Rename space", space.name);
    if (nextName === null) return;

    startTransition(async () => {
      try {
        const updated = await updateSpace(space.id, { name: nextName });
        setSpace(updated);
        setSpaceMenuOpen(false);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the space.");
      }
    });
  }

  function handleChangeSpaceColor() {
    const currentIndex = SPACE_COLORS.findIndex((color) => color.value === space.color);
    const color = SPACE_COLORS[(currentIndex + 1) % SPACE_COLORS.length].value;

    startTransition(async () => {
      try {
        const updated = await updateSpace(space.id, { color });
        setSpace(updated);
        setSpaceMenuOpen(false);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the color.");
      }
    });
  }

  function handleInviteSpace() {
    const email = window.prompt("Invite collaborator by email");
    if (email === null) return;

    startTransition(async () => {
      try {
        const updated = await inviteSpaceCollaborator(space.id, email);
        setSpace(updated);
        setSpaceMenuOpen(false);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not invite that collaborator.");
      }
    });
  }

  function handleDuplicateSpace() {
    startTransition(async () => {
      try {
        const duplicated = await duplicateSpace(space.id);
        router.push(`/pages/${duplicated.id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not duplicate the space.");
      }
    });
  }

  function handleToggleSpaceFavorite() {
    startTransition(async () => {
      try {
        const updated = await toggleSpaceFavorite(space.id);
        setSpace(updated);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the favorite.");
      }
    });
  }

  function handleArchiveSpace() {
    startTransition(async () => {
      try {
        await archiveSpace(space.id, !space.archivedAt);
        router.push("/pages");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not archive the space.");
      }
    });
  }

  function handleDeleteSpace() {
    const confirmed = window.confirm(`Delete "${space.name}" and all pages inside it?`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteSpace(space.id);
        router.push("/pages");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the space.");
      }
    });
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-violet-100 bg-white px-5 py-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-slate-400">
            <Link href="/pages" className="transition hover:text-violet-600">
              All Spaces
            </Link>
            <ChevronRight size={14} />
            <span className="text-indigo-950">{space.name}</span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: spaceColor.bg, color: spaceColor.value }}
              >
                <Folder size={24} fill={spaceColor.value + "22"} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[26px] font-bold tracking-normal text-indigo-950">
                    {space.name}
                  </h1>
                  <button
                    type="button"
                    onClick={handleToggleSpaceFavorite}
                    aria-label={space.isFavorite ? "Remove favorite" : "Add favorite"}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-violet-50 hover:text-violet-600"
                  >
                    <Star
                      size={16}
                      className={space.isFavorite ? "fill-amber-400 text-amber-400" : undefined}
                    />
                  </button>
                </div>
                <p className="mt-1 text-[13px] font-medium text-slate-400">
                  {activePageCount} {activePageCount === 1 ? "page" : "pages"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPageForm((current) => ({ ...current, spaceId: space.id }));
                  setError(null);
                  setNewPageOpen(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                disabled={isPending}
              >
                <Plus size={15} />
                New Page
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSpaceMenuOpen((current) => !current)}
                  aria-label="More space actions"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 transition hover:border-violet-200 hover:text-violet-600"
                >
                  <MoreHorizontal size={18} />
                </button>
                {spaceMenuOpen && (
                  <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg">
                    <MenuButton icon={<Folder size={13} />} label="Rename Space" onClick={handleRenameSpace} />
                    <MenuButton icon={<Palette size={13} />} label="Change Color" onClick={handleChangeSpaceColor} />
                    <MenuButton
                      icon={<Plus size={13} />}
                      label="Add Page"
                      onClick={() => {
                        setPageForm((current) => ({ ...current, spaceId: space.id }));
                        setNewPageOpen(true);
                      }}
                    />
                    <MenuButton icon={<UserPlus size={13} />} label="Invite Collaborators" onClick={handleInviteSpace} />
                    <MenuButton icon={<Copy size={13} />} label="Duplicate" onClick={handleDuplicateSpace} />
                    <MenuButton
                      icon={<Archive size={13} />}
                      label={space.archivedAt ? "Restore" : "Archive"}
                      onClick={handleArchiveSpace}
                    />
                    <MenuButton danger icon={<Trash2 size={13} />} label="Delete" onClick={handleDeleteSpace} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pages"
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 pl-10 pr-3 text-[12px] font-medium text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {pageFilters.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "h-10 shrink-0 rounded-xl px-3 text-[11.5px] font-semibold transition",
                    filter === tab.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-600">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
            {visiblePages.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-[20px] font-bold text-indigo-950">
                  {space.pages.length === 0 ? "Add your first page" : "No matching pages"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-slate-400">
                  Pages live inside this space for notes, plans, references, and docs.
                </p>
                {space.pages.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setNewPageOpen(true)}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
                  >
                    <Plus size={15} />
                    New Page
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Page Name
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Type/Template
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Last Updated
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Updated By
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Favorite
                      </th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {visiblePages.map((page) => {
                      const template = getPageTemplateMeta(page.template);
                      const selected = selectedPage?.id === page.id;

                      return (
                        <tr
                          key={page.id}
                          className={cn(
                            "cursor-pointer transition hover:bg-violet-50/50",
                            selected && "bg-violet-50/70"
                          )}
                          onClick={() => setSelectedPageId(page.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                                <FileText size={17} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-bold text-indigo-950">
                                  {page.name}
                                </p>
                                <p className="truncate text-[11.5px] text-slate-400">
                                  {page.description || "No description"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                              style={{ backgroundColor: template.bg, color: template.color }}
                            >
                              {template.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[12px] font-semibold text-slate-500">
                            {formatWorkspaceRelativeTime(page.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            {page.updatedBy ? (
                              <span
                                title={page.updatedBy.name || page.updatedBy.email}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ backgroundColor: page.updatedBy.avatarColor }}
                              >
                                {page.updatedBy.initials}
                              </span>
                            ) : (
                              <span className="text-[12px] text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleTogglePageFavorite(page);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white hover:text-violet-600"
                            >
                              <Star
                                size={15}
                                className={page.isFavorite ? "fill-amber-400 text-amber-400" : undefined}
                              />
                            </button>
                          </td>
                          <td className="relative px-4 py-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActivePageMenuId(activePageMenuId === page.id ? null : page.id);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white hover:text-violet-600"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {activePageMenuId === page.id && (
                              <PageMenu
                                page={page}
                                onArchive={handleArchivePage}
                                onDelete={handleDeletePage}
                                onDuplicate={handleDuplicatePage}
                                onExport={handleExportPage}
                                onFavorite={handleTogglePageFavorite}
                                onMove={(item) => {
                                  setMoveTargetId(item.spaceId);
                                  setMoveDialogPage(item);
                                }}
                                onRename={handleRenamePage}
                                onShare={handleSharePage}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <PagePreview
            page={selectedPage}
            space={space}
            onArchive={handleArchivePage}
            onDelete={handleDeletePage}
            onDuplicate={handleDuplicatePage}
            onExport={handleExportPage}
            onFavorite={handleTogglePageFavorite}
            onMove={(page) => {
              setMoveTargetId(page.spaceId);
              setMoveDialogPage(page);
            }}
            onRename={handleRenamePage}
            onShare={handleSharePage}
          />
        </div>
      </div>

      {newPageOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-indigo-950/20 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-violet-100 bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-500">
                  Create Page
                </p>
                <h2 className="text-[22px] font-bold text-indigo-950">New Page</h2>
              </div>
              <button
                type="button"
                onClick={() => setNewPageOpen(false)}
                className="rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                  Page Name
                </span>
                <input
                  value={pageForm.name}
                  onChange={(event) =>
                    setPageForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  placeholder="Project brief"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                  Add to Space
                </span>
                <select
                  value={pageForm.spaceId}
                  onChange={(event) =>
                    setPageForm((current) => ({ ...current, spaceId: Number(event.target.value) }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[13px] font-semibold text-slate-600 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
                >
                  {spaces
                    .filter((item) => !item.archivedAt)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                  Template
                </span>
                <select
                  value={pageForm.template}
                  onChange={(event) =>
                    setPageForm((current) => ({
                      ...current,
                      template: event.target.value as PageTemplateId,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[13px] font-semibold text-slate-600 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
                >
                  {PAGE_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={handleCreatePage}
                disabled={isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
              >
                <Plus size={15} />
                Create Page
              </button>
            </div>
          </div>
        </div>
      )}

      {moveDialogPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/20 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-violet-100 bg-white p-5 shadow-xl">
            <h2 className="text-[18px] font-bold text-indigo-950">Move page</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-400">{moveDialogPage.name}</p>
            <select
              value={moveTargetId}
              onChange={(event) => setMoveTargetId(Number(event.target.value))}
              className="mt-4 h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[13px] font-semibold text-slate-600 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              {spaces
                .filter((item) => !item.archivedAt)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveDialogPage(null)}
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

function PagePreview({
  onArchive,
  onDelete,
  onDuplicate,
  onExport,
  onFavorite,
  onMove,
  onRename,
  onShare,
  page,
  space,
}: {
  onArchive: (page: PageListRecord) => void;
  onDelete: (page: PageListRecord) => void;
  onDuplicate: (page: PageListRecord) => void;
  onExport: (page: PageListRecord) => void;
  onFavorite: (page: PageListRecord) => void;
  onMove: (page: PageListRecord) => void;
  onRename: (page: PageListRecord) => void;
  onShare: (page: PageListRecord) => void;
  page: PageListRecord | null;
  space: SpaceDetailRecord;
}) {
  if (!page) {
    return (
      <aside className="rounded-2xl border border-dashed border-violet-200 bg-white px-5 py-10 text-center shadow-sm">
        <FileText size={24} className="mx-auto mb-3 text-violet-400" />
        <h2 className="text-[16px] font-bold text-indigo-950">Select a page</h2>
        <p className="mt-2 text-[12px] leading-5 text-slate-400">
          Page details and quick actions appear here.
        </p>
      </aside>
    );
  }

  const template = getPageTemplateMeta(page.template);

  return (
    <aside className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="mb-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ backgroundColor: template.bg, color: template.color }}
          >
            {template.label}
          </span>
          <h2 className="truncate text-[22px] font-bold text-indigo-950">{page.name}</h2>
          <p className="mt-1 text-[12px] font-semibold text-violet-500">{space.name}</p>
        </div>
        <button
          type="button"
          onClick={() => onFavorite(page)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-violet-50 hover:text-violet-600"
        >
          <Star
            size={16}
            className={page.isFavorite ? "fill-amber-400 text-amber-400" : undefined}
          />
        </button>
      </div>

      <p className="min-h-[72px] rounded-2xl bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-500">
        {page.description || "No description added yet."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Comments" value={String(page.commentsCount)} />
        <Metric label="Linked tasks" value={String(page.linkedTasksCount)} />
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 p-4">
        <DetailRow label="Last updated" value={formatWorkspaceRelativeTime(page.updatedAt)} />
        <DetailRow
          label="Last edited by"
          value={page.updatedBy?.name || page.updatedBy?.email || "-"}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={`/pages/${page.spaceId}/${page.id}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <FileText size={14} />
          Open
        </Link>
        <button
          type="button"
          onClick={() => onShare(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[12px] font-semibold text-slate-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <Share2 size={14} />
          Share
        </button>
        <button
          type="button"
          onClick={() => onRename(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[12px] font-semibold text-slate-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <FileText size={14} />
          Rename
        </button>
        <button
          type="button"
          onClick={() => onMove(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[12px] font-semibold text-slate-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <MoveRight size={14} />
          Move
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[12px] font-semibold text-slate-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <Copy size={14} />
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => onExport(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[12px] font-semibold text-slate-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <Download size={14} />
          Export
        </button>
        <button
          type="button"
          onClick={() => onArchive(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[12px] font-semibold text-slate-500 transition hover:border-violet-200 hover:text-violet-600"
        >
          <Archive size={14} />
          {page.archivedAt ? "Restore" : "Archive"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(page)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white text-[12px] font-semibold text-rose-500 transition hover:bg-rose-50"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </aside>
  );
}

function PageMenu({
  onArchive,
  onDelete,
  onDuplicate,
  onExport,
  onFavorite,
  onMove,
  onRename,
  onShare,
  page,
}: {
  onArchive: (page: PageListRecord) => void;
  onDelete: (page: PageListRecord) => void;
  onDuplicate: (page: PageListRecord) => void;
  onExport: (page: PageListRecord) => void;
  onFavorite: (page: PageListRecord) => void;
  onMove: (page: PageListRecord) => void;
  onRename: (page: PageListRecord) => void;
  onShare: (page: PageListRecord) => void;
  page: PageListRecord;
}) {
  return (
    <div className="absolute right-3 top-11 z-20 w-48 rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg">
      <MenuButton icon={<FileText size={13} />} label="Rename" onClick={() => onRename(page)} />
      <MenuButton icon={<MoveRight size={13} />} label="Move" onClick={() => onMove(page)} />
      <MenuButton icon={<Copy size={13} />} label="Duplicate" onClick={() => onDuplicate(page)} />
      <MenuButton icon={<Star size={13} />} label="Favorite" onClick={() => onFavorite(page)} />
      <MenuButton icon={<Share2 size={13} />} label="Share" onClick={() => onShare(page)} />
      <MenuButton icon={<Download size={13} />} label="Export" onClick={() => onExport(page)} />
      <MenuButton
        icon={<Archive size={13} />}
        label={page.archivedAt ? "Restore" : "Archive"}
        onClick={() => onArchive(page)}
      />
      <MenuButton danger icon={<Trash2 size={13} />} label="Delete" onClick={() => onDelete(page)} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="font-semibold text-slate-400">{label}</span>
      <span className="truncate font-semibold text-slate-600">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-violet-50 px-4 py-3">
      <p className="text-[20px] font-bold text-violet-600">{value}</p>
      <p className="text-[11px] font-semibold text-violet-300">{label}</p>
    </div>
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
