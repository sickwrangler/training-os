"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CollapsibleSection } from "@/app/components/CollapsibleSection";
import { DemoPersonaSwitcher } from "@/app/components/dev/DemoPersonaSwitcher";
import * as lifeosRepository from "@/app/db/lifeosRepository";
import {
  testPersonas,
  type ActivityTemplate,
  type ActivityExtraction,
  type ActivityExtractionMetadata,
  type DayKey,
  type Goal,
  type GoalHistoryEvent,
  type GoalHistoryEventType,
  type GoalStatus,
  type LifeEvent,
  type LifeEventStatus,
  type LifeEventType,
  type LifeArea,
  type PlannedActivity,
  type PlannedActivitySeed,
  type Status,
  type Week,
  type WeeklyReview,
} from "@/app/data/testPersonas";

type Section =
  | "dashboard"
  | "builder"
  | "map"
  | "planning"
  | "checkin";
type BuilderKind = "lifeArea" | "goal" | "template";
type NodeType =
  | "You"
  | "Life Area"
  | "Goal"
  | "Activity Template"
  | "Life Event"
  | "Goal History";

type DragData =
  | { type: "template"; template: ActivityTemplate }
  | { type: "planned"; plannedActivity: PlannedActivity };
type ActiveDrag =
  | { type: "template"; template: ActivityTemplate }
  | { type: "planned"; plannedActivity: PlannedActivity };
type DropPreview = { day: DayKey; index: number; template: ActivityTemplate } | null;
type BoardCreateMode = "activity" | "event";
type BoardCreateDraft = {
  day: DayKey;
  mode: BoardCreateMode;
  title: string;
  duration: string;
  details: string;
  notes: string;
  lifeAreaId: string;
  goalId: string;
  eventDate: string;
  eventEndDate: string;
  eventType: LifeEventType;
  eventStatus: LifeEventStatus;
  eventLifeAreaIds: string[];
  eventGoalIds: string[];
};
type ExtractionPreview = {
  metadata: ActivityExtractionMetadata;
  extraction: ActivityExtraction;
};
type WeeklyReflectionDraft = {
  summary: string;
  wins: string[];
  challenges: string[];
  goalCoverage: Array<{
    goalTitle: string;
    observation: string;
  }>;
  patterns: string[];
  suggestedAdjustments: string[];
  questionsForUser: string[];
  confidence: number;
};
type WeeklyReflectionPreview = {
  reflection: WeeklyReflectionDraft;
  model: string;
  generatedAt: string;
};
type GraphNode = {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  compact?: boolean;
};
type GraphEdge = { id: string; from: string; to: string };

const days: DayKey[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const statusOptions: Status[] = ["planned", "done", "skipped", "moved"];
const goalStatuses: GoalStatus[] = ["active", "paused", "completed", "archived"];
const lifeEventTypes: LifeEventType[] = [
  "race",
  "exam",
  "holiday",
  "work",
  "release",
  "appointment",
  "milestone",
  "other",
];
const lifeEventStatuses: LifeEventStatus[] = [
  "upcoming",
  "completed",
  "cancelled",
  "archived",
];
const defaultPersona = testPersonas[0];

function getCurrentDayKey(): DayKey {
  const jsDayToDayKey: DayKey[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return jsDayToDayKey[new Date().getDay()];
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekStartDate(date = new Date()) {
  const monday = new Date(date);
  const jsDay = monday.getDay();
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysSinceMonday);
  return formatDateKey(monday);
}

function addDaysToDateKey(dateKey: string, daysToAdd: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return formatDateKey(date);
}

function getDaysUntil(dateKey: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateKey}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDaysUntil(dateKey: string) {
  const daysUntil = getDaysUntil(dateKey);
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil > 1) return `${daysUntil} days`;
  if (daysUntil === -1) return "Yesterday";
  return `${Math.abs(daysUntil)} days ago`;
}

function createWeek(weekStartDate: string): Week {
  const now = new Date().toISOString();
  return {
    id: `week-${weekStartDate}`,
    weekStartDate,
    title: `Week of ${weekStartDate}`,
    createdAt: now,
    updatedAt: now,
  };
}

function applyWeekToPlannedActivitySeeds(
  plannedActivities: PlannedActivitySeed[],
  weekId: string,
): PlannedActivity[] {
  const orderByDay = new Map<DayKey, number>();

  return plannedActivities.map((planned) => {
    const sortOrder = orderByDay.get(planned.day) ?? 0;
    orderByDay.set(planned.day, sortOrder + 1);

    return {
      ...planned,
      weekId,
      sortOrder: planned.sortOrder ?? sortOrder,
    };
  });
}

const blankLifeArea: LifeArea = { id: "", title: "", description: "", icon: "" };
const blankGoal: Goal = {
  id: "",
  title: "",
  description: "",
  lifeAreaIds: [],
  status: "active",
  createdAt: "",
};
const blankTemplate: ActivityTemplate = {
  id: "",
  title: "",
  description: "",
  goalIds: [],
  defaultDuration: "",
  defaultIcon: "",
  defaultNotes: "",
};
const blankLifeEvent: LifeEvent = {
  id: "",
  title: "",
  description: "",
  date: "",
  endDate: "",
  type: "other",
  lifeAreaIds: [],
  goalIds: [],
  status: "upcoming",
  notes: "",
  createdAt: "",
  updatedAt: "",
};

const blankBoardCreateDraft: BoardCreateDraft = {
  day: "Monday",
  mode: "activity",
  title: "",
  duration: "",
  details: "",
  notes: "",
  lifeAreaId: "",
  goalId: "",
  eventDate: "",
  eventEndDate: "",
  eventType: "other",
  eventStatus: "upcoming",
  eventLifeAreaIds: [],
  eventGoalIds: [],
};
const blankWeeklyReflectionDraft: WeeklyReflectionDraft = {
  summary: "",
  wins: [],
  challenges: [],
  goalCoverage: [],
  patterns: [],
  suggestedAdjustments: [],
  questionsForUser: [],
  confidence: 0,
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isAdHocTemplate(template: ActivityTemplate) {
  return template.id.startsWith("template-adhoc");
}

function isExtractionPreview(value: unknown): value is ExtractionPreview {
  return (
    typeof value === "object" &&
    value !== null &&
    "metadata" in value &&
    "extraction" in value
  );
}

function isWeeklyReflectionPreview(value: unknown): value is WeeklyReflectionPreview {
  return (
    typeof value === "object" &&
    value !== null &&
    "reflection" in value &&
    "model" in value &&
    "generatedAt" in value
  );
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value?: string[]) {
  return (value ?? []).join("\n");
}

function weeklyReflectionDraftFromReview(
  review: WeeklyReview | null,
): WeeklyReflectionDraft {
  return review
    ? {
        summary: review.summary ?? "",
        wins: review.wins ?? [],
        challenges: review.challenges ?? [],
        goalCoverage: review.goalCoverage ?? [],
        patterns: review.patterns ?? [],
        suggestedAdjustments: review.suggestedAdjustments ?? [],
        questionsForUser: review.questionsForUser ?? [],
        confidence: 0,
      }
    : blankWeeklyReflectionDraft;
}

function parseDurationMinutes(value?: string) {
  if (!value) return 0;
  const normalized = value.trim().toLowerCase();
  const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return 0;

  const amount = Number(numberMatch[1]);
  if (!Number.isFinite(amount)) return 0;
  if (normalized.includes("hour") || normalized.includes("hr")) {
    return Math.round(amount * 60);
  }
  if (normalized.includes("min") || normalized.includes("minute")) {
    return Math.round(amount);
  }

  return 0;
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
      {children}
    </span>
  );
}

function MultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: { id: string; title: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
          >
            <input
              type="checkbox"
              checked={values.includes(option.id)}
              onChange={(event) => {
                onChange(
                  event.target.checked
                    ? [...values, option.id]
                    : values.filter((value) => value !== option.id),
                );
              }}
            />
            {option.title}
          </label>
        ))}
      </div>
    </div>
  );
}

function nodeBg(type: NodeType) {
  if (type === "You") return "bg-stone-100 text-stone-950";
  if (type === "Life Area") return "bg-stone-950 text-white";
  if (type === "Goal") return "bg-emerald-50 text-emerald-900";
  if (type === "Activity Template") return "bg-amber-50 text-amber-900";
  if (type === "Life Event") return "bg-sky-50 text-sky-900";
  return "bg-violet-50 text-violet-900";
}

function statusDot(status: Status) {
  if (status === "done") return "bg-emerald-600";
  if (status === "skipped") return "bg-rose-500";
  if (status === "moved") return "bg-amber-500";
  return "bg-slate-400";
}

function statusTone(status: Status) {
  if (status === "done") {
    return {
      card: "border-emerald-200 bg-emerald-50/70",
      chip: "border-emerald-200 bg-emerald-100 text-emerald-800",
      active: "border-emerald-600 bg-emerald-700 text-white",
      text: "text-emerald-800",
      icon: "bg-emerald-100 text-emerald-800",
    };
  }
  if (status === "skipped") {
    return {
      card: "border-rose-200 bg-rose-50/60",
      chip: "border-rose-200 bg-rose-100 text-rose-800",
      active: "border-rose-600 bg-rose-700 text-white",
      text: "text-rose-800",
      icon: "bg-rose-100 text-rose-800",
    };
  }
  if (status === "moved") {
    return {
      card: "border-amber-200 bg-amber-50/70",
      chip: "border-amber-200 bg-amber-100 text-amber-800",
      active: "border-amber-600 bg-amber-600 text-white",
      text: "text-amber-800",
      icon: "bg-amber-100 text-amber-800",
    };
  }
  return {
    card: "border-slate-200 bg-slate-50/70",
    chip: "border-slate-200 bg-slate-100 text-slate-700",
    active: "border-slate-700 bg-slate-700 text-white",
    text: "text-slate-700",
    icon: "bg-slate-100 text-slate-700",
  };
}

