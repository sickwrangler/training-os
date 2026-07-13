import type {
  ActivityTemplate,
  DayKey,
  Goal,
  GoalHistoryEvent,
  LifeEvent,
  LifeArea,
  PlannedActivity,
  PlannedActivitySeed,
  TestPersona,
  Week,
  WeeklyReview,
} from "@/app/data/testPersonas";
import { lifeosDb } from "@/app/db/lifeosDb";

export type LifeOSData = {
  weeks: Week[];
  lifeAreas: LifeArea[];
  goals: Goal[];
  activityTemplates: ActivityTemplate[];
  plannedActivities: PlannedActivity[];
  lifeEvents: LifeEvent[];
  goalHistoryEvents: GoalHistoryEvent[];
  weeklyReviews: WeeklyReview[];
};

export type LifeOSExport = {
  schemaVersion: 1;
  exportedAt: string;
  data: LifeOSData;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayProperty(
  value: Record<string, unknown>,
  key: keyof LifeOSData,
) {
  return Array.isArray(value[key]);
}

export function validateLifeOSExport(value: unknown): LifeOSExport {
  if (!isObject(value)) {
    throw new Error("Import file must be a JSON object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("Unsupported LifeOS export schema version.");
  }
  if (typeof value.exportedAt !== "string") {
    throw new Error("Import file is missing exportedAt.");
  }
  if (!isObject(value.data)) {
    throw new Error("Import file is missing data.");
  }

  const data = value.data;
  const requiredArrays: (keyof LifeOSData)[] = [
    "weeks",
    "lifeAreas",
    "goals",
    "activityTemplates",
    "plannedActivities",
  ];

  requiredArrays.forEach((key) => {
    if (!isArrayProperty(data, key)) {
      throw new Error(`Import file is missing ${key}.`);
    }
  });
  if (!Array.isArray(data.lifeEvents)) {
    data.lifeEvents = [];
  }
  if (!Array.isArray(data.goalHistoryEvents)) {
    data.goalHistoryEvents = [];
  }
  if (!Array.isArray(data.weeklyReviews)) {
    data.weeklyReviews = [];
  }

  return value as LifeOSExport;
}

function withWeekAndOrder(
  plannedActivities: PlannedActivitySeed[],
  weekId: string,
): PlannedActivity[] {
  const orderByDay = new Map<string, number>();

  return plannedActivities.map((planned) => {
    const nextOrder = orderByDay.get(planned.day) ?? 0;
    orderByDay.set(planned.day, nextOrder + 1);

    return {
      ...planned,
      weekId: planned.weekId ?? weekId,
      sortOrder: planned.sortOrder ?? nextOrder,
    };
  });
}

function normalizeDay(day: string): DayKey {
  const legacyDays: Record<string, DayKey> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };

  return legacyDays[day] ?? (day as DayKey);
}

function normalizePlannedActivities(
  plannedActivities: PlannedActivity[],
  currentWeekId: string,
) {
  const orderByDay = new Map<string, number>();

  return plannedActivities.map((planned) => {
    const day = normalizeDay(planned.day);
    const nextOrder = orderByDay.get(`${planned.weekId ?? currentWeekId}-${day}`) ?? 0;
    orderByDay.set(`${planned.weekId ?? currentWeekId}-${day}`, nextOrder + 1);

    return {
      ...planned,
      weekId: planned.weekId ?? currentWeekId,
      day,
      sortOrder: planned.sortOrder ?? nextOrder,
    };
  });
}

function demoDataForWeek(persona: TestPersona, week: Week): LifeOSData {
  return {
    weeks: [week],
    lifeAreas: persona.lifeAreas,
    goals: persona.goals,
    activityTemplates: persona.activityTemplates,
    plannedActivities: withWeekAndOrder(persona.plannedActivities, week.id),
    lifeEvents: persona.lifeEvents ?? [],
    goalHistoryEvents: persona.goalHistoryEvents ?? [],
    weeklyReviews: persona.weeklyReviews ?? [],
  };
}

export async function loadLifeOSData(
  defaultPersona: TestPersona,
  currentWeek: Week,
): Promise<LifeOSData> {
  const [
    weeks,
    lifeAreas,
    goals,
    activityTemplates,
    plannedActivities,
    lifeEvents,
    goalHistoryEvents,
    weeklyReviews,
  ] = await Promise.all([
    lifeosDb.weeks.toArray(),
    lifeosDb.lifeAreas.toArray(),
    lifeosDb.goals.toArray(),
    lifeosDb.activityTemplates.toArray(),
    lifeosDb.plannedActivities.toArray(),
    lifeosDb.lifeEvents.toArray(),
    lifeosDb.goalHistoryEvents.toArray(),
    lifeosDb.weeklyReviews.toArray(),
  ]);

  const isEmpty =
    weeks.length === 0 &&
    lifeAreas.length === 0 &&
    goals.length === 0 &&
    activityTemplates.length === 0 &&
    plannedActivities.length === 0 &&
    lifeEvents.length === 0 &&
    goalHistoryEvents.length === 0 &&
    weeklyReviews.length === 0;

  if (isEmpty) {
    const seedData = demoDataForWeek(defaultPersona, currentWeek);
    await replaceLifeOSData(seedData);
    return seedData;
  }

  const normalizedPlannedActivities = normalizePlannedActivities(
    plannedActivities,
    currentWeek.id,
  );
  const hasCurrentWeek = weeks.some((week) => week.id === currentWeek.id);
  if (!hasCurrentWeek) {
    await lifeosDb.weeks.put(currentWeek);
  }
  if (normalizedPlannedActivities.length > 0) {
    await lifeosDb.plannedActivities.bulkPut(normalizedPlannedActivities);
  }

  return {
    weeks: hasCurrentWeek ? weeks : [...weeks, currentWeek],
    lifeAreas,
    goals,
    activityTemplates,
    plannedActivities: normalizedPlannedActivities,
    lifeEvents,
    goalHistoryEvents,
    weeklyReviews,
  };
}

export async function replaceLifeOSData(data: LifeOSData) {
  await lifeosDb.transaction(
    "rw",
    [
      lifeosDb.weeks,
      lifeosDb.lifeAreas,
      lifeosDb.goals,
      lifeosDb.activityTemplates,
      lifeosDb.plannedActivities,
      lifeosDb.lifeEvents,
      lifeosDb.goalHistoryEvents,
      lifeosDb.weeklyReviews,
    ],
    async () => {
      await Promise.all([
        lifeosDb.weeks.clear(),
        lifeosDb.lifeAreas.clear(),
        lifeosDb.goals.clear(),
        lifeosDb.activityTemplates.clear(),
        lifeosDb.plannedActivities.clear(),
        lifeosDb.lifeEvents.clear(),
        lifeosDb.goalHistoryEvents.clear(),
        lifeosDb.weeklyReviews.clear(),
      ]);
      await Promise.all([
        lifeosDb.weeks.bulkPut(data.weeks),
        lifeosDb.lifeAreas.bulkPut(data.lifeAreas),
        lifeosDb.goals.bulkPut(data.goals),
        lifeosDb.activityTemplates.bulkPut(data.activityTemplates),
        lifeosDb.plannedActivities.bulkPut(data.plannedActivities),
        lifeosDb.lifeEvents.bulkPut(data.lifeEvents),
        lifeosDb.goalHistoryEvents.bulkPut(data.goalHistoryEvents),
        lifeosDb.weeklyReviews.bulkPut(data.weeklyReviews),
      ]);
    },
  );
}

export async function exportLifeOSData(): Promise<LifeOSExport> {
  const [
    weeks,
    lifeAreas,
    goals,
    activityTemplates,
    plannedActivities,
    lifeEvents,
    goalHistoryEvents,
    weeklyReviews,
  ] = await Promise.all([
    lifeosDb.weeks.toArray(),
    lifeosDb.lifeAreas.toArray(),
    lifeosDb.goals.toArray(),
    lifeosDb.activityTemplates.toArray(),
    lifeosDb.plannedActivities.toArray(),
    lifeosDb.lifeEvents.toArray(),
    lifeosDb.goalHistoryEvents.toArray(),
    lifeosDb.weeklyReviews.toArray(),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      weeks,
      lifeAreas,
      goals,
      activityTemplates,
      plannedActivities,
      lifeEvents,
      goalHistoryEvents,
      weeklyReviews,
    },
  };
}

export async function importLifeOSData(value: unknown) {
  const exportData = validateLifeOSExport(value);
  await replaceLifeOSData(exportData.data);
  return exportData.data;
}

export async function replaceLifeOSDataWithPersona(
  persona: TestPersona,
  week: Week,
) {
  const data = demoDataForWeek(persona, week);
  await replaceLifeOSData(data);
  return data;
}

export function saveWeek(week: Week) {
  return lifeosDb.weeks.put(week);
}

export function saveLifeArea(lifeArea: LifeArea) {
  return lifeosDb.lifeAreas.put(lifeArea);
}

export function saveGoal(goal: Goal) {
  return lifeosDb.goals.put(goal);
}

export function saveGoals(goals: Goal[]) {
  return lifeosDb.goals.bulkPut(goals);
}

export function saveGoalWithHistory(
  goal: Goal,
  goalHistoryEvent?: GoalHistoryEvent,
) {
  return lifeosDb.transaction(
    "rw",
    [lifeosDb.goals, lifeosDb.goalHistoryEvents],
    async () => {
      await lifeosDb.goals.put(goal);
      if (goalHistoryEvent) {
        await lifeosDb.goalHistoryEvents.put(goalHistoryEvent);
      }
    },
  );
}

export function saveActivityTemplate(activityTemplate: ActivityTemplate) {
  return lifeosDb.activityTemplates.put(activityTemplate);
}

export function saveActivityTemplates(activityTemplates: ActivityTemplate[]) {
  return lifeosDb.activityTemplates.bulkPut(activityTemplates);
}

export function savePlannedActivity(plannedActivity: PlannedActivity) {
  return lifeosDb.plannedActivities.put(plannedActivity);
}

export function savePlannedActivities(plannedActivities: PlannedActivity[]) {
  return lifeosDb.plannedActivities.bulkPut(plannedActivities);
}

export function saveLifeEvent(lifeEvent: LifeEvent) {
  return lifeosDb.lifeEvents.put(lifeEvent);
}

export function saveGoalHistoryEvent(goalHistoryEvent: GoalHistoryEvent) {
  return lifeosDb.goalHistoryEvents.put(goalHistoryEvent);
}

export function saveGoalHistoryEvents(goalHistoryEvents: GoalHistoryEvent[]) {
  return lifeosDb.goalHistoryEvents.bulkPut(goalHistoryEvents);
}

export function saveWeeklyReview(weeklyReview: WeeklyReview) {
  return lifeosDb.weeklyReviews.put(weeklyReview);
}

export function saveWeeklyReviews(weeklyReviews: WeeklyReview[]) {
  return lifeosDb.weeklyReviews.bulkPut(weeklyReviews);
}

export function deleteLifeEvent(id: string) {
  return lifeosDb.lifeEvents.delete(id);
}

export function deleteGoalHistoryEvent(id: string) {
  return lifeosDb.goalHistoryEvents.delete(id);
}

export function deleteWeeklyReview(id: string) {
  return lifeosDb.weeklyReviews.delete(id);
}

export function deleteLifeArea(id: string) {
  return lifeosDb.lifeAreas.delete(id);
}

export function deleteGoal(id: string) {
  return lifeosDb.goals.delete(id);
}

export function deleteActivityTemplate(id: string) {
  return lifeosDb.activityTemplates.delete(id);
}

export function deletePlannedActivity(id: string) {
  return lifeosDb.plannedActivities.delete(id);
}

export function deletePlannedActivities(ids: string[]) {
  return lifeosDb.plannedActivities.bulkDelete(ids);
}
