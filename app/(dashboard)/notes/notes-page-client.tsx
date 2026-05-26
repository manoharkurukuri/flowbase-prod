"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Extension, type Content, type Range } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import {
  AlignLeft,
  Bold,
  Check,
  CheckSquare,
  ChevronDown,
  Code2,
  Copy,
  FileText,
  Grip,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Mic,
  Minus,
  MoreHorizontal,
  Palette,
  Pin,
  PinOff,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Strikethrough,
  Tags,
  Text,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import {
  useAssemblyAIStreening,
  type AssemblyAIStreamingStatus,
} from "@/hooks/useAssemblyAIStreening";
import {
  createNote,
  duplicateNote,
  moveNoteToTrash,
  permanentlyDeleteNote,
  renameNote,
  restoreNote,
  toggleNotePinned,
  updateNote,
  updateNoteCategory,
  updateNoteColor,
} from "@/lib/actions/notes";
import {
  AI_REFINE_ACTIONS,
  EMPTY_NOTE_CONTENT,
  NOTE_COLORS,
  getNoteColorMeta,
  type AiRefineAction,
  type NoteContent,
  type NoteRecord,
  type NoteUpdateInput,
} from "@/lib/notes";
import { getCategoryMeta, type CategoryOption } from "@/lib/settings";
import { cn } from "@/lib/utils";

type NotesPageClientProps = {
  initialNotes: NoteRecord[];
  categories: CategoryOption[];
  autoSaveEnabled: boolean;
};

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

type SlashCommandItem = {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: Range }) => void;
};

type SlashRenderProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect?: (() => DOMRect | null) | null;
};

const slashPluginKey = new PluginKey("notes-slash-commands");

const aiRefineLabels: Record<AiRefineAction, string> = {
  "improve-grammar": "Improve grammar",
  rephrase: "Rephrase",
  "make-shorter": "Make shorter",
  "make-longer": "Make longer",
  "simplify-language": "Simplify language",
  "change-tone": "Change tone",
};

