export const SPACE_RESOURCE_TYPE = "space";

export const EMPTY_PAGE_CONTENT = {
  type: "doc",
  content: [],
};

export const SPACE_COLORS = [
  { value: "#8B5CF6", label: "Violet", bg: "#F5F3FF", border: "#DDD6FE" },
  { value: "#3B82F6", label: "Blue", bg: "#EFF6FF", border: "#BFDBFE" },
  { value: "#10B981", label: "Emerald", bg: "#ECFDF5", border: "#A7F3D0" },
  { value: "#EC4899", label: "Pink", bg: "#FDF2F8", border: "#FBCFE8" },
  { value: "#F97316", label: "Orange", bg: "#FFF7ED", border: "#FED7AA" },
  { value: "#EAB308", label: "Amber", bg: "#FEFCE8", border: "#FEF08A" },
  { value: "#06B6D4", label: "Cyan", bg: "#ECFEFF", border: "#A5F3FC" },
] as const;

export const PAGE_TEMPLATES = [
  { id: "blank", label: "Blank Page", color: "#64748B", bg: "#F8FAFC" },
  { id: "project-plan", label: "Project Plan", color: "#8B5CF6", bg: "#F5F3FF" },
  { id: "meeting-notes", label: "Meeting Notes", color: "#06B6D4", bg: "#ECFEFF" },
  { id: "prd", label: "PRD", color: "#F97316", bg: "#FFF7ED" },
  { id: "research-notes", label: "Research Notes", color: "#10B981", bg: "#ECFDF5" },
  { id: "task-plan", label: "Task Plan", color: "#EC4899", bg: "#FDF2F8" },
] as const;

export type SpaceColor = (typeof SPACE_COLORS)[number]["value"];
export type PageTemplateId = (typeof PAGE_TEMPLATES)[number]["id"];

export type PageContent = {
  type: string;
  content?: unknown[];
  [key: string]: unknown;
};

export type MemberAvatarRecord = {
  id: number;
  userId: number | null;
  name: string | null;
  email: string;
  role: "owner" | "editor";
  initials: string;
  avatarColor: string;
};

export type PageUserRecord = {
  id: number;
  name: string | null;
  email: string;
  initials: string;
  avatarColor: string;
};

export type SpaceSummaryRecord = {
  id: number;
  name: string;
  description: string | null;
  color: SpaceColor;
  isFavorite: boolean;
  archivedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  pageSearchText: string;
  members: MemberAvatarRecord[];
  role: "owner" | "editor";
};

export type PageListRecord = {
  id: number;
  spaceId: number;
  userId: number;
  name: string;
  description: string | null;
  template: PageTemplateId;
  isFavorite: boolean;
  archivedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: PageUserRecord | null;
  commentsCount: number;
  linkedTasksCount: number;
};

export type SpaceDetailRecord = SpaceSummaryRecord & {
  pages: PageListRecord[];
};

export type PageDetailRecord = PageListRecord & {
  content: PageContent;
  plainText: string | null;
  space: SpaceSummaryRecord;
};

export type SpaceFormInput = {
  name: string;
  description?: string | null;
  color?: string | null;
};

export type PageFormInput = {
  spaceId: number;
  name: string;
  template: string;
};

export type PageUpdateInput = {
  name?: string | null;
  description?: string | null;
  content?: PageContent | null;
  plainText?: string | null;
};

export function getSpaceColorMeta(color: string) {
  return SPACE_COLORS.find((option) => option.value === color) ?? SPACE_COLORS[0];
}

export function getPageTemplateMeta(template: string) {
  return PAGE_TEMPLATES.find((option) => option.id === template) ?? PAGE_TEMPLATES[0];
}

export function formatWorkspaceRelativeTime(
  value: string | null,
  options: { emptyLabel?: string; prefix?: string } = {}
) {
  const { emptyLabel = "-", prefix } = options;

  if (!value) return emptyLabel;

  const date = new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) return emptyLabel;

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;
  let label: string;

  if (diffMs < minute) {
    label = prefix ? "just now" : "Just now";
  } else if (diffMs < hour) {
    label = `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  } else if (diffMs < day) {
    label = `${Math.floor(diffMs / hour)}h ago`;
  } else if (diffMs < day * 2) {
    label = prefix ? "yesterday" : "Yesterday";
  } else if (diffMs < day * 7) {
    label = `${Math.floor(diffMs / day)} days ago`;
  } else if (diffMs < day * 30) {
    label = `${Math.max(1, Math.floor(diffMs / (day * 7)))}w ago`;
  } else {
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
    };

    if (date.getFullYear() !== new Date().getFullYear()) {
      dateOptions.year = "numeric";
    }

    label = new Intl.DateTimeFormat(undefined, dateOptions).format(date);
  }

  return prefix ? `${prefix} ${label}` : label;
}

function paragraph(text: string) {
  return text
    ? {
        type: "paragraph",
        content: [{ type: "text", text }],
      }
    : { type: "paragraph" };
}

function heading(level: 1 | 2 | 3, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function task(text: string) {
  return {
    type: "taskItem",
    attrs: { checked: false },
    content: [paragraph(text)],
  };
}

export function getTemplateStarterContent(template: PageTemplateId, title: string): PageContent {
  if (template === "blank") {
    return { ...EMPTY_PAGE_CONTENT };
  }

  if (template === "project-plan") {
    return {
      type: "doc",
      content: [
        heading(1, title),
        paragraph("Project overview"),
        heading(2, "Goals"),
        paragraph(""),
        heading(2, "Milestones"),
        paragraph(""),
        heading(2, "Risks"),
        paragraph(""),
      ],
    };
  }

  if (template === "meeting-notes") {
    return {
      type: "doc",
      content: [
        heading(1, title),
        heading(2, "Agenda"),
        paragraph(""),
        heading(2, "Notes"),
        paragraph(""),
        heading(2, "Action Items"),
        { type: "taskList", content: [task("Follow up")] },
      ],
    };
  }

  if (template === "prd") {
    return {
      type: "doc",
      content: [
        heading(1, title),
        heading(2, "Problem"),
        paragraph(""),
        heading(2, "Users"),
        paragraph(""),
        heading(2, "Requirements"),
        paragraph(""),
        heading(2, "Success Metrics"),
        paragraph(""),
      ],
    };
  }

  if (template === "research-notes") {
    return {
      type: "doc",
      content: [
        heading(1, title),
        heading(2, "Question"),
        paragraph(""),
        heading(2, "Sources"),
        paragraph(""),
        heading(2, "Findings"),
        paragraph(""),
      ],
    };
  }

  return {
    type: "doc",
    content: [
      heading(1, title),
      heading(2, "Plan"),
      { type: "taskList", content: [task("Define next step"), task("Assign owner")] },
      heading(2, "Notes"),
      paragraph(""),
    ],
  };
}

export function getTemplatePlainText(template: PageTemplateId, title: string) {
  if (template === "blank") return null;

  const labels: Record<PageTemplateId, string> = {
    blank: "",
    "project-plan": `${title}\nProject overview\nGoals\nMilestones\nRisks`,
    "meeting-notes": `${title}\nAgenda\nNotes\nAction Items\nFollow up`,
    prd: `${title}\nProblem\nUsers\nRequirements\nSuccess Metrics`,
    "research-notes": `${title}\nQuestion\nSources\nFindings`,
    "task-plan": `${title}\nPlan\nDefine next step\nAssign owner\nNotes`,
  };

  return labels[template];
}
