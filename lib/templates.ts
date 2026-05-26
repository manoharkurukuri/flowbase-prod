export const DEFAULT_TEMPLATE_ICON = "Sparkles";
export const DEFAULT_TEMPLATE_COLOR = "#8B5CF6";
export const DEFAULT_TEMPLATE_LAYOUT = "single-page";

export const GENERATED_TEMPLATE_ICONS = [
  "Sparkles",
  "Flame",
  "Wallet",
  "PiggyBank",
  "Utensils",
  "Apple",
  "BookOpen",
  "GraduationCap",
  "Brain",
  "CalendarCheck",
  "ClipboardList",
  "ListChecks",
  "Target",
  "Trophy",
  "Timer",
  "Dumbbell",
  "Heart",
  "Home",
  "Briefcase",
  "Plane",
  "ShoppingCart",
  "Music",
  "Palette",
  "Coffee",
  "ChartNoAxesColumn",
] as const;

export const GENERATED_TEMPLATE_COMPONENT_TYPES = [
  "stats",
  "list",
  "table",
  "form",
  "progress",
  "checklist",
  "buttons",
  "tags",
  "chart",
] as const;

export const TEMPLATE_ACTION_VARIANTS = ["primary", "secondary", "ghost"] as const;
export const TEMPLATE_FIELD_TYPES = ["text", "number", "date", "select", "checkbox"] as const;

const hexColorPattern = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const iconLookup = new Map(GENERATED_TEMPLATE_ICONS.map((icon) => [icon.toLowerCase(), icon]));
const componentTypeLookup = new Map<string, GeneratedTemplateComponentType>([
  ["stats", "stats"],
  ["stat", "stats"],
  ["statscard", "stats"],
  ["statscards", "stats"],
  ["stats-card", "stats"],
  ["stats-cards", "stats"],
  ["list", "list"],
  ["table", "table"],
  ["form", "form"],
  ["progress", "progress"],
  ["progressbar", "progress"],
  ["progressbars", "progress"],
  ["progress-bar", "progress"],
  ["progress-bars", "progress"],
  ["checklist", "checklist"],
  ["checkboxes", "checklist"],
  ["buttons", "buttons"],
  ["button", "buttons"],
  ["tags", "tags"],
  ["tag", "tags"],
  ["chart", "chart"],
  ["charts", "chart"],
  ["chartplaceholder", "chart"],
  ["chart-placeholder", "chart"],
]);

export type GeneratedTemplateIcon = (typeof GENERATED_TEMPLATE_ICONS)[number];
export type GeneratedTemplateComponentType = (typeof GENERATED_TEMPLATE_COMPONENT_TYPES)[number];
export type TemplateActionVariant = (typeof TEMPLATE_ACTION_VARIANTS)[number];
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];
export type TemplateLayout = typeof DEFAULT_TEMPLATE_LAYOUT;

export type GeneratedTemplateStat = {
  id: string;
  label: string;
  value: string;
  helper?: string;
};

export type GeneratedTemplateListItem = {
  id: string;
  label: string;
  detail?: string;
  checked?: boolean;
  tag?: string;
};

export type GeneratedTemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
  value?: string;
  placeholder?: string;
  options?: string[];
};

export type GeneratedTemplateAction = {
  id: string;
  label: string;
  variant: TemplateActionVariant;
};

export type GeneratedTemplateSampleRow = Record<string, string>;

export type GeneratedTemplateComponent = {
  id: string;
  type: GeneratedTemplateComponentType;
  title: string;
  description?: string;
  stats?: GeneratedTemplateStat[];
  items?: GeneratedTemplateListItem[];
  columns?: string[];
  rows?: GeneratedTemplateSampleRow[];
  fields?: GeneratedTemplateField[];
  actions?: GeneratedTemplateAction[];
  value?: number;
  max?: number;
  label?: string;
  tags?: string[];
  chartType?: string;
  sampleData?: GeneratedTemplateSampleRow[];
};

export type GeneratedTemplateSection = {
  id: string;
  title: string;
  description?: string;
  components: GeneratedTemplateComponent[];
};

export type GeneratedTemplateJson = {
  appName: string;
  description: string;
  icon: GeneratedTemplateIcon;
  layout: TemplateLayout;
  color: string;
  sections: GeneratedTemplateSection[];
  components: GeneratedTemplateComponent[];
  fields: GeneratedTemplateField[];
  actions: GeneratedTemplateAction[];
  sampleData: GeneratedTemplateSampleRow[];
};