const slashItems: SlashCommandItem[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: "T",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large section title",
    icon: "H1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section title",
    icon: "H2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section title",
    icon: "H3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet list",
    description: "Simple unordered list",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered list",
    description: "Ordered list",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task list",
    description: "Checkbox to-dos",
    icon: "[]",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    description: "Capture a quote or aside",
    icon: "''",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code block",
    description: "Monospace block",
    icon: "</>",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    description: "Horizontal separator",
    icon: "--",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: slashPluginKey,
        startOfLine: true,
        items: ({ query }: { query: string }) => {
          return slashItems
            .filter((item) => {
              const searchable = `${item.title} ${item.description}`.toLowerCase();
              return searchable.includes(query.toLowerCase());
            })
            .slice(0, 8);
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
        render: () => {
          let element: HTMLDivElement | null = null;
          let selectedIndex = 0;
          let currentProps: SlashRenderProps | null = null;

          const updatePosition = () => {
            if (!element || !currentProps?.clientRect) return;
            const rect = currentProps.clientRect();
            if (!rect) return;

            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.bottom + 8}px`;
          };

          const renderItems = () => {
            if (!element || !currentProps) return;
            const container = element;
            container.replaceChildren();

            const items = currentProps.items;
            if (items.length === 0) {
              const empty = document.createElement("div");
              empty.className = "px-3 py-2 text-[12px] font-medium text-slate-400";
              empty.textContent = "No blocks found";
              container.append(empty);
              updatePosition();
              return;
            }

            items.forEach((item, index) => {
              const button = document.createElement("button");
              button.type = "button";
              button.className = [
                "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition",
                index === selectedIndex
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-600 hover:bg-slate-50",
              ].join(" ");
              button.addEventListener("mousedown", (event) => {
                event.preventDefault();
                currentProps?.command(item);
              });

              const icon = document.createElement("span");
              icon.className =
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[10px] font-bold text-amber-600";
              icon.textContent = item.icon;

              const copy = document.createElement("span");
              copy.className = "min-w-0 flex-1";

              const title = document.createElement("span");
              title.className = "block truncate text-[12px] font-semibold";
              title.textContent = item.title;

              const description = document.createElement("span");
              description.className = "block truncate text-[10.5px] text-slate-400";
              description.textContent = item.description;

              copy.append(title, description);
              button.append(icon, copy);
              container.append(button);
            });

            updatePosition();
          };

          const selectItem = (index: number) => {
            const item = currentProps?.items[index];
            if (item) {
              currentProps?.command(item);
            }
          };

          return {
            onStart: (props: SlashRenderProps) => {
              currentProps = props;
              selectedIndex = 0;
              element = document.createElement("div");
              element.className =
                "fixed z-[70] w-64 overflow-hidden rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg";
              document.body.append(element);
              renderItems();
            },
            onUpdate: (props: SlashRenderProps) => {
              currentProps = props;
              selectedIndex = Math.min(selectedIndex, Math.max(props.items.length - 1, 0));
              renderItems();
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (!currentProps) return false;
              if (currentProps.items.length === 0) return false;

              if (event.key === "ArrowUp") {
                selectedIndex =
                  (selectedIndex + currentProps.items.length - 1) % currentProps.items.length;
                renderItems();
                return true;
              }

              if (event.key === "ArrowDown") {
                selectedIndex = (selectedIndex + 1) % currentProps.items.length;
                renderItems();
                return true;
              }

              if (event.key === "Enter") {
                selectItem(selectedIndex);
                return true;
              }

              return false;
            },
            onExit: () => {
              element?.remove();
              element = null;
              currentProps = null;
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

function sortNotes(notes: NoteRecord[]) {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function formatUpdatedAt(value: string) {
  const then = new Date(value).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));

  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getWordCount(text: string | null | undefined) {
  const words = text?.trim().match(/\S+/g);
  return words?.length ?? 0;
}

function getSelectedText(editor: Editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, "\n").trim();
}

function clampEditorPosition(editor: Editor, position: number) {
  return Math.max(0, Math.min(position, editor.state.doc.content.size));
}

function getVoiceInsertionAnchor(editor: Editor) {
  if (!editor.isFocused) {
    return editor.state.doc.content.size;
  }

  return clampEditorPosition(editor, editor.state.selection.to);
}

function shouldInsertSpaceBeforeVoiceText(editor: Editor, position: number, text: string) {
  if (!text || /^\s/.test(text) || /^[,.;:!?)]/.test(text)) {
    return false;
  }

  if (position <= 0) {
    return false;
  }

  const previousCharacter = editor.state.doc.textBetween(
    Math.max(0, position - 1),
    position,
    "\n",
    "\n"
  );

  return Boolean(previousCharacter) && !/\s/.test(previousCharacter);
}

export function NotesPageClient({
  initialNotes,
  categories,
  autoSaveEnabled,
}: NotesPageClientProps) {
  const [notes, setNotes] = useState(() => sortNotes(initialNotes));
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(() => {
    return initialNotes.find((note) => !note.trashedAt)?.id ?? null;
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [trashOpen, setTrashOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiBusyAction, setAiBusyAction] = useState<AiRefineAction | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedNoteIdRef = useRef<number | null>(selectedNoteId);
  const saveTimerRef = useRef<number | null>(null);
  const pendingSavesRef = useRef(new Map<number, NoteUpdateInput>());
  const selectionRef = useRef<{ from: number; to: number } | null>(null);
  const loadedNoteIdRef = useRef<number | null>(null);
  const voiceInsertionRef = useRef<number | null>(null);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const activeNotes = notes.filter((note) => !note.trashedAt);
  const trashedNotes = notes.filter((note) => note.trashedAt);

  const filteredActiveNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeNotes.filter((note) => {
      const matchesSearch =
        !query || `${note.title} ${note.plainText ?? ""}`.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "all" || note.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [activeNotes, categoryFilter, search]);

  const pinnedNotes = filteredActiveNotes.filter((note) => note.isPinned);
  const unpinnedNotes = filteredActiveNotes.filter((note) => !note.isPinned);

  const updateLocalNote = useCallback((updated: NoteRecord) => {
    setNotes((current) => sortNotes(current.map((note) => (note.id === updated.id ? updated : note))));
  }, []);

  const flushPendingSaves = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const entries = Array.from(pendingSavesRef.current.entries());
    if (entries.length === 0) return;

    pendingSavesRef.current.clear();
    setSaveStatus("saving");

    startTransition(async () => {
      try {
        const savedNotes = await Promise.all(
          entries.map(([noteId, payload]) => updateNote(noteId, payload))
        );
        setNotes((current) => {
          const next = current.map((note) => {
            const saved = savedNotes.find((item) => item.id === note.id);
            return saved ?? note;
          });
          return sortNotes(next);
        });
        const selectedSavedNote = savedNotes.find((note) => note.id === selectedNoteIdRef.current);
        if (selectedSavedNote) {
          setTitleDraft(selectedSavedNote.title);
        }
        setSaveStatus("saved");
        setError(null);
      } catch (caught) {
        setSaveStatus("error");
        setError(caught instanceof Error ? caught.message : "Could not save the note.");
      }
    });
  }, []);

  const queueNoteSave = useCallback(
    (noteId: number, patch: NoteUpdateInput) => {
      const existing = pendingSavesRef.current.get(noteId) ?? {};
      pendingSavesRef.current.set(noteId, { ...existing, ...patch });
      setSaveStatus("unsaved");

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      if (autoSaveEnabled) {
        saveTimerRef.current = window.setTimeout(flushPendingSaves, 700);
      }
    },
    [autoSaveEnabled, flushPendingSaves]
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
        placeholder: "Press / for commands",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      SlashCommand,
    ],
    content: (selectedNote?.content ?? EMPTY_NOTE_CONTENT) as Content,
    editable: Boolean(selectedNote && !selectedNote.trashedAt),
    editorProps: {
      attributes: {
        class:
          "notes-editor-content min-h-[520px] w-full max-w-none px-5 pb-24 pt-6 text-[15px] leading-8 text-slate-700 outline-none sm:px-8 lg:px-12",
      },
    },
    onUpdate: ({ editor }) => {
      const noteId = selectedNoteIdRef.current;
      if (!noteId) return;

      const content = editor.getJSON() as NoteContent;
      const plainText = editor.getText();
      const now = new Date().toISOString();

      setNotes((current) =>
        sortNotes(
          current.map((note) =>
            note.id === noteId ? { ...note, content, plainText, updatedAt: now } : note
          )
        )
      );
      queueNoteSave(noteId, { content, plainText });
    },
  });

  const insertVoiceTranscript = useCallback(
    (delta: string) => {
      if (!editor || editor.isDestroyed) return;

      const noteId = selectedNoteIdRef.current;
      if (!noteId || !delta.trim()) return;

      const position = clampEditorPosition(
        editor,
        voiceInsertionRef.current ?? editor.state.doc.content.size
      );
      const text = shouldInsertSpaceBeforeVoiceText(editor, position, delta) ? ` ${delta}` : delta;

      editor.chain().focus().insertContentAt(position, text).run();
      voiceInsertionRef.current = editor.state.selection.to;

      const content = editor.getJSON() as NoteContent;
      const plainText = editor.getText();
      const now = new Date().toISOString();

      setNotes((current) =>
        sortNotes(
          current.map((note) =>
            note.id === noteId ? { ...note, content, plainText, updatedAt: now } : note
          )
        )
      );
      queueNoteSave(noteId, { content, plainText });
    },
    [editor, queueNoteSave]
  );

  const {
    error: speechError,
    liveTranscript,
    start: startSpeech,
    status: speechStatus,
    stop: stopSpeech,
  } = useAssemblyAIStreening({
    onFinalTranscript: insertVoiceTranscript,
  });

  const handleStartSpeech = useCallback(() => {
    if (!editor || editor.isDestroyed || !selectedNote || selectedNote.trashedAt) return;

    const anchor = getVoiceInsertionAnchor(editor);
    voiceInsertionRef.current = anchor;

    if (editor.isFocused) {
      editor.commands.setTextSelection(anchor);
    }

    setError(null);
    void startSpeech();
  }, [editor, selectedNote, startSpeech]);

  useEffect(() => {
    if (speechError) {
      setError(speechError);
    }
  }, [speechError]);

  useEffect(() => {
    return () => {
      voiceInsertionRef.current = null;
      stopSpeech();
    };
  }, [selectedNoteId, selectedNote?.trashedAt, stopSpeech]);

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  useEffect(() => {
    if (!selectedNote) {
      setTitleDraft("");
      loadedNoteIdRef.current = null;
      return;
    }

    if (editor && !editor.isDestroyed) {
      editor.setEditable(!selectedNote.trashedAt);

      if (loadedNoteIdRef.current !== selectedNote.id) {
        editor.commands.setContent(selectedNote.content as Content, { emitUpdate: false });
        loadedNoteIdRef.current = selectedNote.id;
      }
    }

    setTitleDraft(selectedNote.title);
    setSaveStatus(pendingSavesRef.current.size ? "unsaved" : "saved");
  }, [editor, selectedNoteId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  function handleCreateNote() {
    startTransition(async () => {
      try {
        const created = await createNote({
          title: "Untitled note",
          category: categoryFilter === "all" ? categories[0]?.key : categoryFilter,
        });
        setNotes((current) => sortNotes([created, ...current]));
        setSelectedNoteId(created.id);
        setTrashOpen(false);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create a note.");
      }
    });
  }

  function handleTitleChange(value: string) {
    if (!selectedNote || selectedNote.trashedAt) return;

    setTitleDraft(value);
    const now = new Date().toISOString();
    setNotes((current) =>
      sortNotes(
        current.map((note) => (note.id === selectedNote.id ? { ...note, title: value, updatedAt: now } : note))
      )
    );
    queueNoteSave(selectedNote.id, { title: value });
  }

  function handleRename(note: NoteRecord) {
    const nextTitle = window.prompt("Rename note", note.title);
    if (nextTitle === null) return;

    startTransition(async () => {
      try {
        const updated = await renameNote(note.id, nextTitle);
        updateLocalNote(updated);
        if (selectedNoteId === note.id) setTitleDraft(updated.title);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the note.");
      }
    });
  }

  function handleDuplicate(note: NoteRecord) {
    startTransition(async () => {
      try {
        const duplicated = await duplicateNote(note.id);
        setNotes((current) => sortNotes([duplicated, ...current]));
        setSelectedNoteId(duplicated.id);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not duplicate the note.");
      }
    });
  }

  function handleTogglePin(note: NoteRecord) {
    startTransition(async () => {
      try {
        const updated = await toggleNotePinned(note.id);
        updateLocalNote(updated);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the pin.");
      }
    });
  }

  function handleColor(note: NoteRecord, color: string) {
    startTransition(async () => {
      try {
        const updated = await updateNoteColor(note.id, color);
        updateLocalNote(updated);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the note color.");
      }
    });
  }

  function handleCategory(note: NoteRecord, category: string) {
    startTransition(async () => {
      try {
        const updated = await updateNoteCategory(note.id, category);
        updateLocalNote(updated);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the note category.");
      }
    });
  }

  function handleTrash(note: NoteRecord) {
    startTransition(async () => {
      try {
        const updated = await moveNoteToTrash(note.id);
        updateLocalNote(updated);
        if (selectedNoteId === note.id) {
          const next = activeNotes.find((item) => item.id !== note.id) ?? null;
          setSelectedNoteId(next?.id ?? null);
        }
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not move the note to trash.");
      }
    });
  }

  function handleRestore(note: NoteRecord) {
    startTransition(async () => {
      try {
        const restored = await restoreNote(note.id);
        updateLocalNote(restored);
        setSelectedNoteId(restored.id);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not restore the note.");
      }
    });
  }

  function handlePermanentDelete(note: NoteRecord) {
    const shouldDelete = window.confirm(`Permanently delete "${note.title}"?`);
    if (!shouldDelete) return;

    startTransition(async () => {
      try {
        await permanentlyDeleteNote(note.id);
        setNotes((current) => current.filter((item) => item.id !== note.id));
        if (selectedNoteId === note.id) {
          setSelectedNoteId(activeNotes[0]?.id ?? null);
        }
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the note.");
      }
    });
  }

  async function handleAiRefine(action: AiRefineAction) {
    if (!editor || !selectedNote || selectedNote.trashedAt) return;
    const { from, to } = editor.state.selection;
    const selectedText = getSelectedText(editor);

    if (!selectedText) {
      setError("Select text before using AI Refine.");
      return;
    }

    selectionRef.current = { from, to };
    setAiBusyAction(action);
    setAiMenuOpen(false);
    setError(null);

    try {
      const response = await fetch("/api/notes/ai-refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, selectedText }),
      });

      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "AI Refine could not process that text.");
      }

      if (selectedNoteIdRef.current !== selectedNote.id) {
        return;
      }

      const range = selectionRef.current ?? { from, to };
      editor.chain().focus().insertContentAt(range, data.text).run();
      const content = editor.getJSON() as NoteContent;
      const plainText = editor.getText();
      queueNoteSave(selectedNote.id, { content, plainText });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI Refine failed.");
    } finally {
      selectionRef.current = null;
      setAiBusyAction(null);
    }
  }

  const wordCount = getWordCount(selectedNote?.plainText ?? editor?.getText() ?? "");

  return (
    <div className="flex min-h-full flex-col gap-4 p-3 sm:p-4 lg:h-full lg:flex-row lg:gap-0 lg:p-0">
      <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm lg:h-full lg:w-[340px] lg:rounded-none lg:border-y-0 lg:border-l-0">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <FileText size={16} className="text-amber-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-500">
                  Notes
                </span>
              </div>
              <h1 className="truncate text-[20px] font-bold tracking-tight text-indigo-950">
                Cozy pages
              </h1>
            </div>
            <button
              type="button"
              onClick={handleCreateNote}
              disabled={isPending}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-3 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              <Plus size={14} />
              New Note
            </button>
          </div>

          <label className="relative block">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes"
              className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-[12px] font-medium text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </label>

          <label className="mt-2 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
              <Tags size={11} />
              Category
            </span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-9 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[11.5px] font-semibold text-slate-500 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              <option value="all">All notes</option>
              {categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mx-3 mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11.5px] font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3">
          {activeNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <Sparkles size={18} className="mx-auto mb-2 text-amber-500" />
              <p className="text-[12px] font-semibold text-slate-600">No notes yet</p>
              <button
                type="button"
                onClick={handleCreateNote}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <Plus size={13} />
                Create note
              </button>
            </div>
          ) : filteredActiveNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] font-medium text-slate-400">
              No matching notes
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedNotes.length > 0 && (
                <NoteSection
                  label="Pinned"
                  notes={pinnedNotes}
                  categories={categories}
                  selectedNoteId={selectedNoteId}
                  activeMenuId={activeMenuId}
                  onSelect={setSelectedNoteId}
                  onToggleMenu={setActiveMenuId}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onTogglePin={handleTogglePin}
                  onColor={handleColor}
                  onCategory={handleCategory}
                  onTrash={handleTrash}
                />
              )}
              <NoteSection
                label={pinnedNotes.length > 0 ? "Notes" : "All Notes"}
                notes={unpinnedNotes}
                categories={categories}
                selectedNoteId={selectedNoteId}
                activeMenuId={activeMenuId}
                onSelect={setSelectedNoteId}
                onToggleMenu={setActiveMenuId}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onTogglePin={handleTogglePin}
                onColor={handleColor}
                onCategory={handleCategory}
                onTrash={handleTrash}
              />
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white px-3 py-3">
          <button
            type="button"
            onClick={() => setTrashOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 size={14} className="text-rose-400" />
              Trash
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
              {trashedNotes.length}
            </span>
          </button>

          {trashOpen && (
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
              {trashedNotes.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-slate-400">Trash is empty.</p>
              ) : (
                trashedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: note.color }}
                      />
                      <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-600">
                        {note.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRestore(note)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10.5px] font-semibold text-violet-600 shadow-sm transition hover:bg-violet-50"
                      >
                        <RotateCcw size={11} />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(note)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10.5px] font-semibold text-rose-500 shadow-sm transition hover:bg-rose-50"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm lg:h-full lg:rounded-none lg:border-y-0 lg:border-r-0">
        {selectedNote ? (
          <div className="flex h-full min-h-[680px] flex-col overflow-hidden lg:min-h-0">
            <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shadow-sm"
                    style={{ backgroundColor: selectedNote.color }}
                  />
                  <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {selectedNote.trashedAt ? "In Trash" : "Writing"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <SaveStatusBadge status={saveStatus} />
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                  <span>{wordCount} words</span>
                </div>
              </div>

              <input
                value={titleDraft}
                onChange={(event) => handleTitleChange(event.target.value)}
                disabled={Boolean(selectedNote.trashedAt)}
                placeholder="Untitled note"
                className="w-full min-w-0 border-none bg-transparent text-[30px] font-bold leading-tight tracking-normal text-indigo-950 outline-none placeholder:text-slate-200 disabled:text-slate-400 sm:text-[36px]"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Tags size={13} className="text-slate-300" />
                {categories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    disabled={Boolean(selectedNote.trashedAt)}
                    onClick={() => handleCategory(selectedNote, category.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition disabled:opacity-60",
                      selectedNote.category === category.key && "shadow-sm"
                    )}
                    style={{
                      borderColor: category.border,
                      backgroundColor: selectedNote.category === category.key ? category.bg : "#ffffff",
                      color: category.color,
                    }}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            {!selectedNote.trashedAt && editor && (
              <EditorToolbar
                editor={editor}
                liveTranscript={liveTranscript}
                onFlush={flushPendingSaves}
                onStartSpeech={handleStartSpeech}
                onStopSpeech={stopSpeech}
                speechStatus={speechStatus}
              />
            )}

            <div className="notes-editor sidebar-scroll min-h-0 flex-1 overflow-y-auto bg-white">
              {editor && !selectedNote.trashedAt && (
                <BubbleMenu
                  editor={editor}
                  pluginKey="notes-bubble-menu"
                  shouldShow={({ editor }) => {
                    return !editor.state.selection.empty && Boolean(getSelectedText(editor));
                  }}
                  options={{
                    placement: "top",
                    offset: 8,
                    flip: true,
                    shift: true,
                  }}
                >
                  <div className="relative flex items-center gap-1 rounded-2xl border border-violet-100 bg-white p-1 shadow-lg">
                    <BubbleButton
                      label="Bold"
                      active={editor.isActive("bold")}
                      onClick={() => editor.chain().focus().toggleBold().run()}
                    >
                      <Bold size={13} />
                    </BubbleButton>
                    <BubbleButton
                      label="Italic"
                      active={editor.isActive("italic")}
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                    >
                      <Italic size={13} />
                    </BubbleButton>
                    <BubbleButton
                      label="Underline"
                      active={editor.isActive("underline")}
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                    >
                      <UnderlineIcon size={13} />
                    </BubbleButton>
                    <div className="mx-1 h-5 w-px bg-slate-100" />
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setAiMenuOpen((current) => !current);
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-violet-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-violet-700"
                    >
                      {aiBusyAction ? <Sparkles size={13} /> : <Wand2 size={13} />}
                      AI Refine
                      <ChevronDown size={12} />
                    </button>

                    {aiMenuOpen && (
                      <div className="absolute left-1/2 top-10 z-[80] w-48 -translate-x-1/2 rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg">
                        {AI_REFINE_ACTIONS.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              void handleAiRefine(action);
                            }}
                            disabled={Boolean(aiBusyAction)}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11.5px] font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-60"
                          >
                            <Sparkles size={12} className="text-violet-500" />
                            {aiRefineLabels[action]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </BubbleMenu>
              )}

              <EditorContent editor={editor} />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[640px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <FileText size={24} />
            </div>
            <h2 className="text-[22px] font-bold text-indigo-950">Start a note</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-6 text-slate-400">
              Create a page, pick a color, and start shaping ideas with blocks and AI refinement.
            </p>
            <button
              type="button"
              onClick={handleCreateNote}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus size={14} />
              New Note
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function NoteSection({
  label,
  notes,
  categories,
  selectedNoteId,
  activeMenuId,
  onSelect,
  onToggleMenu,
  onRename,
  onDuplicate,
  onTogglePin,
  onColor,
  onCategory,
  onTrash,
}: {
  label: string;
  notes: NoteRecord[];
  categories: CategoryOption[];
  selectedNoteId: number | null;
  activeMenuId: number | null;
  onSelect: (id: number) => void;
  onToggleMenu: (id: number | null) => void;
  onRename: (note: NoteRecord) => void;
  onDuplicate: (note: NoteRecord) => void;
  onTogglePin: (note: NoteRecord) => void;
  onColor: (note: NoteRecord, color: string) => void;
  onCategory: (note: NoteRecord, category: string) => void;
  onTrash: (note: NoteRecord) => void;
}) {
  if (notes.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
        {label}
      </h2>
      <div className="space-y-2">
        {notes.map((note) => (
          <NoteListItem
            key={note.id}
            note={note}
            categories={categories}
            selected={note.id === selectedNoteId}
            menuOpen={note.id === activeMenuId}
            onSelect={() => onSelect(note.id)}
            onToggleMenu={() => onToggleMenu(activeMenuId === note.id ? null : note.id)}
            onRename={() => onRename(note)}
            onDuplicate={() => onDuplicate(note)}
            onTogglePin={() => onTogglePin(note)}
            onColor={(color) => onColor(note, color)}
            onCategory={(category) => onCategory(note, category)}
            onTrash={() => onTrash(note)}
          />
        ))}
      </div>
    </section>
  );
}

function NoteListItem({
  note,
  categories,
  selected,
  menuOpen,
  onSelect,
  onToggleMenu,
  onRename,
  onDuplicate,
  onTogglePin,
  onColor,
  onCategory,
  onTrash,
}: {
  note: NoteRecord;
  categories: CategoryOption[];
  selected: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onColor: (color: string) => void;
  onCategory: (category: string) => void;
  onTrash: () => void;
}) {
  const color = getNoteColorMeta(note.color);
  const category = getCategoryMeta(categories, note.category);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition",
          selected
            ? "border-violet-200 bg-violet-50/70 shadow-sm"
            : "border-slate-100 bg-white hover:border-violet-100 hover:bg-slate-50"
        )}
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
          style={{ backgroundColor: color.bg, borderColor: color.border, color: color.value }}
        >
          <FileText size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex min-w-0 items-center gap-2">
            <span className="truncate text-[12.5px] font-bold text-indigo-950">{note.title}</span>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: note.color }}
            />
          </span>
          <span className="line-clamp-1 text-[11px] leading-5 text-slate-400">
            {note.plainText || "Press / for commands"}
          </span>
          <span className="mt-1.5 flex items-center gap-2 text-[10.5px] font-medium text-slate-300">
            <span>{formatUpdatedAt(note.updatedAt)}</span>
            <span
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: color.bg, color: color.value }}
            >
              {color.label}
            </span>
            {category && (
              <span
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: category.bg, color: category.color }}
              >
                {category.label}
              </span>
            )}
          </span>
        </span>
        {note.isPinned && <Pin size={13} className="mt-1 shrink-0 fill-amber-400 text-amber-400" />}
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-300 shadow-sm transition hover:text-amber-500"
          aria-label={note.isPinned ? "Unpin note" : "Pin note"}
          title={note.isPinned ? "Unpin note" : "Pin note"}
        >
          {note.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-300 shadow-sm transition hover:text-violet-600"
          aria-label="Note actions"
          title="Note actions"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-2 top-10 z-30 w-56 rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg">
          <ActionButton icon={<Text size={12} />} label="Rename" onClick={onRename} />
          <ActionButton icon={<Copy size={12} />} label="Duplicate" onClick={onDuplicate} />
          <ActionButton
            icon={note.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            label={note.isPinned ? "Unpin note" : "Pin note"}
            onClick={onTogglePin}
          />
          <div className="my-1 border-t border-slate-100" />
          <div className="px-2 py-1.5">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
              <Palette size={11} />
              Color
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_COLORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onColor(option.value)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border border-white shadow-sm ring-offset-2 transition hover:scale-105",
                    note.color === option.value && "ring-2 ring-violet-400"
                  )}
                  style={{ backgroundColor: option.value }}
                  aria-label={`Use ${option.label} note color`}
                  title={option.label}
                >
                  {note.color === option.value && <Check size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <div className="px-2 py-1.5">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
              <Tags size={11} />
              Category
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onCategory(option.key)}
                  className={cn(
                    "rounded-full border px-2 py-1 text-[10.5px] font-semibold transition hover:shadow-sm",
                    note.category === option.key && "shadow-sm"
                  )}
                  style={{
                    borderColor: option.border,
                    backgroundColor: note.category === option.key ? option.bg : "#ffffff",
                    color: option.color,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <ActionButton danger icon={<Trash2 size={12} />} label="Move to trash" onClick={onTrash} />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[11.5px] font-semibold transition",
        danger
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EditorToolbar({
  editor,
  liveTranscript,
  onFlush,
  onStartSpeech,
  onStopSpeech,
  speechStatus,
}: {
  editor: Editor;
  liveTranscript: string;
  onFlush: () => void;
  onStartSpeech: () => void;
  onStopSpeech: () => void;
  speechStatus: AssemblyAIStreamingStatus;
}) {
  const speechActive =
    speechStatus === "requesting" ||
    speechStatus === "connecting" ||
    speechStatus === "recording" ||
    speechStatus === "stopping";
  const speechBusy = speechStatus === "requesting" || speechStatus === "connecting";
  const speechStatusLabel =
    speechStatus === "requesting"
      ? "Requesting microphone"
      : speechStatus === "connecting"
        ? "Connecting"
        : speechStatus === "stopping"
          ? "Stopping"
          : "Listening";

  return (
    <div className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-1 border-b border-slate-100 bg-white/95 px-3 py-2 backdrop-blur sm:px-6">
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} />
      </ToolbarButton>
      <ToolbarDivider />
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
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Paragraph"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <AlignLeft size={14} />
      </ToolbarButton>
      <ToolbarDivider />
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
      <ToolbarButton
        label="Strike"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2 size={14} />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        label="Bullet list"
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
        <CheckSquare size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Grip size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={14} />
      </ToolbarButton>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {speechActive ? (
          <>
            <span className="inline-flex h-8 items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 text-[11px] font-semibold text-rose-600">
              <span className="relative flex h-4 w-4 items-center justify-center">
                {speechStatus === "recording" && (
                  <span className="absolute h-4 w-4 animate-ping rounded-full bg-rose-300 opacity-60" />
                )}
                <Mic size={13} className="relative" />
              </span>
              {speechStatusLabel}
            </span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onStopSpeech}
              disabled={speechStatus === "stopping"}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
            >
              <Square size={12} />
              Stop Recording
            </button>
          </>
        ) : (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onStartSpeech}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 transition hover:border-violet-200 hover:bg-violet-100"
          >
            <Mic size={13} />
            Speak to Note
          </button>
        )}
        <button
          type="button"
          onClick={onFlush}
          className="hidden h-8 rounded-xl border border-violet-100 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 transition hover:border-violet-200 hover:bg-violet-100 sm:inline-flex sm:items-center"
        >
          Save now
        </button>
      </div>

      {speechActive && (
        <div className="basis-full rounded-xl border border-violet-100 bg-slate-50 px-3 py-2 text-[11.5px] font-medium text-slate-500">
          <span className="mr-2 font-semibold text-violet-600">Live</span>
          <span className={cn(!liveTranscript && "text-slate-300")}>
            {liveTranscript || (speechBusy ? "Getting ready..." : "Listening for speech...")}
          </span>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-700",
        active && "bg-violet-100 text-violet-700"
      )}
    >
      {children}
    </button>
  );
}

function BubbleButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-violet-50 hover:text-violet-700",
        active && "bg-violet-100 text-violet-700"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-100" />;
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saving" || status === "unsaved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-500">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {status === "saving" ? "Saving" : "Unsaved"}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-500">
        <X size={12} />
        Save failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-500">
      <Check size={12} />
      Saved
    </span>
  );
}