function statusLabel(status: Status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function goalStatusLabel(status?: GoalStatus) {
  const safeStatus = status ?? "active";
  return safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
}

function goalStatusTone(status?: GoalStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "archived") return "border-stone-300 bg-stone-100 text-stone-600";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

function goalHistoryLabel(type: GoalHistoryEventType) {
  if (type === "created") return "Created";
  if (type === "updated") return "Updated";
  if (type === "completed") return "Completed";
  if (type === "paused") return "Paused";
  if (type === "resumed") return "Resumed";
  if (type === "archived") return "Archived";
  return "Reflection";
}

function lifeAreaTone(index: number) {
  const tones = [
    "bg-emerald-400",
    "bg-sky-400",
    "bg-amber-400",
    "bg-rose-400",
    "bg-violet-400",
    "bg-teal-400",
  ];
  return tones[index % tones.length];
}

function StatusPicker({
  status,
  onChange,
}: {
  status: Status;
  onChange: (status: Status) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {statusOptions.map((option) => {
        const tone = statusTone(option);
        const isActive = status === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
              isActive ? tone.active : `${tone.chip} hover:border-stone-300`
            }`}
          >
            {statusLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

function TemplateCard({
  template,
  compact = false,
  isDragging = false,
  dragProps,
  onOpen,
}: {
  template: ActivityTemplate;
  compact?: boolean;
  isDragging?: boolean;
  dragProps?: React.HTMLAttributes<HTMLElement>;
  onOpen?: () => void;
}) {
  return (
    <article
      {...dragProps}
      onClick={onOpen}
      className={`rounded-lg border bg-white shadow-sm transition ${
        compact ? "p-2.5" : "p-4"
      } ${
        isDragging
          ? "border-stone-300 opacity-40"
          : "border-stone-200 hover:border-stone-300"
      } ${
        dragProps ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-5 text-stone-950">
            {template.title}
          </h3>
          {template.defaultDuration && (
            <p className="text-xs text-stone-500">{template.defaultDuration}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function LibraryTemplateCard({
  template,
  onOpen,
  disabled = false,
}: {
  template: ActivityTemplate;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `template-${template.id}`,
      data: { type: "template", template } satisfies DragData,
      disabled,
    });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }}>
      <TemplateCard
        template={template}
        compact
        isDragging={isDragging}
        dragProps={disabled ? undefined : { ...attributes, ...listeners }}
        onOpen={onOpen}
      />
    </div>
  );
}

function PlannedCard({
  plannedActivity,
  template,
  onOpen,
  lifeAreaAccent,
}: {
  plannedActivity: PlannedActivity;
  template: ActivityTemplate;
  onOpen: () => void;
  lifeAreaAccent?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: plannedActivity.id,
    data: { type: "planned", plannedActivity } satisfies DragData,
  });

  const tone = statusTone(plannedActivity.status);
  const displayDuration = plannedActivity.duration || template.defaultDuration;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <article
        data-planner-card="true"
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className={`relative min-h-24 cursor-grab touch-none overflow-hidden rounded-lg border px-3.5 py-4 shadow-sm transition active:cursor-grabbing ${
          isDragging ? "border-stone-300 opacity-40" : tone.card
        }`}
      >
        {lifeAreaAccent && (
          <span className={`absolute inset-y-0 left-0 w-1 ${lifeAreaAccent}`} />
        )}
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold leading-5 text-stone-950">
              {plannedActivity.titleOverride || template.title}
            </h3>
          </div>
          <div className="flex items-center justify-between gap-2">
            {displayDuration ? (
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${tone.chip}`}>
                {displayDuration}
              </span>
            ) : (
              <span />
            )}
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${statusDot(
                plannedActivity.status,
              )}`}
              aria-label={plannedActivity.status}
            />
          </div>
        </div>
      </article>
    </div>
  );
}

function DropPlaceholder({ template }: { template: ActivityTemplate }) {
  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/70 p-3">
      <p className="text-sm font-semibold text-emerald-950">{template.title}</p>
      <p className="mt-1 text-xs text-emerald-700">Release to plan here</p>
    </div>
  );
}

function DayColumn({
  day,
  plannedActivities,
  lifeEvents,
  templates,
  preview,
  onOpen,
  onCreate,
  getTemplateLifeAreaAccent,
  isToday,
}: {
  day: DayKey;
  plannedActivities: PlannedActivity[];
  lifeEvents: LifeEvent[];
  templates: ActivityTemplate[];
  preview: DropPreview;
  onOpen: (planned: PlannedActivity) => void;
  onCreate: (day: DayKey) => void;
  getTemplateLifeAreaAccent: (template: ActivityTemplate) => string | undefined;
  isToday: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const previewIndex =
    preview?.day === day ? Math.min(preview.index, plannedActivities.length) : -1;

  return (
    <section
      ref={setNodeRef}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.closest(
            '[data-planner-card="true"], [data-event-card="true"], button, input, textarea, select, label',
          )
        ) {
          return;
        }
        onCreate(day);
      }}
      className={`min-h-[68vh] w-[190px] shrink-0 rounded-lg border p-3 shadow-sm transition sm:w-[210px] lg:w-auto ${
        isOver
          ? "border-emerald-300 bg-emerald-50/60"
          : isToday
            ? "border-amber-300 bg-amber-50/50"
            : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-stone-950">{day}</h2>
          {isToday && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
              Today
            </span>
          )}
        </div>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600">
          {plannedActivities.length}
        </span>
      </div>
      {lifeEvents.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {lifeEvents.map((event) => (
            <article
              key={event.id}
              data-event-card="true"
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-xs font-semibold">{event.title}</p>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-sky-700">
                  {event.type}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-sky-700">{event.status}</p>
            </article>
          ))}
        </div>
      )}
      <SortableContext
        items={plannedActivities.map((planned) => planned.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={`mt-3 min-h-[58vh] space-y-2 rounded-lg ${
            isOver && plannedActivities.length === 0 ? "bg-emerald-50/80" : ""
          }`}
        >
          {plannedActivities.length === 0 && previewIndex === -1 && (
            <div
              className={`flex min-h-[54vh] items-center justify-center rounded-lg border border-dashed p-3 text-center text-xs leading-5 ${
                isOver
                  ? "border-emerald-300 text-emerald-700"
                  : "border-stone-300 text-stone-500"
              }`}
            >
              Drop templates here or double-click to add
            </div>
          )}
          {plannedActivities.map((planned, index) => {
            const template = templates.find((item) => item.id === planned.templateId);
            if (!template) return null;

            return (
              <div key={planned.id}>
                {previewIndex === index && preview && (
                  <div className="mb-2">
                    <DropPlaceholder template={preview.template} />
                  </div>
                )}
                <PlannedCard
                  plannedActivity={planned}
                  template={template}
                  onOpen={() => onOpen(planned)}
                  lifeAreaAccent={getTemplateLifeAreaAccent(template)}
                />
              </div>
            );
          })}
          {previewIndex === plannedActivities.length && preview && (
            <DropPlaceholder template={preview.template} />
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export default function Home() {
  const [currentWeek] = useState<Week>(() =>
    createWeek(getCurrentWeekStartDate()),
  );
  const [today] = useState<DayKey>(() => getCurrentDayKey());
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [builderKind, setBuilderKind] = useState<BuilderKind>("lifeArea");
  const [activeDemoPersonaId, setActiveDemoPersonaId] = useState(defaultPersona.id);
  const [weeks, setWeeks] = useState<Week[]>(() => [currentWeek]);
  const [selectedWeekId, setSelectedWeekId] = useState(currentWeek.id);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>(
    defaultPersona.lifeAreas,
  );
  const [goals, setGoals] = useState<Goal[]>(defaultPersona.goals);
  const [templates, setTemplates] =
    useState<ActivityTemplate[]>(defaultPersona.activityTemplates);
  const [plannedActivities, setPlannedActivities] = useState<PlannedActivity[]>(
    () =>
      applyWeekToPlannedActivitySeeds(
        defaultPersona.plannedActivities,
        currentWeek.id,
      ),
  );
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>(defaultPersona.lifeEvents ?? []);
  const [goalHistoryEvents, setGoalHistoryEvents] = useState<GoalHistoryEvent[]>(
    defaultPersona.goalHistoryEvents ?? [],
  );
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>(
    defaultPersona.weeklyReviews ?? [],
  );
  const [lifeAreaDraft, setLifeAreaDraft] = useState<LifeArea>(blankLifeArea);
  const [goalDraft, setGoalDraft] = useState<Goal>(blankGoal);
  const [templateDraft, setTemplateDraft] =
    useState<ActivityTemplate>(blankTemplate);
  const [lifeEventDraft, setLifeEventDraft] =
    useState<LifeEvent>(blankLifeEvent);
  const [boardCreateDraft, setBoardCreateDraft] =
    useState<BoardCreateDraft | null>(null);
  const [editingLifeEventId, setEditingLifeEventId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: BuilderKind; id: string } | null>(
    null,
  );
  const [editingPlanned, setEditingPlanned] = useState<PlannedActivity | null>(
    null,
  );
  const [isExtractingActivity, setIsExtractingActivity] = useState(false);
  const [activityExtractionError, setActivityExtractionError] = useState<string | null>(null);
  const [activityExtractionPreview, setActivityExtractionPreview] =
    useState<ExtractionPreview | null>(null);
  const [isGeneratingWeeklyReflection, setIsGeneratingWeeklyReflection] =
    useState(false);
  const [weeklyReflectionError, setWeeklyReflectionError] = useState<string | null>(
    null,
  );
  const [weeklyReflectionPreview, setWeeklyReflectionPreview] =
    useState<WeeklyReflectionPreview | null>(null);
  const [weeklyReflectionDraft, setWeeklyReflectionDraft] =
    useState<WeeklyReflectionDraft>(blankWeeklyReflectionDraft);
  const [weeklyReviewNotes, setWeeklyReviewNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [dataManagementMessage, setDataManagementMessage] = useState<string | null>(
    null,
  );
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({});
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const mapDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [mapView, setMapView] = useState({ x: 0, y: 0, scale: 0.78 });
  const [checkInDay, setCheckInDay] = useState<DayKey>(today);
  const [selectedPlannerLifeAreaId, setSelectedPlannerLifeAreaId] =
    useState<string>("all");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let isActive = true;

    async function loadLocalData() {
      try {
        const data = await lifeosRepository.loadLifeOSData(
          defaultPersona,
          currentWeek,
        );
        if (!isActive) return;

        setWeeks(data.weeks);
        setSelectedWeekId(currentWeek.id);
        setLifeAreas(data.lifeAreas);
        setGoals(data.goals);
        setTemplates(data.activityTemplates);
        setPlannedActivities(data.plannedActivities);
        setLifeEvents(data.lifeEvents);
        setGoalHistoryEvents(data.goalHistoryEvents);
        setWeeklyReviews(data.weeklyReviews);
        const review =
          data.weeklyReviews
            .filter((item) => item.weekId === currentWeek.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
        setWeeklyReflectionDraft(weeklyReflectionDraftFromReview(review));
        setWeeklyReviewNotes(review?.userNotes ?? "");
      } catch (error) {
        console.error("Failed to load LifeOS IndexedDB data", error);
      } finally {
        if (isActive) setIsHydrating(false);
      }
    }

    void loadLocalData();

    return () => {
      isActive = false;
    };
  }, [currentWeek]);

  const selectedWeek =
    weeks.find((week) => week.id === selectedWeekId) ?? currentWeek;

  const selectedWeekPlannedActivities = useMemo(
    () =>
      plannedActivities.filter((planned) => planned.weekId === selectedWeek.id),
    [plannedActivities, selectedWeek.id],
  );
  const selectedWeekReview = useMemo(
    () =>
      weeklyReviews
        .filter((review) => review.weekId === selectedWeek.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    [selectedWeek.id, weeklyReviews],
  );
  const selectedWeekLifeEvents = useMemo(() => {
    const weekEndDate = addDaysToDateKey(selectedWeek.weekStartDate, 6);

    return lifeEvents
      .filter((event) => {
        const eventEndDate = event.endDate ?? event.date;
        return event.date <= weekEndDate && eventEndDate >= selectedWeek.weekStartDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [lifeEvents, selectedWeek.weekStartDate]);

  const plannedByDay = useMemo(() => {
    const byDay: Record<DayKey, PlannedActivity[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };
    selectedWeekPlannedActivities.forEach((planned) =>
      byDay[planned.day].push(planned),
    );
    days.forEach((day) => {
      byDay[day].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });
    return byDay;
  }, [selectedWeekPlannedActivities]);

  function dateForSelectedWeekDay(day: DayKey) {
    return addDaysToDateKey(selectedWeek.weekStartDate, days.indexOf(day));
  }

  const getTemplateContext = (template: ActivityTemplate) => {
    const linkedGoals = template.goalIds
      .map((goalId) => goals.find((goal) => goal.id === goalId))
      .filter(Boolean) as Goal[];
    const linkedAreas = linkedGoals.flatMap((goal) =>
      goal.lifeAreaIds
        .map((areaId) => lifeAreas.find((area) => area.id === areaId))
        .filter(Boolean),
    ) as LifeArea[];
    return {
      goals: linkedGoals,
      lifeAreas: Array.from(new Map(linkedAreas.map((area) => [area.id, area])).values()),
    };
  };

  const selectedPlannerLifeArea =
    selectedPlannerLifeAreaId === "all"
      ? null
      : lifeAreas.find((area) => area.id === selectedPlannerLifeAreaId) ?? null;
  const plannerGoals =
    selectedPlannerLifeAreaId === "all"
      ? goals
      : goals.filter((goal) => goal.lifeAreaIds.includes(selectedPlannerLifeAreaId));
  const plannerGoalIds = new Set(plannerGoals.map((goal) => goal.id));
  const plannerTemplates =
    selectedPlannerLifeAreaId === "all"
      ? templates.filter((template) => !isAdHocTemplate(template))
      : templates.filter((template) =>
          !isAdHocTemplate(template) &&
          template.goalIds.some((goalId) => plannerGoalIds.has(goalId)),
        );

  function getTemplateLifeAreaIds(template: ActivityTemplate) {
    const areaIds = template.goalIds.flatMap(
      (goalId) => goals.find((goal) => goal.id === goalId)?.lifeAreaIds ?? [],
    );
    return Array.from(new Set(areaIds));
  }

  function getTemplateLifeAreaAccent(template: ActivityTemplate) {
    if (selectedPlannerLifeAreaId !== "all") return undefined;
    const primaryLifeAreaId = getTemplateLifeAreaIds(template)[0];
    const index = lifeAreas.findIndex((area) => area.id === primaryLifeAreaId);
    return index === -1 ? undefined : lifeAreaTone(index);
  }

  const visiblePlannedByDay = useMemo(() => {
    if (selectedPlannerLifeAreaId === "all") return plannedByDay;

    const byDay: Record<DayKey, PlannedActivity[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    days.forEach((day) => {
      byDay[day] = plannedByDay[day].filter((planned) => {
        const template = templates.find((item) => item.id === planned.templateId);
        if (!template) return false;
        const areaIds = [
          ...(planned.lifeAreaIds ?? []),
          ...template.goalIds.flatMap(
            (goalId) => goals.find((goal) => goal.id === goalId)?.lifeAreaIds ?? [],
          ),
          ...(planned.goalIds ?? []).flatMap(
            (goalId) => goals.find((goal) => goal.id === goalId)?.lifeAreaIds ?? [],
          ),
        ];
        return areaIds.includes(selectedPlannerLifeAreaId);
      });
    });

    return byDay;
  }, [goals, plannedByDay, selectedPlannerLifeAreaId, templates]);

  const visibleLifeEventsByDay = useMemo(() => {
    const byDay: Record<DayKey, LifeEvent[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    days.forEach((day) => {
      const date = addDaysToDateKey(selectedWeek.weekStartDate, days.indexOf(day));
      byDay[day] = lifeEvents.filter((event) => {
        const isInDay =
          event.date <= date && (event.endDate ? event.endDate >= date : event.date === date);
        if (!isInDay) return false;
        if (selectedPlannerLifeAreaId === "all") return true;
        if (event.lifeAreaIds.includes(selectedPlannerLifeAreaId)) return true;
        return event.goalIds.some((goalId) =>
          goals
            .find((goal) => goal.id === goalId)
            ?.lifeAreaIds.includes(selectedPlannerLifeAreaId),
        );
      });
    });

    return byDay;
  }, [goals, lifeEvents, selectedPlannerLifeAreaId, selectedWeek.weekStartDate]);

  const graph = useMemo(() => {
    const center = { x: 1400, y: 1400 };
    const ring = {
      lifeArea: 330,
      goal: 690,
      outer: 1030,
      history: 820,
    };
    const angleForIndex = (index: number, total: number, offset = -Math.PI / 2) =>
      offset + (Math.PI * 2 * index) / Math.max(total, 1);
    const pointOnRing = (angle: number, radius: number) => ({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });

    const lifeAreaAngles = new Map<string, number>();
    const goalAngles = new Map<string, number>();

    const youNode: GraphNode = {
      id: "you",
      type: "You",
      title: "You",
      subtitle: "LifeOS",
      x: center.x,
      y: center.y,
    };

    const lifeAreaNodes: GraphNode[] = lifeAreas.map((area, index) => {
      const angle = angleForIndex(index, lifeAreas.length);
      lifeAreaAngles.set(area.id, angle);
      const point = pointOnRing(angle, ring.lifeArea);
      return {
        id: area.id,
        type: "Life Area",
        title: area.title,
        subtitle: area.description,
        ...point,
      };
    });

    const goalNodes: GraphNode[] = goals.map((goal, index) => {
      const linkedAngles = goal.lifeAreaIds
        .map((areaId) => lifeAreaAngles.get(areaId))
        .filter((angle): angle is number => typeof angle === "number");
      const averageAngle =
        linkedAngles.length > 0
          ? Math.atan2(
              linkedAngles.reduce((sum, angle) => sum + Math.sin(angle), 0),
              linkedAngles.reduce((sum, angle) => sum + Math.cos(angle), 0),
            )
          : angleForIndex(index, goals.length, -Math.PI / 2 + 0.18);
      const spread = ((index % 5) - 2) * 0.08;
      const angle = averageAngle + spread;
      goalAngles.set(goal.id, angle);
      const point = pointOnRing(angle, ring.goal + (index % 3) * 46);
      return {
        id: goal.id,
        type: "Goal",
        title: goal.title,
        subtitle: goalStatusLabel(goal.status),
        ...point,
      };
    });

    const outerItems: GraphNode[] = [];
    const outerCountsByGoal = new Map<string, number>();
    const getOuterPoint = (goalIds: string[], fallbackIndex: number) => {
      const primaryGoalId = goalIds[0];
      const baseAngle =
        (primaryGoalId ? goalAngles.get(primaryGoalId) : undefined) ??
        angleForIndex(fallbackIndex, Math.max(templates.length + lifeEvents.length, 1));
      const count = outerCountsByGoal.get(primaryGoalId ?? "unlinked") ?? 0;
      outerCountsByGoal.set(primaryGoalId ?? "unlinked", count + 1);
      const angle = baseAngle + (count - 1.5) * 0.12;
      return pointOnRing(angle, ring.outer + (count % 3) * 56);
    };

    templates.forEach((template, index) => {
      outerItems.push({
        id: template.id,
        type: "Activity Template",
        title: template.title,
        subtitle: template.defaultDuration,
        ...getOuterPoint(template.goalIds, index),
      });
    });

    lifeEvents.forEach((event, index) => {
      outerItems.push({
        id: event.id,
        type: "Life Event",
        title: event.title,
        subtitle: `${event.date} · ${event.status}`,
        ...getOuterPoint(event.goalIds, templates.length + index),
      });
    });

    const historyCountsByGoal = new Map<string, number>();
    const historyNodes: GraphNode[] = goalHistoryEvents.map((event, index) => {
      const baseAngle =
        goalAngles.get(event.goalId) ??
        angleForIndex(index, Math.max(goalHistoryEvents.length, 1));
      const count = historyCountsByGoal.get(event.goalId) ?? 0;
      historyCountsByGoal.set(event.goalId, count + 1);
      const point = pointOnRing(
        baseAngle + (count - 1) * 0.1,
        ring.history + 80 + (count % 4) * 34,
      );
      return {
        id: event.id,
        type: "Goal History",
        title: goalHistoryLabel(event.type),
        subtitle: event.date,
        compact: true,
        ...point,
      };
    });

    const nodes = [
      youNode,
      ...lifeAreaNodes,
      ...goalNodes,
      ...outerItems,
      ...historyNodes,
    ];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges: GraphEdge[] = [
      ...lifeAreas.map((area) => ({
        id: `you-${area.id}`,
        from: "you",
        to: area.id,
      })),
      ...goals.flatMap((goal) =>
        goal.lifeAreaIds.map((areaId) => ({
          id: `${areaId}-${goal.id}`,
          from: areaId,
          to: goal.id,
        })),
      ),
      ...templates.flatMap((template) =>
        template.goalIds.map((goalId) => ({
          id: `${goalId}-${template.id}`,
          from: goalId,
          to: template.id,
        })),
      ),
      ...lifeEvents.flatMap((event) =>
        event.goalIds.length > 0
          ? event.goalIds.map((goalId) => ({
              id: `${goalId}-${event.id}`,
              from: goalId,
              to: event.id,
            }))
          : event.lifeAreaIds.map((areaId) => ({
              id: `${areaId}-${event.id}`,
              from: areaId,
              to: event.id,
            })),
      ),
      ...goalHistoryEvents.map((event) => ({
        id: `${event.goalId}-${event.id}`,
        from: event.goalId,
        to: event.id,
      })),
    ].filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to));
    return {
      nodes,
      edges,
      nodeById,
      center,
      rings: [ring.lifeArea, ring.goal, ring.outer],
      width: 2800,
      height: 2800,
    };
  }, [goalHistoryEvents, goals, lifeAreas, lifeEvents, templates]);

  const selectedDetails = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === "You") {
      return {
        title: "You",
        description: "The center of your LifeOS map.",
        parents: [] as string[],
        children: lifeAreas.map((area) => area.title),
      };
    }
    if (selectedNode.type === "Life Area") {
      const item = lifeAreas.find((area) => area.id === selectedNode.id);
      if (!item) return null;
      const linkedEvents = lifeEvents
        .filter((event) => event.lifeAreaIds.includes(item.id))
        .map((event) => event.title);
      return {
        title: item.title,
        description: item.description ?? "",
        parents: [] as string[],
        children: [
          ...goals
            .filter((goal) => goal.lifeAreaIds.includes(item.id))
            .map((goal) => goal.title),
          ...linkedEvents.map((event) => `Event: ${event}`),
        ],
      };
    }
    if (selectedNode.type === "Goal") {
      const item = goals.find((goal) => goal.id === selectedNode.id);
      if (!item) return null;
      return {
        title: item.title,
        description: item.description ?? "",
        parents: lifeAreas
          .filter((area) => item.lifeAreaIds.includes(area.id))
          .map((area) => area.title),
        children: templates
          .filter((template) => template.goalIds.includes(item.id))
          .map((template) => template.title),
      };
    }
    if (selectedNode.type === "Life Event") {
      const item = lifeEvents.find((event) => event.id === selectedNode.id);
      if (!item) return null;
      return {
        title: item.title,
        description: item.notes ?? item.description ?? "",
        parents: [
          ...goals
            .filter((goal) => item.goalIds.includes(goal.id))
            .map((goal) => goal.title),
          ...lifeAreas
            .filter((area) => item.lifeAreaIds.includes(area.id))
            .map((area) => area.title),
        ],
        children: [`${item.date}${item.endDate ? ` to ${item.endDate}` : ""}`, item.status],
      };
    }
    if (selectedNode.type === "Goal History") {
      const item = goalHistoryEvents.find((event) => event.id === selectedNode.id);
      if (!item) return null;
      return {
        title: goalHistoryLabel(item.type),
        description: item.note ?? "",
        parents: goals
          .filter((goal) => goal.id === item.goalId)
          .map((goal) => goal.title),
        children: [item.date],
      };
    }
    const item = templates.find((template) => template.id === selectedNode.id);
    if (!item) return null;
    const plannedDays = plannedActivities
      .filter((planned) => planned.templateId === item.id)
      .map((planned) => planned.day);
    return {
      title: item.title,
      description: item.defaultNotes ?? item.description ?? "",
      parents: goals
        .filter((goal) => item.goalIds.includes(goal.id))
        .map((goal) => goal.title),
      children: plannedDays.map((day) => `Planned ${day}`),
    };
  }, [
    goalHistoryEvents,
    goals,
    lifeAreas,
    lifeEvents,
    plannedActivities,
    selectedNode,
    templates,
  ]);

  const completedCount = selectedWeekPlannedActivities.filter(
    (planned) => planned.status === "done",
  ).length;
  const selectedTemplate = selectedTemplateId
    ? templates.find((template) => template.id === selectedTemplateId) ?? null
    : null;
  const weeklyStats = useMemo(() => {
    const lifeAreaStats = new Map(
      lifeAreas.map((area) => [
        area.id,
        {
          id: area.id,
          title: area.title,
          plannedCount: 0,
          completedCount: 0,
          plannedMinutes: 0,
          completedMinutes: 0,
        },
      ]),
    );
    const goalStats = new Map(
      goals.map((goal) => [
        goal.id,
        {
          id: goal.id,
          title: goal.title,
          plannedCount: 0,
          completedCount: 0,
          plannedMinutes: 0,
          completedMinutes: 0,
        },
      ]),
    );
    const dayStats = new Map(
      days.map((day) => [day, { day, plannedMinutes: 0, completedMinutes: 0 }]),
    );

    let totalPlannedMinutes = 0;
    let totalCompletedMinutes = 0;
    const coveredGoalIds = new Set<string>();

    selectedWeekPlannedActivities.forEach((planned) => {
      const template = templates.find((item) => item.id === planned.templateId);
      if (!template) return;

      const minutes = parseDurationMinutes(
        planned.duration || template.defaultDuration,
      ) || planned.metadata?.durationMinutes || 0;
      const isDone = planned.status === "done";
      totalPlannedMinutes += minutes;
      if (isDone) totalCompletedMinutes += minutes;

      const day = dayStats.get(planned.day);
      if (day) {
        day.plannedMinutes += minutes;
        if (isDone) day.completedMinutes += minutes;
      }

      const linkedGoalIds = Array.from(
        new Set([...(template.goalIds ?? []), ...(planned.goalIds ?? [])]),
      );
      const linkedGoals = linkedGoalIds
        .map((goalId) => goals.find((goal) => goal.id === goalId))
        .filter(Boolean) as Goal[];
      const linkedAreaIds = new Set(
        [...(planned.lifeAreaIds ?? []), ...linkedGoals.flatMap((goal) => goal.lifeAreaIds)],
      );

      linkedGoals.forEach((goal) => {
        coveredGoalIds.add(goal.id);
        const stat = goalStats.get(goal.id);
        if (!stat) return;
        stat.plannedCount += 1;
        stat.plannedMinutes += minutes;
        if (isDone) {
          stat.completedCount += 1;
          stat.completedMinutes += minutes;
        }
      });

      linkedAreaIds.forEach((areaId) => {
        const stat = lifeAreaStats.get(areaId);
        if (!stat) return;
        stat.plannedCount += 1;
        stat.plannedMinutes += minutes;
        if (isDone) {
          stat.completedCount += 1;
          stat.completedMinutes += minutes;
        }
      });
    });

    const dayRows = days.map((day) => dayStats.get(day)!);
    const busiestDay = dayRows.reduce(
      (busiest, day) =>
        day.plannedMinutes > busiest.plannedMinutes ? day : busiest,
      dayRows[0],
    );

    return {
      totalPlannedMinutes,
      totalCompletedMinutes,
      completionRate: selectedWeekPlannedActivities.length
        ? Math.round((completedCount / selectedWeekPlannedActivities.length) * 100)
        : 0,
      busiestDay,
      goalCoverage: {
        covered: coveredGoalIds.size,
        total: goals.length,
      },
      dayRows,
      lifeAreaRows: Array.from(lifeAreaStats.values()),
      goalRows: Array.from(goalStats.values()),
    };
  }, [completedCount, goals, lifeAreas, selectedWeekPlannedActivities, templates]);

  const plannerStats =
    selectedPlannerLifeAreaId === "all"
      ? {
          title: "All Life Areas",
          plannedCount: selectedWeekPlannedActivities.length,
          completedCount,
          plannedMinutes: weeklyStats.totalPlannedMinutes,
          completedMinutes: weeklyStats.totalCompletedMinutes,
          completionRate: weeklyStats.completionRate,
        }
      : {
          title: selectedPlannerLifeArea?.title ?? "Selected Life Area",
          plannedCount:
            weeklyStats.lifeAreaRows.find(
              (row) => row.id === selectedPlannerLifeAreaId,
            )?.plannedCount ?? 0,
          completedCount:
            weeklyStats.lifeAreaRows.find(
              (row) => row.id === selectedPlannerLifeAreaId,
            )?.completedCount ?? 0,
          plannedMinutes:
            weeklyStats.lifeAreaRows.find(
              (row) => row.id === selectedPlannerLifeAreaId,
            )?.plannedMinutes ?? 0,
          completedMinutes:
            weeklyStats.lifeAreaRows.find(
              (row) => row.id === selectedPlannerLifeAreaId,
            )?.completedMinutes ?? 0,
          completionRate: (() => {
            const row = weeklyStats.lifeAreaRows.find(
              (item) => item.id === selectedPlannerLifeAreaId,
            );
            return row?.plannedCount
              ? Math.round((row.completedCount / row.plannedCount) * 100)
              : 0;
          })(),
        };

  const upcomingEvents = useMemo(
    () =>
      lifeEvents
        .filter((event) => event.status === "upcoming")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [lifeEvents],
  );

  const selectedGoalForMap =
    selectedNode?.type === "Goal"
      ? goals.find((goal) => goal.id === selectedNode.id) ?? null
      : null;
  const selectedGoalMapEvents = selectedGoalForMap
    ? lifeEvents
        .filter((event) => event.goalIds.includes(selectedGoalForMap.id))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const selectedGoalMapHistory = selectedGoalForMap
    ? goalHistoryEvents
        .filter((event) => event.goalId === selectedGoalForMap.id)
        .sort((a, b) => {
          const dateComparison = b.date.localeCompare(a.date);
          return dateComparison || b.createdAt.localeCompare(a.createdAt);
        })
    : [];
  const selectedMapEvent =
    selectedNode?.type === "Life Event"
      ? lifeEvents.find((event) => event.id === selectedNode.id) ?? null
      : null;
  const selectedMapHistoryEvent =
    selectedNode?.type === "Goal History"
      ? goalHistoryEvents.find((event) => event.id === selectedNode.id) ?? null
      : null;
  const canEditSelectedNode =
    selectedNode !== null &&
    selectedNode.type !== "You" &&
    selectedNode.type !== "Goal History";
  const canDeleteSelectedNode =
    selectedNode !== null &&
    selectedNode.type !== "You" &&
    selectedNode.type !== "Goal History";

  async function loadDemoPersona(personaId: string) {
    const persona =
      testPersonas.find((item) => item.id === personaId) ?? defaultPersona;
    const week = createWeek(getCurrentWeekStartDate());
    const data = await lifeosRepository.replaceLifeOSDataWithPersona(
      persona,
      week,
    );

    setActiveDemoPersonaId(persona.id);
    setWeeks(data.weeks);
    setSelectedWeekId(week.id);
    setLifeAreas(data.lifeAreas);
    setGoals(data.goals);
    setTemplates(data.activityTemplates);
    setPlannedActivities(data.plannedActivities);
    setLifeEvents(data.lifeEvents);
    setGoalHistoryEvents(data.goalHistoryEvents);
    setWeeklyReviews(data.weeklyReviews);
    setBuilderKind("lifeArea");
    setLifeAreaDraft(blankLifeArea);
    setGoalDraft({
      ...blankGoal,
      lifeAreaIds: persona.lifeAreas[0] ? [persona.lifeAreas[0].id] : [],
    });
    setTemplateDraft({
      ...blankTemplate,
      goalIds: persona.goals[0] ? [persona.goals[0].id] : [],
    });
    setEditing(null);
    setEditingPlanned(null);
    setSelectedTemplateId(null);
    setSelectedNode(null);
    setActiveDrag(null);
    setDropPreview(null);
    setCheckInDay(today);
    setSelectedPlannerLifeAreaId("all");
    setReflectionDrafts({});
    const review =
      data.weeklyReviews
        .filter((item) => item.weekId === week.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    setWeeklyReflectionDraft(weeklyReflectionDraftFromReview(review));
    setWeeklyReviewNotes(review?.userNotes ?? "");
    setWeeklyReflectionPreview(null);
    setWeeklyReflectionError(null);
  }

  function selectWeek(weekStartDate: string) {
    const week = createWeek(weekStartDate);
    setWeeks((current) =>
      current.some((item) => item.id === week.id) ? current : [...current, week],
    );
    void lifeosRepository.saveWeek(week);
    setSelectedWeekId(week.id);
    setEditingPlanned(null);
    setDropPreview(null);
    const review =
      weeklyReviews
        .filter((item) => item.weekId === week.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    setWeeklyReflectionDraft(weeklyReflectionDraftFromReview(review));
    setWeeklyReviewNotes(review?.userNotes ?? "");
    setWeeklyReflectionPreview(null);
    setWeeklyReflectionError(null);
  }

  function selectPreviousWeek() {
    selectWeek(addDaysToDateKey(selectedWeek.weekStartDate, -7));
  }

  function selectNextWeek() {
    selectWeek(addDaysToDateKey(selectedWeek.weekStartDate, 7));
  }

  function selectCurrentWeek() {
    selectWeek(getCurrentWeekStartDate());
  }

  async function exportLocalData() {
    try {
      const exportData = await lifeosRepository.exportLifeOSData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lifeos-backup-${exportData.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDataManagementMessage("Exported local LifeOS data.");
    } catch (error) {
      setDataManagementMessage(
        error instanceof Error ? error.message : "Export failed.",
      );
    }
  }

  async function importLocalData(file: File | null) {
    if (!file) return;

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      const exportData = lifeosRepository.validateLifeOSExport(parsed);
      const confirmed = window.confirm(
        "Import this LifeOS backup? This will replace all local LifeOS data stored on this device.",
      );
      if (!confirmed) return;

      const data = await lifeosRepository.importLifeOSData(exportData);
      setWeeks(data.weeks);
      setLifeAreas(data.lifeAreas);
      setGoals(data.goals);
      setTemplates(data.activityTemplates);
      setPlannedActivities(data.plannedActivities);
      setLifeEvents(data.lifeEvents);
      setGoalHistoryEvents(data.goalHistoryEvents);
      setWeeklyReviews(data.weeklyReviews);
      setSelectedWeekId(data.weeks[0]?.id ?? currentWeek.id);
      setEditing(null);
      setEditingPlanned(null);
      setSelectedTemplateId(null);
      setSelectedNode(null);
      setActiveDrag(null);
      setDropPreview(null);
      setCheckInDay(today);
      setSelectedPlannerLifeAreaId("all");
      setReflectionDrafts({});
      const selectedImportedWeekId = data.weeks[0]?.id ?? currentWeek.id;
      const review =
        data.weeklyReviews
          .filter((item) => item.weekId === selectedImportedWeekId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      setWeeklyReflectionDraft(weeklyReflectionDraftFromReview(review));
      setWeeklyReviewNotes(review?.userNotes ?? "");
      setWeeklyReflectionPreview(null);
      setWeeklyReflectionError(null);
      setDataManagementMessage("Imported LifeOS backup.");
    } catch (error) {
      setDataManagementMessage(
        error instanceof Error ? error.message : "Import failed.",
      );
    }
  }

  function resetDraft(kind: BuilderKind) {
    setEditing(null);
    if (kind === "lifeArea") setLifeAreaDraft(blankLifeArea);
    if (kind === "goal") {
      setGoalDraft({
        ...blankGoal,
        lifeAreaIds: lifeAreas[0] ? [lifeAreas[0].id] : [],
      });
    }
    if (kind === "template") {
      setTemplateDraft({
        ...blankTemplate,
        goalIds: goals[0] ? [goals[0].id] : [],
      });
    }
  }

  function saveLifeArea() {
    const item = {
      ...lifeAreaDraft,
      id: lifeAreaDraft.id || makeId("area"),
      title: lifeAreaDraft.title.trim() || "Untitled Life Area",
    };
    setLifeAreas((current) =>
      current.some((area) => area.id === item.id)
        ? current.map((area) => (area.id === item.id ? item : area))
        : [...current, item],
    );
    void lifeosRepository.saveLifeArea(item);
    resetDraft("lifeArea");
  }

  function createGoalHistoryEvent(
    goalId: string,
    type: GoalHistoryEventType,
    note?: string,
  ): GoalHistoryEvent {
    const now = new Date().toISOString();
    return {
      id: makeId("goal-history"),
      goalId,
      type,
      note: note?.trim() || undefined,
      date: formatDateKey(new Date()),
      createdAt: now,
    };
  }

  function getGoalStatusEvent(
    previousStatus: GoalStatus,
    nextStatus: GoalStatus,
  ): GoalHistoryEventType | null {
    if (previousStatus === nextStatus) return null;
    if (nextStatus === "completed") return "completed";
    if (nextStatus === "paused") return "paused";
    if (nextStatus === "archived") return "archived";
    if (nextStatus === "active") return "resumed";
    return null;
  }

  function applyGoalStatusFields(goal: Goal, status: GoalStatus, now: string): Goal {
    return {
      ...goal,
      status,
      createdAt: goal.createdAt || now,
      completedAt: status === "completed" ? goal.completedAt ?? now : undefined,
      archivedAt: status === "archived" ? goal.archivedAt ?? now : undefined,
    };
  }

  function saveGoalAndHistory(goal: Goal, event?: GoalHistoryEvent) {
    setGoals((current) =>
      current.some((item) => item.id === goal.id)
        ? current.map((item) => (item.id === goal.id ? goal : item))
        : [...current, goal],
    );
    if (event) {
      setGoalHistoryEvents((current) => [...current, event]);
    }
    void lifeosRepository.saveGoalWithHistory(goal, event);
  }

  function saveGoal() {
    const existing = goals.find((goal) => goal.id === goalDraft.id);
    const now = new Date().toISOString();
    const status = goalDraft.status ?? existing?.status ?? "active";
    const item = applyGoalStatusFields({
      ...goalDraft,
      id: goalDraft.id || makeId("goal"),
      title: goalDraft.title.trim() || "Untitled Goal",
      createdAt: goalDraft.createdAt || existing?.createdAt || now,
    }, status, now);
    const statusEvent = existing
      ? getGoalStatusEvent(existing.status ?? "active", item.status ?? "active")
      : null;
    const historyEvent = existing
      ? createGoalHistoryEvent(item.id, statusEvent ?? "updated")
      : createGoalHistoryEvent(item.id, "created");
    saveGoalAndHistory(item, historyEvent);
    resetDraft("goal");
  }

  function saveTemplate() {
    const item = {
      ...templateDraft,
      id: templateDraft.id || makeId("template"),
      title: templateDraft.title.trim() || "Untitled Activity Template",
    };
    setTemplates((current) =>
      current.some((template) => template.id === item.id)
        ? current.map((template) => (template.id === item.id ? item : template))
        : [...current, item],
    );
    void lifeosRepository.saveActivityTemplate(item);
    resetDraft("template");
  }

  function resetLifeEventDraft() {
    setEditingLifeEventId(null);
    setLifeEventDraft(blankLifeEvent);
  }

  function startLifeEventForGoal(goal: Goal) {
    setBuilderKind("goal");
    setEditingLifeEventId(null);
    setLifeEventDraft({
      ...blankLifeEvent,
      date: formatDateKey(new Date()),
      goalIds: [goal.id],
      lifeAreaIds: goal.lifeAreaIds,
    });
  }

  function saveLifeEvent() {
    const now = new Date().toISOString();
    const item: LifeEvent = {
      ...lifeEventDraft,
      id: lifeEventDraft.id || makeId("event"),
      title: lifeEventDraft.title.trim() || "Untitled Event",
      date: lifeEventDraft.date || formatDateKey(new Date()),
      endDate: lifeEventDraft.endDate || undefined,
      createdAt: lifeEventDraft.createdAt || now,
      updatedAt: now,
    };

    setLifeEvents((current) =>
      current.some((event) => event.id === item.id)
        ? current.map((event) => (event.id === item.id ? item : event))
        : [...current, item],
    );
    void lifeosRepository.saveLifeEvent(item);
    resetLifeEventDraft();
  }

  function editLifeEvent(id: string) {
    const item = lifeEvents.find((event) => event.id === id);
    if (!item) return;
    setEditingLifeEventId(id);
    setLifeEventDraft(item);
  }

  function deleteLifeEvent(id: string) {
    setLifeEvents((current) => current.filter((event) => event.id !== id));
    void lifeosRepository.deleteLifeEvent(id);
    if (editingLifeEventId === id) resetLifeEventDraft();
  }

  function openBoardCreate(day: DayKey) {
    const date = dateForSelectedWeekDay(day);
    const focusedLifeAreaId =
      selectedPlannerLifeAreaId === "all" ? "" : selectedPlannerLifeAreaId;
    setBoardCreateDraft({
      ...blankBoardCreateDraft,
      day,
      lifeAreaId: focusedLifeAreaId,
      eventDate: date,
      eventLifeAreaIds: focusedLifeAreaId ? [focusedLifeAreaId] : [],
    });
  }

  function saveBoardCreate() {
    if (!boardCreateDraft) return;
    const title = boardCreateDraft.title.trim() || "Untitled";

    if (boardCreateDraft.mode === "activity") {
      const template: ActivityTemplate = {
        id: makeId("template-adhoc"),
        title,
        description: boardCreateDraft.details || undefined,
        goalIds: boardCreateDraft.goalId ? [boardCreateDraft.goalId] : [],
        defaultDuration: boardCreateDraft.duration || undefined,
        defaultNotes: boardCreateDraft.notes || undefined,
      };
      const planned: PlannedActivity = {
        id: makeId("planned"),
        weekId: selectedWeek.id,
        templateId: template.id,
        day: boardCreateDraft.day,
        titleOverride: title,
        duration: boardCreateDraft.duration || undefined,
        details: boardCreateDraft.details || undefined,
        notes: boardCreateDraft.notes || undefined,
        lifeAreaIds: boardCreateDraft.lifeAreaId ? [boardCreateDraft.lifeAreaId] : [],
        goalIds: boardCreateDraft.goalId ? [boardCreateDraft.goalId] : [],
        status: "planned",
        sortOrder: plannedByDay[boardCreateDraft.day].length,
      };

      setTemplates((current) => [...current, template]);
      setPlannedActivities((current) => [...current, planned]);
      void lifeosRepository.saveActivityTemplate(template);
      void lifeosRepository.savePlannedActivity(planned);
      setBoardCreateDraft(null);
      return;
    }

    const linkedEventGoals = goals.filter((goal) =>
      boardCreateDraft.eventGoalIds.includes(goal.id),
    );
    const lifeAreaIds = Array.from(
      new Set([
        ...boardCreateDraft.eventLifeAreaIds,
        ...linkedEventGoals.flatMap((goal) => goal.lifeAreaIds),
      ]),
    );
    const now = new Date().toISOString();
    const event: LifeEvent = {
      id: makeId("event"),
      title,
      description: boardCreateDraft.details || undefined,
      date: boardCreateDraft.eventDate || dateForSelectedWeekDay(boardCreateDraft.day),
      endDate: boardCreateDraft.eventEndDate || undefined,
      type: boardCreateDraft.eventType,
      lifeAreaIds,
      goalIds: boardCreateDraft.eventGoalIds,
      status: boardCreateDraft.eventStatus,
      notes: boardCreateDraft.notes || undefined,
      createdAt: now,
      updatedAt: now,
    };

    setLifeEvents((current) => [...current, event]);
    void lifeosRepository.saveLifeEvent(event);
    setBoardCreateDraft(null);
  }

  function updateLifeArea(id: string, patch: Partial<LifeArea>) {
    const item = lifeAreas.find((area) => area.id === id);
    if (!item) return;
    const updated = { ...item, ...patch };
    setLifeAreas((current) =>
      current.map((area) => (area.id === id ? updated : area)),
    );
    void lifeosRepository.saveLifeArea(updated);
  }

  function updateGoal(id: string, patch: Partial<Goal>) {
    const item = goals.find((goal) => goal.id === id);
    if (!item) return;
    const previousStatus = item.status ?? "active";
    const nextStatus = patch.status ?? previousStatus;
    const updated = applyGoalStatusFields(
      { ...item, ...patch },
      nextStatus,
      new Date().toISOString(),
    );
    const eventType = getGoalStatusEvent(previousStatus, nextStatus);
    saveGoalAndHistory(
      updated,
      eventType ? createGoalHistoryEvent(id, eventType) : undefined,
    );
  }

  function updateGoalStatus(id: string, status: GoalStatus) {
    updateGoal(id, { status });
    setGoalDraft((current) =>
      current.id === id ? applyGoalStatusFields(current, status, new Date().toISOString()) : current,
    );
  }

  function addGoalReflection(goalId: string) {
    const note = reflectionDrafts[goalId]?.trim();
    if (!note) return;
    const event = createGoalHistoryEvent(goalId, "reflection", note);
    setGoalHistoryEvents((current) => [...current, event]);
    setReflectionDrafts((current) => ({ ...current, [goalId]: "" }));
    void lifeosRepository.saveGoalHistoryEvent(event);
  }

  function updateTemplate(id: string, patch: Partial<ActivityTemplate>) {
    const item = templates.find((template) => template.id === id);
    if (!item) return;
    const updated = { ...item, ...patch };
    setTemplates((current) =>
      current.map((template) => (template.id === id ? updated : template)),
    );
    void lifeosRepository.saveActivityTemplate(updated);
  }

  function editEntity(kind: BuilderKind, id: string) {
    setBuilderKind(kind);
    setEditing({ kind, id });
    if (kind === "lifeArea") {
      setLifeAreaDraft(lifeAreas.find((area) => area.id === id) ?? blankLifeArea);
    }
    if (kind === "goal") {
      setGoalDraft(goals.find((goal) => goal.id === id) ?? blankGoal);
    }
    if (kind === "template") {
      setTemplateDraft(
        templates.find((template) => template.id === id) ?? blankTemplate,
      );
    }
  }

  function deleteLifeArea(id: string) {
    const nextGoals = goals.map((goal) => ({
      ...goal,
      lifeAreaIds: goal.lifeAreaIds.filter((areaId) => areaId !== id),
    }));
    setLifeAreas((current) => current.filter((area) => area.id !== id));
    setGoals(nextGoals);
    const nextEvents = lifeEvents.map((event) => ({
      ...event,
      lifeAreaIds: event.lifeAreaIds.filter((areaId) => areaId !== id),
    }));
    setLifeEvents(nextEvents);
    void lifeosRepository.deleteLifeArea(id);
    void lifeosRepository.saveGoals(nextGoals);
    nextEvents.forEach((event) => void lifeosRepository.saveLifeEvent(event));
  }

  function deleteGoal(id: string) {
    const nextTemplates = templates.map((template) => ({
      ...template,
      goalIds: template.goalIds.filter((goalId) => goalId !== id),
    }));
    setGoals((current) => current.filter((goal) => goal.id !== id));
    setTemplates(nextTemplates);
    const nextEvents = lifeEvents.map((event) => ({
      ...event,
      goalIds: event.goalIds.filter((goalId) => goalId !== id),
    }));
    setLifeEvents(nextEvents);
    setGoalHistoryEvents((current) =>
      current.filter((event) => event.goalId !== id),
    );
    void lifeosRepository.deleteGoal(id);
    void lifeosRepository.saveActivityTemplates(nextTemplates);
    nextEvents.forEach((event) => void lifeosRepository.saveLifeEvent(event));
    goalHistoryEvents
      .filter((event) => event.goalId === id)
      .forEach((event) => void lifeosRepository.deleteGoalHistoryEvent(event.id));
  }

  function deleteTemplate(id: string) {
    const plannedIdsToDelete = plannedActivities
      .filter((planned) => planned.templateId === id)
      .map((planned) => planned.id);
    setTemplates((current) => current.filter((template) => template.id !== id));
    setPlannedActivities((current) =>
      current.filter((planned) => planned.templateId !== id),
    );
    void lifeosRepository.deleteActivityTemplate(id);
    if (plannedIdsToDelete.length > 0) {
      void lifeosRepository.deletePlannedActivities(plannedIdsToDelete);
    }
  }

  function updateSelectedNode(field: "title" | "description", value: string) {
    if (!selectedNode) return;
    if (selectedNode.type === "You" || selectedNode.type === "Goal History") return;
    if (selectedNode.type === "Life Area") {
      updateLifeArea(selectedNode.id, { [field]: value });
    }
    if (selectedNode.type === "Goal") {
      updateGoal(selectedNode.id, { [field]: value });
    }
    if (selectedNode.type === "Activity Template") {
      updateTemplate(
        selectedNode.id,
        field === "title" ? { title: value } : { defaultNotes: value },
      );
    }
    if (selectedNode.type === "Life Event") {
      const patch =
        field === "title"
          ? { title: value }
          : { description: value, notes: value };
      const item = lifeEvents.find((event) => event.id === selectedNode.id);
      if (item) {
        const updated = { ...item, ...patch, updatedAt: new Date().toISOString() };
        setLifeEvents((current) =>
          current.map((event) => (event.id === selectedNode.id ? updated : event)),
        );
        void lifeosRepository.saveLifeEvent(updated);
      }
    }
    setSelectedNode((current) =>
      current ? { ...current, title: field === "title" ? value : current.title } : current,
    );
  }

  function deleteSelectedNode() {
    if (!selectedNode) return;
    if (selectedNode.type === "Life Area") deleteLifeArea(selectedNode.id);
    if (selectedNode.type === "Goal") deleteGoal(selectedNode.id);
    if (selectedNode.type === "Activity Template") deleteTemplate(selectedNode.id);
    if (selectedNode.type === "Life Event") deleteLifeEvent(selectedNode.id);
    setSelectedNode(null);
  }

  function removePlannedActivity(id: string) {
    const item = plannedActivities.find((planned) => planned.id === id);
    const template = item
      ? templates.find((candidate) => candidate.id === item.templateId)
      : null;
    const shouldDeleteAdHocTemplate =
      item &&
      template &&
      isAdHocTemplate(template) &&
      plannedActivities.filter((planned) => planned.templateId === template.id).length <= 1;

    setPlannedActivities((current) => current.filter((planned) => planned.id !== id));
    if (shouldDeleteAdHocTemplate) {
      setTemplates((current) =>
        current.filter((candidate) => candidate.id !== template.id),
      );
      void lifeosRepository.deleteActivityTemplate(template.id);
    }
    void lifeosRepository.deletePlannedActivity(id);
    if (editingPlanned?.id === id) {
      setEditingPlanned(null);
      setActivityExtractionPreview(null);
      setActivityExtractionError(null);
      setIsExtractingActivity(false);
    }
  }

  function openPlannedActivity(planned: PlannedActivity) {
    setActivityExtractionPreview(null);
    setActivityExtractionError(null);
    setIsExtractingActivity(false);
    setEditingPlanned(planned);
  }

  function isDayKey(value: string): value is DayKey {
    return days.includes(value as DayKey);
  }

  function findPlannedLocation(plannedId: string) {
    for (const day of days) {
      const index = plannedByDay[day].findIndex((planned) => planned.id === plannedId);
      if (index !== -1) return { day, index };
    }
    return null;
  }

  function getOverPosition(overId: string | null) {
    if (!overId) return null;
    if (isDayKey(overId)) return { day: overId, index: plannedByDay[overId].length };
    return findPlannedLocation(overId);
  }

  function orderedPlanned(byDay: Record<DayKey, PlannedActivity[]>) {
    return days.flatMap((day) =>
      byDay[day].map((planned, index) => ({ ...planned, sortOrder: index })),
    );
  }

  function replaceSelectedWeekPlannedActivities(nextPlanned: PlannedActivity[]) {
    setPlannedActivities((current) => [
      ...current.filter((planned) => planned.weekId !== selectedWeek.id),
      ...nextPlanned,
    ]);
    void lifeosRepository.savePlannedActivities(nextPlanned);
  }

  function movePlannedActivity(plannedId: string, toDay: DayKey, toIndex: number) {
    const fromLocation = findPlannedLocation(plannedId);
    if (!fromLocation) return;
    const moving = plannedByDay[fromLocation.day][fromLocation.index];
    const nextByDay = {
      ...plannedByDay,
      [fromLocation.day]: plannedByDay[fromLocation.day].filter(
        (planned) => planned.id !== plannedId,
      ),
    };
    const targetList = [...nextByDay[toDay]];
    const adjustedIndex =
      fromLocation.day === toDay && fromLocation.index < toIndex
        ? toIndex - 1
        : toIndex;
    targetList.splice(Math.max(0, Math.min(adjustedIndex, targetList.length)), 0, {
      ...moving,
      day: toDay,
    });
    nextByDay[toDay] = targetList;
    replaceSelectedWeekPlannedActivities(orderedPlanned(nextByDay));
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    setActiveDrag(
      data.type === "template"
        ? { type: "template", template: data.template }
        : { type: "planned", plannedActivity: data.plannedActivity },
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const activeData = event.active.data.current as DragData | undefined;
    const overPosition = getOverPosition(String(event.over?.id ?? ""));
    if (!activeData || !overPosition) {
      setDropPreview(null);
      return;
    }
    if (activeData.type === "template") {
      setDropPreview({
        day: overPosition.day,
        index: overPosition.index,
        template: activeData.template,
      });
      return;
    }
    setDropPreview(null);
    movePlannedActivity(
      activeData.plannedActivity.id,
      overPosition.day,
      overPosition.index,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as DragData | undefined;
    const overPosition = getOverPosition(String(event.over?.id ?? ""));
    if (activeData?.type === "template" && overPosition) {
      const planned: PlannedActivity = {
        id: makeId("planned"),
        weekId: selectedWeek.id,
        templateId: activeData.template.id,
        day: overPosition.day,
        duration: activeData.template.defaultDuration,
        notes: activeData.template.defaultNotes,
        status: "planned",
        sortOrder: overPosition.index,
      };
      const nextByDay = { ...plannedByDay };
      const targetList = [...nextByDay[overPosition.day]];
      targetList.splice(Math.min(overPosition.index, targetList.length), 0, planned);
      nextByDay[overPosition.day] = targetList;
      replaceSelectedWeekPlannedActivities(orderedPlanned(nextByDay));
    }
    setActiveDrag(null);
    setDropPreview(null);
  }

  function updatePlanned(id: string, patch: Partial<PlannedActivity>) {
    const item = plannedActivities.find((planned) => planned.id === id);
    if (!item) return;
    const statusPatch =
      patch.status === "done"
        ? { completedAt: item.completedAt ?? new Date().toISOString() }
        : patch.status
          ? { completedAt: undefined }
          : {};
    const updated = { ...item, ...patch, ...statusPatch };
    setPlannedActivities((current) =>
      current.map((planned) => (planned.id === id ? updated : planned)),
    );
    setEditingPlanned((current) =>
      current?.id === id ? updated : current,
    );
    void lifeosRepository.savePlannedActivity(updated);
  }

  async function extractActivityDetailsLocally() {
    if (!editingPlanned) return;
    const template = templates.find((item) => item.id === editingPlanned.templateId);
    setIsExtractingActivity(true);
    setActivityExtractionError(null);
    setActivityExtractionPreview(null);

    try {
      const response = await fetch("/api/local-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingPlanned.titleOverride || template?.title || "",
          details: editingPlanned.details ?? "",
          notes: editingPlanned.notes ?? "",
          rawLog: editingPlanned.rawLog ?? "",
        }),
      });
      const data = (await response.json()) as
        | ExtractionPreview
        | { error?: string };

      if (!response.ok || "error" in data) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Local extraction is unavailable. Make sure Ollama is running.",
        );
      }
      if (!isExtractionPreview(data)) {
        throw new Error("Local extraction returned an unexpected response.");
      }

      setActivityExtractionPreview(data);
    } catch (error) {
      setActivityExtractionError(
        error instanceof Error
          ? error.message
          : "Local extraction is unavailable. Make sure Ollama is running.",
      );
    } finally {
      setIsExtractingActivity(false);
    }
  }

  function acceptActivityExtraction() {
    if (!editingPlanned || !activityExtractionPreview) return;
    updatePlanned(editingPlanned.id, {
      activityKind: activityExtractionPreview.metadata.activityKind,
      metadata: activityExtractionPreview.metadata,
      extraction: activityExtractionPreview.extraction,
    });
    setActivityExtractionPreview(null);
    setActivityExtractionError(null);
  }

  function buildWeeklyReflectionPayload() {
    const activities = selectedWeekPlannedActivities.map((planned) => {
      const template = templates.find((item) => item.id === planned.templateId);
      const linkedGoalIds = Array.from(
        new Set([...(template?.goalIds ?? []), ...(planned.goalIds ?? [])]),
      );
      const linkedGoals = goals.filter((goal) => linkedGoalIds.includes(goal.id));
      const linkedLifeAreaIds = Array.from(
        new Set([
          ...(planned.lifeAreaIds ?? []),
          ...linkedGoals.flatMap((goal) => goal.lifeAreaIds),
        ]),
      );
      const linkedLifeAreas = lifeAreas.filter((area) =>
        linkedLifeAreaIds.includes(area.id),
      );

      return {
        title: planned.titleOverride || template?.title || "Untitled activity",
        day: planned.day,
        status: planned.status,
        duration: planned.duration || template?.defaultDuration || null,
        details: planned.details ?? null,
        notes: planned.notes ?? null,
        rawLog: planned.rawLog ?? null,
        metadata: planned.metadata ?? null,
        goals: linkedGoals.map((goal) => goal.title),
        lifeAreas: linkedLifeAreas.map((area) => area.title),
      };
    });

    return {
      week: {
        id: selectedWeek.id,
        weekStartDate: selectedWeek.weekStartDate,
        title: selectedWeek.title,
      },
      totals: {
        plannedActivities: selectedWeekPlannedActivities.length,
        completedActivities: completedCount,
        plannedMinutes: weeklyStats.totalPlannedMinutes,
        completedMinutes: weeklyStats.totalCompletedMinutes,
        completionRate: weeklyStats.completionRate,
      },
      activities,
      goals: weeklyStats.goalRows
        .filter((row) => row.plannedCount > 0 || row.completedCount > 0)
        .map((row) => ({
          title: row.title,
          plannedCount: row.plannedCount,
          completedCount: row.completedCount,
          plannedMinutes: row.plannedMinutes,
          completedMinutes: row.completedMinutes,
        })),
      lifeAreas: weeklyStats.lifeAreaRows
        .filter((row) => row.plannedCount > 0 || row.completedCount > 0)
        .map((row) => ({
          title: row.title,
          plannedCount: row.plannedCount,
          completedCount: row.completedCount,
          plannedMinutes: row.plannedMinutes,
          completedMinutes: row.completedMinutes,
        })),
      events: selectedWeekLifeEvents.map((event) => ({
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        type: event.type,
        status: event.status,
        notes: event.notes ?? event.description ?? null,
        goals: goals
          .filter((goal) => event.goalIds.includes(goal.id))
          .map((goal) => goal.title),
        lifeAreas: lifeAreas
          .filter((area) => event.lifeAreaIds.includes(area.id))
          .map((area) => area.title),
      })),
    };
  }

  async function generateWeeklyReflectionLocally() {
    setIsGeneratingWeeklyReflection(true);
    setWeeklyReflectionError(null);
    setWeeklyReflectionPreview(null);

    try {
      const response = await fetch("/api/local-weekly-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWeeklyReflectionPayload()),
      });
      const data = (await response.json()) as
        | WeeklyReflectionPreview
        | { error?: string };

      if (!response.ok || "error" in data) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Local weekly reflection is unavailable. Make sure Ollama is running.",
        );
      }
      if (!isWeeklyReflectionPreview(data)) {
        throw new Error("Local weekly reflection returned an unexpected response.");
      }

      setWeeklyReflectionPreview(data);
      setWeeklyReflectionDraft(data.reflection);
    } catch (error) {
      setWeeklyReflectionError(
        error instanceof Error
          ? error.message
          : "Local weekly reflection is unavailable. Make sure Ollama is running.",
      );
    } finally {
      setIsGeneratingWeeklyReflection(false);
    }
  }

  function updateWeeklyReflectionList(
    field: keyof Pick<
      WeeklyReflectionDraft,
      "wins" | "challenges" | "patterns" | "suggestedAdjustments" | "questionsForUser"
    >,
    value: string,
  ) {
    setWeeklyReflectionDraft((current) => ({
      ...current,
      [field]: linesToArray(value),
    }));
  }

  function saveWeeklyReflection(generatedBy: "ollama" | "manual") {
    const now = new Date().toISOString();
    const review: WeeklyReview = {
      id: selectedWeekReview?.id ?? makeId("weekly-review"),
      weekId: selectedWeek.id,
      summary: weeklyReflectionDraft.summary,
      wins: weeklyReflectionDraft.wins,
      challenges: weeklyReflectionDraft.challenges,
      goalCoverage: weeklyReflectionDraft.goalCoverage,
      patterns: weeklyReflectionDraft.patterns,
      suggestedAdjustments: weeklyReflectionDraft.suggestedAdjustments,
      questionsForUser: weeklyReflectionDraft.questionsForUser,
      userNotes: weeklyReviewNotes,
      generatedBy,
      model:
        generatedBy === "ollama"
          ? weeklyReflectionPreview?.model ?? selectedWeekReview?.model
          : selectedWeekReview?.model,
      createdAt: selectedWeekReview?.createdAt ?? now,
      updatedAt: now,
    };

    setWeeklyReviews((current) =>
      current.some((item) => item.id === review.id)
        ? current.map((item) => (item.id === review.id ? review : item))
        : [...current, review],
    );
    void lifeosRepository.saveWeeklyReview(review);
    setWeeklyReflectionPreview(null);
    setWeeklyReflectionError(null);
  }

  function clampMapScale(scale: number) {
    return Math.min(1.8, Math.max(0.35, scale));
  }

  function zoomMap(delta: number) {
    setMapView((current) => ({
      ...current,
      scale: clampMapScale(current.scale + delta),
    }));
  }

  function resetMapView() {
    setMapView({ x: 0, y: 0, scale: 0.78 });
  }

  function handleMapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      (event.target as HTMLElement).closest(
        '[data-map-interactive="true"], button, input, textarea, select, label',
      )
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    mapDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: mapView.x,
      originY: mapView.y,
    };
  }

  function handleMapPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setMapView((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  }

  function handleMapPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (mapDragRef.current?.pointerId === event.pointerId) {
      mapDragRef.current = null;
    }
  }

  function handleMapWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextScale = clampMapScale(mapView.scale - event.deltaY * 0.001);
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - mapView.x) / mapView.scale;
    const worldY = (cursorY - mapView.y) / mapView.scale;

    setMapView({
      scale: nextScale,
      x: cursorX - worldX * nextScale,
      y: cursorY - worldY * nextScale,
    });
  }

  const summaryCards = [
    ["Planned time", formatMinutes(weeklyStats.totalPlannedMinutes), "scheduled this week"],
    ["Completed time", formatMinutes(weeklyStats.totalCompletedMinutes), "logged as done"],
    [
      "Completion rate",
      `${weeklyStats.completionRate}%`,
      `${completedCount}/${selectedWeekPlannedActivities.length} activities`,
    ],
    ["Busiest day", weeklyStats.busiestDay.day, formatMinutes(weeklyStats.busiestDay.plannedMinutes)],
    [
      "Goal coverage",
      `${weeklyStats.goalCoverage.covered}/${weeklyStats.goalCoverage.total}`,
      "goals with planned activity",
    ],
  ];

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-stone-950">
      <div
        className={`mx-auto flex w-full flex-col gap-6 py-5 ${
          activeSection === "planning" || activeSection === "map"
            ? "max-w-none px-2 sm:px-3 lg:px-4"
            : "max-w-7xl px-4 sm:px-6 lg:px-8"
        }`}
      >
        <header className="rounded-lg border border-stone-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
                LifeOS MVP
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Plan weeks from reusable activity templates.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                Life Area {"->"} Goal {"->"} Activity Template {"->"} Planned Activity.
                A simple structure for connecting weekly activity back to what matters.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <nav className="grid grid-cols-2 gap-2 sm:flex">
                {[
                  ["dashboard", "Dashboard"],
                  ["builder", "Plan Goals"],
                  ["map", "Life Map"],
                  ["planning", "Weekly Plan"],
                  ["checkin", "Daily Check-in"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id as Section)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      activeSection === id
                        ? "bg-stone-950 text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <CollapsibleSection
                title="Demo / Test tools"
                description="Development-only data loading and local backup."
                contentClassName="space-y-3"
              >
                <DemoPersonaSwitcher
                  personas={testPersonas}
                  activePersonaId={activeDemoPersonaId}
                  onLoadPersona={loadDemoPersona}
                />
                <CollapsibleSection
                  title="Local backup"
                  description="Export or restore the IndexedDB data stored on this device."
                  className="border-stone-200 bg-white/70"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={exportLocalData}
                      className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-stone-700"
                    >
                      Export data
                    </button>
                    <label className="cursor-pointer rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white">
                      Import data
                      <input
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={(event) => {
                          void importLocalData(event.target.files?.[0] ?? null);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {dataManagementMessage && (
                    <p className="mt-2 text-xs text-stone-500">{dataManagementMessage}</p>
                  )}
                </CollapsibleSection>
              </CollapsibleSection>
            </div>
          </div>
        </header>

        {activeSection !== "map" && (
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Selected week
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {selectedWeek.title ?? `Week of ${selectedWeek.weekStartDate}`}
            </h2>
            <p className="text-sm text-stone-600">
              Starts Monday {selectedWeek.weekStartDate}
              {isHydrating ? " · Loading local data..." : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectPreviousWeek}
              className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
            >
              Previous week
            </button>
            <button
              type="button"
              onClick={selectCurrentWeek}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                selectedWeek.weekStartDate === getCurrentWeekStartDate()
                  ? "bg-stone-950 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Current week
            </button>
            <button
              type="button"
              onClick={selectNextWeek}
              className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200"
            >
              Next week
            </button>
          </div>
        </section>
        )}

        {activeSection === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {summaryCards.map(([label, value, detail]) => (
                <article
                  key={label}
                  className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-medium text-stone-500">{label}</p>
                  <p className="mt-3 text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-sm text-stone-600">{detail}</p>
                </article>
              ))}
            </div>
            <div className="space-y-4">
              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Upcoming events</h2>
                  <Pill>{upcomingEvents.length}</Pill>
                </div>
                <div className="mt-4 space-y-2">
                  {upcomingEvents.length === 0 && (
                    <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
                      No upcoming Life Events yet.
                    </p>
                  )}
                  {upcomingEvents.slice(0, 5).map((event) => (
                    <article key={event.id} className="rounded-lg bg-stone-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{event.title}</h3>
                          <p className="mt-1 text-sm text-stone-600">
                            {event.date}
                            {event.endDate ? ` to ${event.endDate}` : ""} · {event.type}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-stone-700">
                          {formatDaysUntil(event.date)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Weekly review</h2>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Generate a calm local draft from this selected week, then
                      edit and save only what you want to keep.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={generateWeeklyReflectionLocally}
                    disabled={isGeneratingWeeklyReflection}
                    className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    {isGeneratingWeeklyReflection
                      ? "Generating..."
                      : "Generate weekly reflection locally"}
                  </button>
                </div>

                {weeklyReflectionError && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {weeklyReflectionError}
                  </p>
                )}

                {selectedWeekReview && !weeklyReflectionPreview && (
                  <div className="mt-4 rounded-lg bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">Saved review</h3>
                      <span className="text-xs font-medium text-stone-500">
                        {selectedWeekReview.generatedBy === "ollama"
                          ? `Generated locally${selectedWeekReview.model ? ` with ${selectedWeekReview.model}` : ""}`
                          : "Manual review"}
                      </span>
                    </div>
                    {selectedWeekReview.summary && (
                      <p className="mt-3 text-sm leading-6 text-stone-700">
                        {selectedWeekReview.summary}
                      </p>
                    )}
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        ["Wins", selectedWeekReview.wins],
                        ["Challenges", selectedWeekReview.challenges],
                        ["Patterns", selectedWeekReview.patterns],
                        ["Adjustments", selectedWeekReview.suggestedAdjustments],
                        ["Questions", selectedWeekReview.questionsForUser],
                      ].map(([label, items]) => (
                        <div key={label as string}>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                            {label as string}
                          </p>
                          {(items as string[] | undefined)?.length ? (
                            <ul className="mt-2 space-y-1 text-sm text-stone-700">
                              {(items as string[]).map((item) => (
                                <li key={item}>- {item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-stone-500">No entries yet.</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {selectedWeekReview.goalCoverage?.length ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                          Goal coverage
                        </p>
                        <div className="mt-2 space-y-2">
                          {selectedWeekReview.goalCoverage.map((item) => (
                            <p
                              key={`${item.goalTitle}-${item.observation}`}
                              className="rounded-lg bg-white p-3 text-sm text-stone-700"
                            >
                              <span className="font-semibold">{item.goalTitle}:</span>{" "}
                              {item.observation}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 grid gap-3">
                  <label className="text-sm font-medium text-stone-700">
                    Summary
                    <textarea
                      value={weeklyReflectionDraft.summary}
                      onChange={(event) =>
                        setWeeklyReflectionDraft((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
                      placeholder="Write a short reflection, or generate a local draft."
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ["Wins", "wins"],
                      ["Challenges", "challenges"],
                      ["Patterns", "patterns"],
                      ["Suggested adjustments", "suggestedAdjustments"],
                      ["Questions for yourself", "questionsForUser"],
                    ].map(([label, field]) => (
                      <label
                        key={field}
                        className="text-sm font-medium text-stone-700"
                      >
                        {label}
                        <textarea
                          value={arrayToLines(
                            weeklyReflectionDraft[
                              field as keyof Pick<
                                WeeklyReflectionDraft,
                                | "wins"
                                | "challenges"
                                | "patterns"
                                | "suggestedAdjustments"
                                | "questionsForUser"
                              >
                            ] as string[],
                          )}
                          onChange={(event) =>
                            updateWeeklyReflectionList(
                              field as keyof Pick<
                                WeeklyReflectionDraft,
                                | "wins"
                                | "challenges"
                                | "patterns"
                                | "suggestedAdjustments"
                                | "questionsForUser"
                              >,
                              event.target.value,
                            )
                          }
                          rows={3}
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
                          placeholder="One per line"
                        />
                      </label>
                    ))}
                  </div>

                  {weeklyReflectionDraft.goalCoverage.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-stone-700">
                        Goal coverage
                      </p>
                      <div className="mt-2 space-y-2">
                        {weeklyReflectionDraft.goalCoverage.map((item) => (
                          <p
                            key={`${item.goalTitle}-${item.observation}`}
                            className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700"
                          >
                            <span className="font-semibold">{item.goalTitle}:</span>{" "}
                            {item.observation}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="text-sm font-medium text-stone-700">
                    Your notes
                    <textarea
                      value={weeklyReviewNotes}
                      onChange={(event) => setWeeklyReviewNotes(event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
                      placeholder="Add anything the assistant missed, or write a manual review."
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        saveWeeklyReflection(
                          weeklyReflectionPreview ? "ollama" : "manual",
                        )
                      }
                      className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Save review
                    </button>
                    {weeklyReflectionPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setWeeklyReflectionPreview(null);
                          setWeeklyReflectionDraft(
                            weeklyReflectionDraftFromReview(selectedWeekReview),
                          );
                        }}
                        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                      >
                        Discard draft
                      </button>
                    )}
                    {weeklyReflectionPreview && (
                      <span className="text-xs text-stone-500">
                        Drafted locally with {weeklyReflectionPreview.model}.
                        Confidence{" "}
                        {Math.round(
                          weeklyReflectionPreview.reflection.confidence * 100,
                        )}
                        %.
                      </span>
                    )}
                  </div>
                </div>
              </section>
              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Weekly time by day</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      Planned time with completed time overlaid.
                    </p>
                  </div>
                  <Pill>{formatMinutes(weeklyStats.totalPlannedMinutes)}</Pill>
                </div>
                <div className="mt-5 flex h-48 items-end gap-3">
                  {weeklyStats.dayRows.map((row) => {
                    const isToday = row.day === today;
                    const maxDayMinutes = Math.max(
                      ...weeklyStats.dayRows.map((day) => day.plannedMinutes),
                      1,
                    );
                    const plannedHeight = Math.max(
                      8,
                      Math.round((row.plannedMinutes / maxDayMinutes) * 150),
                    );
                    const completedHeight = row.plannedMinutes
                      ? Math.round((row.completedMinutes / row.plannedMinutes) * plannedHeight)
                      : 0;

                    return (
                      <div key={row.day} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className={`relative flex h-40 w-full items-end justify-center rounded-lg border ${
                            isToday
                              ? "border-amber-200 bg-amber-50/70"
                              : "border-transparent bg-stone-50"
                          }`}
                        >
                          <div
                            className={`w-7 rounded-t-md ${
                              isToday ? "bg-amber-300" : "bg-stone-300"
                            }`}
                            style={{ height: plannedHeight }}
                          />
                          <div
                            className="absolute bottom-0 w-7 rounded-t-md bg-emerald-600"
                            style={{ height: completedHeight }}
                          />
                        </div>
                        <div className="text-center">
                          <p
                            className={`text-xs font-semibold ${
                              isToday ? "text-amber-800" : "text-stone-700"
                            }`}
                          >
                            {row.day}
                            {isToday && (
                              <span className="ml-1 text-[10px] uppercase tracking-[0.1em]">
                                Today
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {formatMinutes(row.plannedMinutes)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold">Life Area time breakdown</h2>
                <div className="mt-4 space-y-3">
                  {weeklyStats.lifeAreaRows.map((row) => {
                    const width = weeklyStats.totalPlannedMinutes
                      ? Math.round((row.plannedMinutes / weeklyStats.totalPlannedMinutes) * 100)
                      : 0;
                    const completedWidth = row.plannedMinutes
                      ? Math.round((row.completedMinutes / row.plannedMinutes) * 100)
                      : 0;

                    return (
                      <article key={row.id} className="rounded-lg bg-stone-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{row.title}</h3>
                            <p className="mt-1 text-sm text-stone-600">
                              {row.plannedCount} planned, {row.completedCount} done
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-stone-800">
                            {formatMinutes(row.plannedMinutes)}
                          </p>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-stone-200">
                          <div
                            className="h-2 rounded-full bg-stone-700"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-stone-200">
                          <div
                            className="h-1.5 rounded-full bg-emerald-600"
                            style={{ width: `${completedWidth}%` }}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold">Goal contribution</h2>
                <div className="mt-4 space-y-3">
                  {weeklyStats.goalRows.map((row) => {
                    const progress = row.plannedMinutes
                      ? Math.round((row.completedMinutes / row.plannedMinutes) * 100)
                      : 0;

                    return (
                      <article key={row.id} className="rounded-lg bg-stone-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold">{row.title}</h3>
                            <p className="mt-1 text-sm text-stone-600">
                              {row.plannedCount} planned, {row.completedCount} done
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-stone-800">
                            {formatMinutes(row.completedMinutes)} /{" "}
                            {formatMinutes(row.plannedMinutes)}
                          </p>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-stone-200">
                          <div
                            className="h-2 rounded-full bg-emerald-600"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeSection === "builder" && (
          <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Plan Goals</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                Shape life areas, goals, useful templates, and dated goal events.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  ["lifeArea", "Life Areas"],
                  ["goal", "Goals"],
                  ["template", "Activity Templates"],
                ].map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setBuilderKind(kind as BuilderKind);
                      resetDraft(kind as BuilderKind);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      builderKind === kind
                        ? "bg-stone-950 text-white"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold">
                  {editing ? "Edit" : "Create"}{" "}
                  {builderKind === "lifeArea"
                    ? "Life Area"
                    : builderKind === "template"
                      ? "Activity Template"
                      : "Goal"}
                </h2>
                <div className="mt-5 space-y-4">
                  {builderKind === "lifeArea" && (
                    <>
                      <input
                        value={lifeAreaDraft.title}
                        onChange={(event) =>
                          setLifeAreaDraft({ ...lifeAreaDraft, title: event.target.value })
                        }
                        placeholder="Life Area title"
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={lifeAreaDraft.description ?? ""}
                        onChange={(event) =>
                          setLifeAreaDraft({
                            ...lifeAreaDraft,
                            description: event.target.value,
                          })
                        }
                        placeholder="Description"
                        rows={3}
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <input
                        value={lifeAreaDraft.icon ?? ""}
                        onChange={(event) =>
                          setLifeAreaDraft({ ...lifeAreaDraft, icon: event.target.value })
                        }
                        placeholder="Optional short icon"
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={saveLifeArea}
                        className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save Life Area
                      </button>
                    </>
                  )}

                  {builderKind === "goal" && (
                    <>
                      <input
                        value={goalDraft.title}
                        onChange={(event) =>
                          setGoalDraft({ ...goalDraft, title: event.target.value })
                        }
                        placeholder="Goal title"
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={goalDraft.description ?? ""}
                        onChange={(event) =>
                          setGoalDraft({ ...goalDraft, description: event.target.value })
                        }
                        placeholder="Description"
                        rows={3}
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <MultiSelect
                        label="Linked Life Areas"
                        options={lifeAreas}
                        values={goalDraft.lifeAreaIds}
                        onChange={(lifeAreaIds) =>
                          setGoalDraft({ ...goalDraft, lifeAreaIds })
                        }
                      />
                      <label className="block text-sm font-medium text-stone-700">
                        Status
                        <select
                          value={goalDraft.status ?? "active"}
                          onChange={(event) =>
                            setGoalDraft({
                              ...goalDraft,
                              status: event.target.value as GoalStatus,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm capitalize"
                        >
                          {goalStatuses.map((status) => (
                            <option key={status} value={status}>
                              {goalStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={saveGoal}
                        className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save Goal
                      </button>
                    </>
                  )}

                  {builderKind === "template" && (
                    <>
                      <input
                        value={templateDraft.title}
                        onChange={(event) =>
                          setTemplateDraft({ ...templateDraft, title: event.target.value })
                        }
                        placeholder="Activity Template title"
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={templateDraft.description ?? ""}
                        onChange={(event) =>
                          setTemplateDraft({
                            ...templateDraft,
                            description: event.target.value,
                          })
                        }
                        placeholder="Description"
                        rows={3}
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={templateDraft.defaultDuration ?? ""}
                          onChange={(event) =>
                            setTemplateDraft({
                              ...templateDraft,
                              defaultDuration: event.target.value,
                            })
                          }
                          placeholder="Default duration"
                          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                        />
                        <input
                          value={templateDraft.defaultIcon ?? ""}
                          onChange={(event) =>
                            setTemplateDraft({
                              ...templateDraft,
                              defaultIcon: event.target.value,
                            })
                          }
                          placeholder="Default icon"
                          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                        />
                      </div>
                      <input
                        value={templateDraft.defaultNotes ?? ""}
                        onChange={(event) =>
                          setTemplateDraft({
                            ...templateDraft,
                            defaultNotes: event.target.value,
                          })
                        }
                        placeholder="Default notes"
                        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <MultiSelect
                        label="Linked Goals"
                        options={goals}
                        values={templateDraft.goalIds}
                        onChange={(goalIds) => setTemplateDraft({ ...templateDraft, goalIds })}
                      />
                      <button
                        type="button"
                        onClick={saveTemplate}
                        className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save Activity Template
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold">Current items</h2>
                {builderKind === "goal" && (
                  <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {editingLifeEventId ? "Edit linked event" : "Add an event for a goal"}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          Add dated anchors like races, exams, launches, holidays, or milestones.
                        </p>
                      </div>
                      {editingLifeEventId && (
                        <button
                          type="button"
                          onClick={resetLifeEventDraft}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <div className="mt-4 space-y-3">
                      <input
                        value={lifeEventDraft.title}
                        onChange={(event) =>
                          setLifeEventDraft({ ...lifeEventDraft, title: event.target.value })
                        }
                        placeholder="Event title"
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="date"
                          value={lifeEventDraft.date}
                          onChange={(event) =>
                            setLifeEventDraft({ ...lifeEventDraft, date: event.target.value })
                          }
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={lifeEventDraft.endDate ?? ""}
                          onChange={(event) =>
                            setLifeEventDraft({
                              ...lifeEventDraft,
                              endDate: event.target.value,
                            })
                          }
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          value={lifeEventDraft.type}
                          onChange={(event) =>
                            setLifeEventDraft({
                              ...lifeEventDraft,
                              type: event.target.value as LifeEventType,
                            })
                          }
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm capitalize"
                        >
                          {lifeEventTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <select
                          value={lifeEventDraft.status}
                          onChange={(event) =>
                            setLifeEventDraft({
                              ...lifeEventDraft,
                              status: event.target.value as LifeEventStatus,
                            })
                          }
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm capitalize"
                        >
                          {lifeEventStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <MultiSelect
                        label="Linked Goals"
                        options={goals}
                        values={lifeEventDraft.goalIds}
                        onChange={(goalIds) =>
                          setLifeEventDraft({ ...lifeEventDraft, goalIds })
                        }
                      />
                      <MultiSelect
                        label="Linked Life Areas"
                        options={lifeAreas}
                        values={lifeEventDraft.lifeAreaIds}
                        onChange={(lifeAreaIds) =>
                          setLifeEventDraft({ ...lifeEventDraft, lifeAreaIds })
                        }
                      />
                      <textarea
                        value={lifeEventDraft.notes ?? ""}
                        onChange={(event) =>
                          setLifeEventDraft({ ...lifeEventDraft, notes: event.target.value })
                        }
                        placeholder="Notes or details"
                        rows={2}
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={saveLifeEvent}
                        className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save Event
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {builderKind === "lifeArea" &&
                    lifeAreas.map((area) => (
                      <article key={area.id} className="rounded-lg bg-stone-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{area.title}</h3>
                            <p className="mt-1 text-sm text-stone-600">{area.description}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => editEntity("lifeArea", area.id)}
                              className="rounded-full bg-white px-2 py-1 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteLifeArea(area.id)}
                              className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  {builderKind === "goal" &&
                    goals.map((goal) => {
                      const linkedEvents = lifeEvents
                        .filter((event) => event.goalIds.includes(goal.id))
                        .sort((a, b) => a.date.localeCompare(b.date));
                      const linkedHistory = goalHistoryEvents
                        .filter((event) => event.goalId === goal.id)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 3);

                      return (
                      <article key={goal.id} className="rounded-lg bg-stone-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{goal.title}</h3>
                              <span
                                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${goalStatusTone(
                                  goal.status,
                                )}`}
                              >
                                {goalStatusLabel(goal.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-stone-600">{goal.description}</p>
                            <p className="mt-2 text-xs text-stone-500">
                              Life Areas:{" "}
                              {lifeAreas
                                .filter((area) => goal.lifeAreaIds.includes(area.id))
                                .map((area) => area.title)
                                .join(", ") || "None"}
                            </p>
                            <div className="mt-3 rounded-lg bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                  Linked events
                                </p>
                                <button
                                  type="button"
                                  onClick={() => startLifeEventForGoal(goal)}
                                  className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700"
                                >
                                  Add event
                                </button>
                              </div>
                              <div className="mt-2 space-y-2">
                                {linkedEvents.length === 0 && (
                                  <p className="text-sm text-stone-500">
                                    No events linked to this goal yet.
                                  </p>
                                )}
                                {linkedEvents.slice(0, 4).map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex flex-col gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold">{event.title}</p>
                                      <p className="text-xs text-stone-500">
                                        {event.date}
                                        {event.endDate ? ` to ${event.endDate}` : ""} ·{" "}
                                        {formatDaysUntil(event.date)} · {event.type}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => editLifeEvent(event.id)}
                                        className="rounded-full bg-white px-2 py-1 text-xs text-stone-700"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteLifeEvent(event.id)}
                                        className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3 rounded-lg bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                Recent history
                              </p>
                              <div className="mt-2 space-y-2">
                                {linkedHistory.length === 0 && (
                                  <p className="text-sm text-stone-500">
                                    No history yet.
                                  </p>
                                )}
                                {linkedHistory.map((event) => (
                                  <div key={event.id} className="text-sm text-stone-700">
                                    <span className="font-semibold">
                                      {goalHistoryLabel(event.type)}
                                    </span>{" "}
                                    <span className="text-xs text-stone-500">
                                      {event.date}
                                    </span>
                                    {event.note && (
                                      <p className="mt-1 text-xs leading-5 text-stone-500">
                                        {event.note}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {goalStatuses.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => updateGoalStatus(goal.id, status)}
                                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                    (goal.status ?? "active") === status
                                      ? goalStatusTone(status)
                                      : "border-stone-200 bg-white text-stone-600"
                                  }`}
                                >
                                  {goalStatusLabel(status)}
                                </button>
                              ))}
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                              <input
                                value={reflectionDrafts[goal.id] ?? ""}
                                onChange={(event) =>
                                  setReflectionDrafts((current) => ({
                                    ...current,
                                    [goal.id]: event.target.value,
                                  }))
                                }
                                placeholder="Add a reflection note"
                                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => addGoalReflection(goal.id)}
                                className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white"
                              >
                                Add reflection
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => editEntity("goal", goal.id)}
                              className="rounded-full bg-white px-2 py-1 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteGoal(goal.id)}
                              className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                      );
                    })}
                  {builderKind === "template" &&
                    templates.filter((template) => !isAdHocTemplate(template)).map((template) => {
                      const context = getTemplateContext(template);
                      return (
                        <article key={template.id} className="rounded-lg bg-stone-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">{template.title}</h3>
                              <p className="mt-1 text-sm text-stone-600">
                                {template.description}
                              </p>
                              <p className="mt-2 text-xs text-stone-500">
                                Goals:{" "}
                                {context.goals.map((goal) => goal.title).join(", ") ||
                                  "None"}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => editEntity("template", template.id)}
                                className="rounded-full bg-white px-2 py-1 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeSection === "map" && (
          <section className="min-h-[calc(100vh-160px)]">
            <div
              ref={mapViewportRef}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={handleMapPointerEnd}
              onPointerCancel={handleMapPointerEnd}
              onWheel={handleMapWheel}
              className="relative min-h-[calc(100vh-180px)] cursor-grab overflow-hidden rounded-lg border border-stone-800 bg-stone-950 shadow-sm active:cursor-grabbing"
            >
              <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-stone-900/85 p-2 text-white shadow-lg backdrop-blur">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => zoomMap(0.12)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/15"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomMap(-0.12)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/15"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={resetMapView}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
                  >
                    Reset
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-stone-400">
                  {Math.round(mapView.scale * 100)}% · drag to pan
                </p>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-white/10 bg-stone-900/80 px-3 py-2 text-xs text-stone-300">
                You -&gt; Life Areas -&gt; Goals -&gt; Templates, Events, History
              </div>

              <div
                className="absolute left-1/2 top-1/2 origin-center"
                style={{
                  width: graph.width,
                  height: graph.height,
                  transform: `translate(calc(-50% + ${mapView.x}px), calc(-50% + ${mapView.y}px)) scale(${mapView.scale})`,
                }}
              >
                <svg width={graph.width} height={graph.height} className="absolute inset-0">
                  <defs>
                    <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#f5f5f4" stopOpacity="0.15" />
                      <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.04" />
                      <stop offset="100%" stopColor="#0c0a09" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <rect width={graph.width} height={graph.height} fill="url(#map-glow)" />
                  {graph.rings.map((radius) => (
                    <circle
                      key={radius}
                      cx={graph.center.x}
                      cy={graph.center.y}
                      r={radius}
                      fill="none"
                      stroke="#ffffff"
                      strokeOpacity="0.08"
                      strokeWidth="2"
                    />
                  ))}
                  {graph.edges.map((edge) => {
                    const from = graph.nodeById.get(edge.from);
                    const to = graph.nodeById.get(edge.to);
                    if (!from || !to) return null;
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2;
                    const curveX = (midX + graph.center.x) / 2;
                    const curveY = (midY + graph.center.y) / 2;
                    return (
                      <path
                        key={edge.id}
                        d={`M ${from.x} ${from.y} Q ${curveX} ${curveY} ${to.x} ${to.y}`}
                        fill="none"
                        stroke="#e7e5e4"
                        strokeOpacity="0.22"
                        strokeWidth="2"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0">
                  {graph.nodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isExpanded = isSelected && selectedDetails;
                    const sizeClass =
                      node.type === "You"
                        ? "w-28 -translate-x-14 -translate-y-14 rounded-full px-4 py-5 text-center"
                        : node.compact
                          ? "w-24 -translate-x-12 -translate-y-8 rounded-full px-3 py-2 text-center"
                          : "w-48 -translate-x-24 -translate-y-10 rounded-lg px-3 py-3 text-left";
                    if (isExpanded) {
                      return (
                        <article
                          key={node.id}
                          data-map-interactive="true"
                          className={`absolute z-20 max-h-[560px] w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-white/40 bg-white p-4 text-stone-950 shadow-2xl ring-2 ring-white/30 ${
                            node.type === "You" ? "text-center" : "text-left"
                          }`}
                          style={{ left: node.x, top: node.y }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                                {node.type}
                              </span>
                              {canEditSelectedNode ? (
                                <input
                                  value={selectedDetails.title}
                                  onChange={(event) =>
                                    updateSelectedNode("title", event.target.value)
                                  }
                                  className="mt-3 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-lg font-semibold"
                                />
                              ) : (
                                <h2 className="mt-3 text-lg font-semibold">
                                  {selectedDetails.title}
                                </h2>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedNode(null)}
                              className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
                            >
                              Close
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {selectedNode?.type === "Goal" && selectedGoalForMap && (
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${goalStatusTone(
                                  selectedGoalForMap.status,
                                )}`}
                              >
                                {goalStatusLabel(selectedGoalForMap.status)}
                              </span>
                            )}

                            <label className="block text-sm font-medium text-stone-700">
                              {selectedNode?.type === "Activity Template"
                                ? "Default details"
                                : selectedNode?.type === "Goal History"
                                  ? "Reflection note"
                                  : "Description"}
                              <textarea
                                value={selectedDetails.description}
                                onChange={(event) =>
                                  updateSelectedNode("description", event.target.value)
                                }
                                disabled={!canEditSelectedNode}
                                rows={3}
                                className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm disabled:text-stone-500"
                              />
                            </label>

                            {selectedMapEvent && (
                              <div className="rounded-lg bg-sky-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                                  Event
                                </p>
                                <p className="mt-2 text-sm leading-6 text-sky-950">
                                  {selectedMapEvent.date}
                                  {selectedMapEvent.endDate
                                    ? ` to ${selectedMapEvent.endDate}`
                                    : ""}{" "}
                                  · {selectedMapEvent.type} · {selectedMapEvent.status}
                                </p>
                              </div>
                            )}

                            {selectedMapHistoryEvent && (
                              <div className="rounded-lg bg-violet-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">
                                  History entry
                                </p>
                                <p className="mt-2 text-sm leading-6 text-violet-950">
                                  {goalHistoryLabel(selectedMapHistoryEvent.type)} ·{" "}
                                  {selectedMapHistoryEvent.date}
                                </p>
                              </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg bg-stone-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                  Linked from
                                </p>
                                <p className="mt-2 text-sm leading-6 text-stone-700">
                                  {selectedDetails.parents.join(", ") || "None"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-stone-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                  Links out
                                </p>
                                <p className="mt-2 text-sm leading-6 text-stone-700">
                                  {selectedDetails.children.join(", ") || "None"}
                                </p>
                              </div>
                            </div>

                            {selectedGoalForMap && (
                              <>
                                <div className="rounded-lg bg-stone-50 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                    Linked events
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {selectedGoalMapEvents.length === 0 && (
                                      <p className="text-sm text-stone-500">
                                        No events linked to this goal.
                                      </p>
                                    )}
                                    {selectedGoalMapEvents.slice(0, 3).map((event) => (
                                      <article key={event.id} className="rounded-lg bg-white p-3">
                                        <p className="text-sm font-semibold">{event.title}</p>
                                        <p className="mt-1 text-xs text-stone-500">
                                          {event.date}
                                          {event.endDate ? ` to ${event.endDate}` : ""} ·{" "}
                                          {formatDaysUntil(event.date)}
                                        </p>
                                      </article>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-stone-50 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                                    Goal history
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {selectedGoalMapHistory.length === 0 && (
                                      <p className="text-sm text-stone-500">
                                        No history entries for this goal yet.
                                      </p>
                                    )}
                                    {selectedGoalMapHistory.slice(0, 4).map((event) => (
                                      <article key={event.id} className="rounded-lg bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-sm font-semibold">
                                            {goalHistoryLabel(event.type)}
                                          </p>
                                          <p className="text-xs text-stone-500">{event.date}</p>
                                        </div>
                                        {event.note && (
                                          <p className="mt-2 text-xs leading-5 text-stone-600">
                                            {event.note}
                                          </p>
                                        )}
                                      </article>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}

                            {canDeleteSelectedNode && (
                              <button
                                type="button"
                                onClick={deleteSelectedNode}
                                className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                              >
                                Delete {selectedNode?.type}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    }
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() =>
                          setSelectedNode((current) =>
                            current?.id === node.id ? null : node,
                          )
                        }
                        className={`absolute border shadow-lg transition hover:scale-105 ${
                          isSelected
                            ? "border-white ring-2 ring-white/70"
                            : "border-white/20"
                        } ${sizeClass} ${nodeBg(node.type)}`}
                        style={{ left: node.x, top: node.y }}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
                          {node.type}
                        </span>
                        <span
                          className={`mt-1 block font-semibold ${
                            node.compact ? "text-xs leading-4" : "text-sm leading-5"
                          }`}
                        >
                          {node.title}
                        </span>
                        {node.subtitle && !node.compact && (
                          <span className="mt-1 block truncate text-[11px] opacity-70">
                            {node.subtitle}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "planning" && (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveDrag(null);
              setDropPreview(null);
            }}
          >
            <section className="grid min-h-[calc(100vh-180px)] gap-3 lg:grid-cols-[260px_minmax(980px,1fr)]">
              <aside className="flex min-h-0 flex-col gap-3 rounded-lg border border-stone-200 bg-white/90 p-3 shadow-sm">
                <div>
                  <div>
                    <h2 className="text-lg font-semibold">Weekly Planner</h2>
                    <p className="mt-1 text-sm leading-5 text-stone-600">
                      Pick a Life Area, then drag templates onto the canvas.
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                    <button
                      type="button"
                      onClick={() => setSelectedPlannerLifeAreaId("all")}
                      className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                        selectedPlannerLifeAreaId === "all"
                          ? "bg-stone-950 text-white"
                          : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      All Life Areas
                    </button>
                    {lifeAreas.map((area) => (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setSelectedPlannerLifeAreaId(area.id)}
                        className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                          selectedPlannerLifeAreaId === area.id
                            ? "bg-stone-950 text-white"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {area.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 rounded-lg border border-stone-200 bg-white p-3">
                  <h2 className="text-sm font-semibold">Activity Library</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {selectedPlannerLifeArea
                      ? `Templates supporting ${selectedPlannerLifeArea.title}.`
                      : "Drag reusable Activity Templates into the week."}
                  </p>
                  <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                    {plannerTemplates.length === 0 && (
                      <div className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-500">
                        No Activity Templates support this Life Area yet.
                      </div>
                    )}
                    {plannerTemplates.map((template) => {
                      return (
                        <LibraryTemplateCard
                          key={template.id}
                          template={template}
                          onOpen={() => setSelectedTemplateId(template.id)}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Planned", `${plannerStats.plannedCount}`],
                    ["Done", `${plannerStats.completedCount}`],
                    ["Plan time", formatMinutes(plannerStats.plannedMinutes)],
                    ["Done time", formatMinutes(plannerStats.completedMinutes)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-stone-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                        {label}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-stone-800">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-stone-50 p-3">
                  <div className="h-2 flex-1 rounded-full bg-stone-200">
                    <div
                      className="h-2 rounded-full bg-emerald-600"
                      style={{ width: `${plannerStats.completionRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-stone-600">
                    {plannerStats.completionRate}% complete
                  </span>
                </div>
              </aside>

              <div className="min-w-0 rounded-xl border border-stone-200 bg-white/60 p-3 shadow-sm">
                <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Week board</h2>
                    <p className="text-sm text-stone-600">
                      {selectedPlannerLifeArea
                        ? `Showing only Planned Activities linked to ${selectedPlannerLifeArea.title}.`
                        : "All Life Areas visible. Card stripes show the primary Life Area."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill>{plannerStats.title}</Pill>
                    <Pill>Monday-Sunday</Pill>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg bg-stone-100/60 p-2 pb-3">
                  <div className="grid min-h-[calc(100vh-270px)] min-w-[1180px] grid-cols-7 gap-2 xl:min-w-0">
                    {days.map((day) => (
                      <DayColumn
                        key={day}
                        day={day}
                        plannedActivities={visiblePlannedByDay[day]}
                        lifeEvents={visibleLifeEventsByDay[day]}
                        templates={templates}
                        preview={dropPreview}
                        onOpen={openPlannedActivity}
                        onCreate={openBoardCreate}
                        getTemplateLifeAreaAccent={getTemplateLifeAreaAccent}
                        isToday={day === today}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <DragOverlay>
              {activeDrag?.type === "template" && (
                <div className="w-56 rotate-1 cursor-grabbing opacity-95 shadow-xl">
                  <TemplateCard
                    template={activeDrag.template}
                    compact
                  />
                </div>
              )}
              {activeDrag?.type === "planned" &&
                (() => {
                  const template = templates.find(
                    (item) => item.id === activeDrag.plannedActivity.templateId,
                  );
                  if (!template) return null;
                  return (
                    <div className="w-56 rotate-1 cursor-grabbing opacity-95 shadow-xl">
                      <TemplateCard
                        template={template}
                        compact
                      />
                    </div>
                  );
                })()}
            </DragOverlay>
          </DndContext>
        )}

        {boardCreateDraft && (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/20 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Weekly Planner
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Add to {boardCreateDraft.day}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Create a weekly activity or add a dated life event.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBoardCreateDraft(null)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-5 inline-flex rounded-full bg-stone-100 p-1">
                {(["activity", "event"] as BoardCreateMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setBoardCreateDraft((current) =>
                        current
                          ? {
                              ...current,
                              mode,
                              eventLifeAreaIds:
                                mode === "event" &&
                                current.eventLifeAreaIds.length === 0 &&
                                current.lifeAreaId
                                  ? [current.lifeAreaId]
                                  : current.eventLifeAreaIds,
                              eventGoalIds:
                                mode === "event" &&
                                current.eventGoalIds.length === 0 &&
                                current.goalId
                                  ? [current.goalId]
                                  : current.eventGoalIds,
                            }
                          : current,
                      )
                    }
                    className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                      boardCreateDraft.mode === mode
                        ? "bg-stone-950 text-white"
                        : "text-stone-600"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-4">
                <input
                  value={boardCreateDraft.title}
                  onChange={(event) =>
                    setBoardCreateDraft({
                      ...boardCreateDraft,
                      title: event.target.value,
                    })
                  }
                  placeholder={
                    boardCreateDraft.mode === "activity"
                      ? "Activity title"
                      : "Event title"
                  }
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />

                {boardCreateDraft.mode === "activity" ? (
                  <>
                    <input
                      value={boardCreateDraft.duration}
                      onChange={(event) =>
                        setBoardCreateDraft({
                          ...boardCreateDraft,
                          duration: event.target.value,
                        })
                      }
                      placeholder="Optional duration, e.g. 45 min"
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-stone-700">
                        Linked Life Area
                        <select
                          value={boardCreateDraft.lifeAreaId}
                          onChange={(event) =>
                            setBoardCreateDraft({
                              ...boardCreateDraft,
                              lifeAreaId: event.target.value,
                              goalId: goals
                                .find((goal) => goal.id === boardCreateDraft.goalId)
                                ?.lifeAreaIds.includes(event.target.value)
                                ? boardCreateDraft.goalId
                                : "",
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                        >
                          <option value="">Uncategorised</option>
                          {lifeAreas.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-stone-700">
                        Linked Goal
                        <select
                          value={boardCreateDraft.goalId}
                          onChange={(event) => {
                            const goal = goals.find(
                              (item) => item.id === event.target.value,
                            );
                            setBoardCreateDraft({
                              ...boardCreateDraft,
                              goalId: event.target.value,
                              lifeAreaId:
                                boardCreateDraft.lifeAreaId ||
                                goal?.lifeAreaIds[0] ||
                                "",
                            });
                          }}
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                        >
                          <option value="">No linked Goal</option>
                          {goals
                            .filter(
                              (goal) =>
                                !boardCreateDraft.lifeAreaId ||
                                goal.lifeAreaIds.includes(boardCreateDraft.lifeAreaId),
                            )
                            .map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                {goal.title}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-stone-700">
                        Date
                        <input
                          type="date"
                          value={boardCreateDraft.eventDate}
                          onChange={(event) =>
                            setBoardCreateDraft({
                              ...boardCreateDraft,
                              eventDate: event.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm font-medium text-stone-700">
                        Optional end date
                        <input
                          type="date"
                          value={boardCreateDraft.eventEndDate}
                          onChange={(event) =>
                            setBoardCreateDraft({
                              ...boardCreateDraft,
                              eventEndDate: event.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-stone-700">
                        Type
                        <select
                          value={boardCreateDraft.eventType}
                          onChange={(event) =>
                            setBoardCreateDraft({
                              ...boardCreateDraft,
                              eventType: event.target.value as LifeEventType,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm capitalize"
                        >
                          {lifeEventTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-stone-700">
                        Status
                        <select
                          value={boardCreateDraft.eventStatus}
                          onChange={(event) =>
                            setBoardCreateDraft({
                              ...boardCreateDraft,
                              eventStatus: event.target.value as LifeEventStatus,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm capitalize"
                        >
                          {lifeEventStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <MultiSelect
                      label="Linked Life Areas"
                      options={lifeAreas}
                      values={boardCreateDraft.eventLifeAreaIds}
                      onChange={(lifeAreaIds) =>
                        setBoardCreateDraft({
                          ...boardCreateDraft,
                          eventLifeAreaIds: lifeAreaIds,
                        })
                      }
                    />
                    <MultiSelect
                      label="Linked Goals"
                      options={goals}
                      values={boardCreateDraft.eventGoalIds}
                      onChange={(goalIds) =>
                        setBoardCreateDraft({
                          ...boardCreateDraft,
                          eventGoalIds: goalIds,
                        })
                      }
                    />
                  </>
                )}

                <textarea
                  value={boardCreateDraft.details}
                  onChange={(event) =>
                    setBoardCreateDraft({
                      ...boardCreateDraft,
                      details: event.target.value,
                    })
                  }
                  placeholder="Optional details"
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <textarea
                  value={boardCreateDraft.notes}
                  onChange={(event) =>
                    setBoardCreateDraft({
                      ...boardCreateDraft,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Optional notes"
                  rows={2}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveBoardCreate}
                    className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Save {boardCreateDraft.mode === "activity" ? "Activity" : "Event"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardCreateDraft(null)}
                    className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTemplate && (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/20 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Activity Template
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">{selectedTemplate.title}</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Editing this changes the reusable template for future planning.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId(null)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium"
                >
                  Close
                </button>
              </div>
              <div className="mt-5 space-y-3">
                <input
                  value={selectedTemplate.title}
                  onChange={(event) =>
                    updateTemplate(selectedTemplate.id, { title: event.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <textarea
                  value={selectedTemplate.description ?? ""}
                  onChange={(event) =>
                    updateTemplate(selectedTemplate.id, {
                      description: event.target.value,
                    })
                  }
                  placeholder="Description"
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={selectedTemplate.defaultDuration ?? ""}
                    onChange={(event) =>
                      updateTemplate(selectedTemplate.id, {
                        defaultDuration: event.target.value,
                      })
                    }
                    placeholder="Default duration"
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                  />
                  <input
                    value={selectedTemplate.defaultIcon ?? ""}
                    onChange={(event) =>
                      updateTemplate(selectedTemplate.id, {
                        defaultIcon: event.target.value,
                      })
                    }
                    placeholder="Icon"
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  value={selectedTemplate.defaultNotes ?? ""}
                  onChange={(event) =>
                    updateTemplate(selectedTemplate.id, {
                      defaultNotes: event.target.value,
                    })
                  }
                  placeholder="Default notes"
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <div className="grid gap-3 rounded-lg bg-stone-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Linked goals
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      {getTemplateContext(selectedTemplate)
                        .goals.map((goal) => goal.title)
                        .join(", ") || "Unlinked"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Linked Life Areas
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      {getTemplateContext(selectedTemplate)
                        .lifeAreas.map((area) => area.title)
                        .join(", ") || "Unlinked"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deleteTemplate(selectedTemplate.id);
                    setSelectedTemplateId(null);
                  }}
                  className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete Activity Template
                </button>
              </div>
            </div>
          </div>
        )}

        {editingPlanned &&
          (() => {
            const template = templates.find(
              (item) => item.id === editingPlanned.templateId,
            );
            if (!template) return null;
            const context = getTemplateContext(template);

            const tone = statusTone(editingPlanned.status);

            return (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/20 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Planned Activity
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {editingPlanned.titleOverride || template.title}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    These changes affect this week only, not the reusable template.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlanned(null);
                    setActivityExtractionPreview(null);
                    setActivityExtractionError(null);
                    setIsExtractingActivity(false);
                  }}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium"
                >
                  Close
                </button>
              </div>
              <div className="mt-5 space-y-3">
                <div className={`rounded-lg border p-4 ${tone.card}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-800">
                      Template: {template.title}
                    </p>
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone.chip}`}>
                      {statusLabel(editingPlanned.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    {template.description || "No template description."}
                  </p>
                </div>
                <input
                  value={editingPlanned.titleOverride ?? ""}
                  onChange={(event) =>
                    updatePlanned(editingPlanned.id, {
                      titleOverride: event.target.value,
                    })
                  }
                  placeholder="Optional title override"
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={editingPlanned.day}
                    onChange={(event) =>
                      updatePlanned(editingPlanned.id, {
                        day: event.target.value as DayKey,
                      })
                    }
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                  >
                    {days.map((day) => (
                      <option key={day}>{day}</option>
                    ))}
                  </select>
                  <input
                    value={editingPlanned.duration ?? ""}
                    onChange={(event) =>
                      updatePlanned(editingPlanned.id, { duration: event.target.value })
                    }
                    placeholder="Duration"
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                  />
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Status
                  </p>
                  <StatusPicker
                    status={editingPlanned.status}
                    onChange={(status) => updatePlanned(editingPlanned.id, { status })}
                  />
                </div>
                <input
                  value={editingPlanned.details ?? ""}
                  onChange={(event) =>
                    updatePlanned(editingPlanned.id, { details: event.target.value })
                  }
                  placeholder="Details, route, book, chapter, intensity..."
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <textarea
                  value={editingPlanned.notes ?? ""}
                  onChange={(event) =>
                    updatePlanned(editingPlanned.id, { notes: event.target.value })
                  }
                  placeholder="Notes"
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                />
                <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Local extraction
                      </p>
                      <p className="mt-1 text-sm leading-6 text-stone-600">
                        Paste a raw activity log, then optionally ask local Ollama to extract metadata.
                      </p>
                    </div>
                    {editingPlanned.extraction && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-600">
                        {editingPlanned.extraction.method} · {editingPlanned.extraction.model}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={editingPlanned.rawLog ?? ""}
                    onChange={(event) =>
                      updatePlanned(editingPlanned.id, { rawLog: event.target.value })
                    }
                    placeholder="Raw activity log, e.g. what happened, distance, reps, people, places, notes..."
                    rows={5}
                    className="mt-3 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void extractActivityDetailsLocally()}
                      disabled={isExtractingActivity}
                      className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                    >
                      {isExtractingActivity ? "Extracting..." : "Extract details locally"}
                    </button>
                    {editingPlanned.metadata && (
                      <span className="text-xs text-stone-500">
                        Accepted metadata saved.
                      </span>
                    )}
                  </div>
                  {activityExtractionError && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {activityExtractionError}
                    </p>
                  )}
                  {activityExtractionPreview && (
                    <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">
                            Extraction preview
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {activityExtractionPreview.extraction.method} ·{" "}
                            {activityExtractionPreview.extraction.model} · confidence{" "}
                            {Math.round(activityExtractionPreview.metadata.confidence * 100)}%
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={acceptActivityExtraction}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Accept metadata
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivityExtractionPreview(null)}
                            className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-700"
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-stone-700">
                        <p>
                          <span className="font-semibold">Kind:</span>{" "}
                          {activityExtractionPreview.metadata.activityKind}
                        </p>
                        <p>
                          <span className="font-semibold">Summary:</span>{" "}
                          {activityExtractionPreview.metadata.summary || "None"}
                        </p>
                        <p>
                          <span className="font-semibold">Duration:</span>{" "}
                          {activityExtractionPreview.metadata.durationMinutes ?? "Unknown"}{" "}
                          {activityExtractionPreview.metadata.durationMinutes != null
                            ? "min"
                            : ""}
                        </p>
                        {activityExtractionPreview.metadata.quantities.length > 0 && (
                          <p>
                            <span className="font-semibold">Quantities:</span>{" "}
                            {activityExtractionPreview.metadata.quantities
                              .map((quantity) =>
                                `${quantity.label}: ${quantity.value}${
                                  quantity.unit ? ` ${quantity.unit}` : ""
                                }${quantity.context ? ` (${quantity.context})` : ""}`,
                              )
                              .join(", ")}
                          </p>
                        )}
                        {activityExtractionPreview.metadata.structuredItems.length > 0 && (
                          <div>
                            <p className="font-semibold">Structured items</p>
                            <div className="mt-2 space-y-2">
                              {activityExtractionPreview.metadata.structuredItems.map(
                                (item, index) => (
                                  <article
                                    key={`${item.type}-${item.name}-${index}`}
                                    className="rounded-lg bg-stone-50 p-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-stone-600">
                                        {item.type}
                                      </span>
                                      <span className="font-semibold">{item.name}</span>
                                    </div>
                                    {Object.keys(item.attributes).length > 0 && (
                                      <p className="mt-2 text-xs leading-5 text-stone-600">
                                        {Object.entries(item.attributes)
                                          .map(([key, value]) =>
                                            `${key}: ${
                                              Array.isArray(value)
                                                ? value.join(", ")
                                                : String(value)
                                            }`,
                                          )
                                          .join(" · ")}
                                      </p>
                                    )}
                                  </article>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                        {activityExtractionPreview.metadata.tags.length > 0 && (
                          <p>
                            <span className="font-semibold">Tags:</span>{" "}
                            {activityExtractionPreview.metadata.tags.join(", ")}
                          </p>
                        )}
                        {activityExtractionPreview.metadata.people.length > 0 && (
                          <p>
                            <span className="font-semibold">People:</span>{" "}
                            {activityExtractionPreview.metadata.people.join(", ")}
                          </p>
                        )}
                        {activityExtractionPreview.metadata.places.length > 0 && (
                          <p>
                            <span className="font-semibold">Places:</span>{" "}
                            {activityExtractionPreview.metadata.places.join(", ")}
                          </p>
                        )}
                        {activityExtractionPreview.metadata.datesOrTimes.length > 0 && (
                          <p>
                            <span className="font-semibold">Dates/times:</span>{" "}
                            {activityExtractionPreview.metadata.datesOrTimes.join(", ")}
                          </p>
                        )}
                        {activityExtractionPreview.metadata.notes && (
                          <p>
                            <span className="font-semibold">Notes:</span>{" "}
                            {activityExtractionPreview.metadata.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </section>
                <div className="grid gap-3 rounded-lg bg-stone-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Linked goals
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      {context.goals.map((goal) => goal.title).join(", ") ||
                        "Unlinked"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Linked Life Areas
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      {context.lifeAreas.map((area) => area.title).join(", ") ||
                        "Unlinked"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePlannedActivity(editingPlanned.id)}
                  className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete Planned Activity
                </button>
              </div>
            </div>
          </div>
            );
          })()}

        {activeSection === "checkin" && (
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Daily check-in</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Review the Planned Activities for the selected day.
              </p>
              <div className="mt-5 grid grid-cols-4 gap-2 lg:grid-cols-1">
                {days.map((day) => {
                  const isSelected = checkInDay === day;
                  const isToday = today === day;

                  return (
                    <button
                      key={day}
                      onClick={() => setCheckInDay(day)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                        isSelected
                          ? "border-stone-950 bg-stone-950 text-white"
                          : isToday
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : "border-transparent bg-stone-100 text-stone-700"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>{day}</span>
                        {isToday && (
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              isSelected ? "text-amber-100" : "text-amber-700"
                            }`}
                          >
                            Today
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="space-y-3">
              {plannedByDay[checkInDay].length === 0 && (
                <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600 shadow-sm">
                  No Planned Activities for {checkInDay}. Add one from the weekly planner.
                </div>
              )}
              {plannedByDay[checkInDay].map((planned) => {
                const template = templates.find((item) => item.id === planned.templateId);
                if (!template) return null;
                const context = getTemplateContext(template);
                const tone = statusTone(planned.status);

                return (
                  <article
                    key={planned.id}
                    className={`rounded-lg border p-5 shadow-sm transition ${tone.card}`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {planned.titleOverride || template.title}
                          </h3>
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone.chip}`}>
                            {statusLabel(planned.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          Template: {template.title}
                        </p>
                      </div>
                      <StatusPicker
                        status={planned.status}
                        onChange={(status) => updatePlanned(planned.id, { status })}
                      />
                    </div>
                    <div className="mt-4 grid gap-3 rounded-lg bg-white/55 p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          Goals
                        </p>
                        <p className="mt-1 text-sm font-medium text-stone-800">
                          {context.goals.map((goal) => goal.title).join(", ") || "Unlinked"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          Life Areas
                        </p>
                        <p className="mt-1 text-sm font-medium text-stone-800">
                          {context.lifeAreas.map((area) => area.title).join(", ") ||
                            "Unlinked"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input
                        value={planned.duration ?? ""}
                        onChange={(event) =>
                          updatePlanned(planned.id, { duration: event.target.value })
                        }
                        placeholder="Duration"
                        className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                      <input
                        value={planned.details ?? ""}
                        onChange={(event) =>
                          updatePlanned(planned.id, { details: event.target.value })
                        }
                        placeholder="Details"
                        className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      value={planned.notes ?? ""}
                      onChange={(event) =>
                        updatePlanned(planned.id, { notes: event.target.value })
                      }
                      placeholder="Notes"
                      rows={3}
                      className="mt-3 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                    />
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