export type GeneratedAppRecord = {
  id: number;
  prompt: string;
  appName: string;
  description: string;
  icon: GeneratedTemplateIcon;
  color: string;
  layout: TemplateLayout;
  template: GeneratedTemplateJson;
  isInSidebar: boolean;
  sidebarPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return fallback;
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  const text = cleanText(value, maxLength);
  return text || undefined;
}

function cleanId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

function normalizeColor(value: unknown) {
  if (typeof value !== "string" || !hexColorPattern.test(value)) {
    return DEFAULT_TEMPLATE_COLOR;
  }

  const color = value.toUpperCase();
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  return color;
}

export function normalizeTemplateIcon(value: unknown): GeneratedTemplateIcon {
  if (typeof value !== "string") {
    return DEFAULT_TEMPLATE_ICON;
  }

  const normalized = value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return iconLookup.get(normalized) ?? DEFAULT_TEMPLATE_ICON;
}

function normalizeComponentType(value: unknown): GeneratedTemplateComponentType | null {
  if (typeof value !== "string") {
    return null;
  }

  const direct = componentTypeLookup.get(value.toLowerCase().trim());
  if (direct) return direct;

  return componentTypeLookup.get(value.replace(/[^a-z0-9-]/gi, "").toLowerCase()) ?? null;
}

function normalizeActionVariant(value: unknown): TemplateActionVariant {
  return TEMPLATE_ACTION_VARIANTS.includes(value as TemplateActionVariant)
    ? (value as TemplateActionVariant)
    : "secondary";
}

function normalizeFieldType(value: unknown): TemplateFieldType {
  return TEMPLATE_FIELD_TYPES.includes(value as TemplateFieldType)
    ? (value as TemplateFieldType)
    : "text";
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function sanitizeActions(value: unknown, limit = 4): GeneratedTemplateAction[] {
  return asArray(value)
    .slice(0, limit)
    .map((item, index) => {
      const source: Record<string, unknown> = isRecord(item) ? item : { label: item };
      const label = cleanText(source.label ?? source.name ?? source.title, 36, `Action ${index + 1}`);

      return {
        id: cleanText(source.id, 40, cleanId("action", index)),
        label,
        variant: normalizeActionVariant(source.variant),
      };
    });
}

function sanitizeFields(value: unknown, limit = 6): GeneratedTemplateField[] {
  return asArray(value)
    .slice(0, limit)
    .map((item, index) => {
      const source: Record<string, unknown> = isRecord(item) ? item : { label: item };
      const label = cleanText(source.label ?? source.name ?? source.title, 36, `Field ${index + 1}`);
      const options = asArray(source.options)
        .slice(0, 6)
        .map((option) => cleanText(option, 36))
        .filter(Boolean);

      return {
        id: cleanText(source.id, 40, cleanId("field", index)),
        label,
        type: normalizeFieldType(source.type),
        value: cleanOptionalText(source.value, 80),
        placeholder: cleanOptionalText(source.placeholder, 80),
        options: options.length ? options : undefined,
      };
    });
}

function sanitizeStats(value: unknown, limit = 4): GeneratedTemplateStat[] {
  return asArray(value)
    .slice(0, limit)
    .map((item, index) => {
      const source: Record<string, unknown> = isRecord(item)
        ? item
        : { label: `Metric ${index + 1}`, value: item };

      return {
        id: cleanText(source.id, 40, cleanId("stat", index)),
        label: cleanText(source.label ?? source.name ?? source.title, 40, `Metric ${index + 1}`),
        value: cleanText(source.value ?? source.count ?? source.total, 28, "0"),
        helper: cleanOptionalText(source.helper ?? source.description ?? source.change, 80),
      };
    });
}

function sanitizeItems(value: unknown, limit = 8): GeneratedTemplateListItem[] {
  return asArray(value)
    .slice(0, limit)
    .map((item, index) => {
      const source: Record<string, unknown> = isRecord(item) ? item : { label: item };

      return {
        id: cleanText(source.id, 40, cleanId("item", index)),
        label: cleanText(source.label ?? source.name ?? source.title ?? source.task, 64, `Item ${index + 1}`),
        detail: cleanOptionalText(source.detail ?? source.description ?? source.subtitle, 100),
        checked: typeof source.checked === "boolean" ? source.checked : undefined,
        tag: cleanOptionalText(source.tag ?? source.status ?? source.category, 28),
      };
    });
}

function sanitizeTags(value: unknown, limit = 10) {
  return asArray(value)
    .slice(0, limit)
    .map((tag) => cleanText(isRecord(tag) ? tag.label ?? tag.name : tag, 28))
    .filter(Boolean);
}

function sanitizeRows(value: unknown, limit = 8): GeneratedTemplateSampleRow[] {
  return asArray(value)
    .slice(0, limit)
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }

      const entries = Object.entries(row)
        .slice(0, 8)
        .map(([key, cell]) => [cleanText(key, 32), cleanText(cell, 80)] as const)
        .filter(([key]) => key);

      return entries.length ? Object.fromEntries(entries) : null;
    })
    .filter(Boolean) as GeneratedTemplateSampleRow[];
}

function sanitizeColumns(value: unknown, rows: GeneratedTemplateSampleRow[], limit = 6) {
  const explicit = asArray(value)
    .slice(0, limit)
    .map((column) => cleanText(isRecord(column) ? column.label ?? column.name : column, 32))
    .filter(Boolean);

  if (explicit.length) {
    return explicit;
  }

  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, limit);
}

function sanitizeComponent(
  value: unknown,
  index: number,
  root: Record<string, unknown>
): GeneratedTemplateComponent | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = normalizeComponentType(value.type ?? value.kind);
  if (!type) {
    return null;
  }

  const title = cleanText(value.title ?? value.label ?? value.name, 60, defaultComponentTitle(type));
  const description = cleanOptionalText(value.description, 120);
  const component: GeneratedTemplateComponent = {
    id: cleanText(value.id, 40, cleanId(type, index)),
    type,
    title,
    description,
  };

  if (type === "stats") {
    component.stats = sanitizeStats(value.stats ?? value.items ?? root.sampleData, 4);
  }

  if (type === "list" || type === "checklist") {
    component.items = sanitizeItems(value.items ?? value.tasks ?? value.sampleData ?? root.sampleData, 8);
  }

  if (type === "table") {
    const rows = sanitizeRows(value.rows ?? value.sampleData ?? root.sampleData, 8);
    component.rows = rows;
    component.columns = sanitizeColumns(value.columns, rows, 6);
  }

  if (type === "form") {
    component.fields = sanitizeFields(value.fields ?? root.fields, 6);
    component.actions = sanitizeActions(value.actions ?? root.actions, 3);
  }

  if (type === "progress") {
    component.value = cleanNumber(value.value ?? value.progress, 64, 0, 100);
    component.max = cleanNumber(value.max, 100, 1, 1000);
    component.label = cleanText(value.label ?? value.caption, 48, "Progress");
  }

  if (type === "buttons") {
    component.actions = sanitizeActions(value.actions ?? value.buttons ?? root.actions, 5);
  }

  if (type === "tags") {
    component.tags = sanitizeTags(value.tags ?? value.items ?? root.tags, 10);
  }

  if (type === "chart") {
    component.chartType = cleanText(value.chartType ?? value.kind ?? "bar", 24, "bar");
    component.sampleData = sanitizeRows(value.sampleData ?? value.rows ?? root.sampleData, 8);
  }

  return hasRenderableData(component) ? component : null;
}

function hasRenderableData(component: GeneratedTemplateComponent) {
  switch (component.type) {
    case "stats":
      return Boolean(component.stats?.length);
    case "list":
    case "checklist":
      return Boolean(component.items?.length);
    case "table":
      return Boolean(component.columns?.length && component.rows?.length);
    case "form":
      return Boolean(component.fields?.length);
    case "buttons":
      return Boolean(component.actions?.length);
    case "tags":
      return Boolean(component.tags?.length);
    case "chart":
      return true;
    case "progress":
      return true;
    default:
      return false;
  }
}

function defaultComponentTitle(type: GeneratedTemplateComponentType) {
  const labels: Record<GeneratedTemplateComponentType, string> = {
    stats: "Quick stats",
    list: "List",
    table: "Table",
    form: "Form",
    progress: "Progress",
    checklist: "Checklist",
    buttons: "Actions",
    tags: "Tags",
    chart: "Chart",
  };

  return labels[type];
}

function sanitizeSections(value: unknown, root: Record<string, unknown>) {
  return asArray(value)
    .slice(0, 6)
    .map((section, sectionIndex) => {
      const source = isRecord(section) ? section : { title: `Section ${sectionIndex + 1}` };
      const components = asArray(source.components)
        .slice(0, 8)
        .map((component, componentIndex) =>
          sanitizeComponent(component, componentIndex, root)
        )
        .filter(Boolean) as GeneratedTemplateComponent[];

      if (!components.length) {
        return null;
      }

      return {
        id: cleanText(source.id, 40, cleanId("section", sectionIndex)),
        title: cleanText(source.title ?? source.name, 64, `Section ${sectionIndex + 1}`),
        description: cleanOptionalText(source.description, 140),
        components,
      };
    })
    .filter(Boolean) as GeneratedTemplateSection[];
}

function fallbackNameFromPrompt(prompt?: string) {
  const cleaned = cleanText(prompt, 42, "Generated App");
  if (!cleaned || cleaned === "Generated App") {
    return "Generated App";
  }

  return cleaned
    .replace(/^(build|create|make|generate)\s+(a|an|the)?\s*/i, "")
    .replace(/\b(app|template|mini app|nini app)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 42) || "Generated App";
}

function createFallbackTemplate(prompt?: string): GeneratedTemplateJson {
  const appName = fallbackNameFromPrompt(prompt);

  return {
    appName,
    description: "A focused single-page app generated from your prompt.",
    icon: DEFAULT_TEMPLATE_ICON,
    layout: DEFAULT_TEMPLATE_LAYOUT,
    color: DEFAULT_TEMPLATE_COLOR,
    sections: [
      {
        id: "section-1",
        title: "Overview",
        components: [
          {
            id: "stats-1",
            type: "stats",
            title: "Quick stats",
            stats: [
              { id: "stat-1", label: "Items", value: "8", helper: "Ready to customize" },
              { id: "stat-2", label: "Progress", value: "64%", helper: "Sample preview" },
            ],
          },
          {
            id: "checklist-1",
            type: "checklist",
            title: "Starter checklist",
            items: [
              { id: "item-1", label: "Add your first entry", checked: true },
              { id: "item-2", label: "Review progress", checked: false },
              { id: "item-3", label: "Plan the next step", checked: false },
            ],
          },
        ],
      },
    ],
    components: [],
    fields: [],
    actions: [{ id: "action-1", label: "Add entry", variant: "primary" }],
    sampleData: [],
  };
}

export function sanitizeGeneratedTemplate(value: unknown, prompt?: string): GeneratedTemplateJson {
  if (!isRecord(value)) {
    return createFallbackTemplate(prompt);
  }

  const root = value;
  const rootFields = sanitizeFields(root.fields, 8);
  const rootActions = sanitizeActions(root.actions, 6);
  const rootSampleData = sanitizeRows(root.sampleData, 10);
  const rootWithSanitized = {
    ...root,
    fields: rootFields,
    actions: rootActions,
    sampleData: rootSampleData,
  };
  const components = asArray(root.components)
    .slice(0, 8)
    .map((component, index) => sanitizeComponent(component, index, rootWithSanitized))
    .filter(Boolean) as GeneratedTemplateComponent[];
  const sections = sanitizeSections(root.sections, rootWithSanitized);

  const template: GeneratedTemplateJson = {
    appName: cleanText(root.appName ?? root.app_name ?? root.name, 64, fallbackNameFromPrompt(prompt)),
    description: cleanText(
      root.description,
      180,
      "A focused single-page app generated from your prompt."
    ),
    icon: normalizeTemplateIcon(root.icon),
    layout: DEFAULT_TEMPLATE_LAYOUT,
    color: normalizeColor(root.color ?? root.themeColor ?? root.theme_color),
    sections,
    components,
    fields: rootFields,
    actions: rootActions,
    sampleData: rootSampleData,
  };

  if (!template.sections.length && !template.components.length) {
    return {
      ...template,
      sections: createFallbackTemplate(prompt).sections,
    };
  }

  return template;
}

export function cleanModelJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return cleaned;
  }

  return cleaned.slice(start, end + 1);
}
