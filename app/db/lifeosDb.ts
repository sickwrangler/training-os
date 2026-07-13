import Dexie, { type Table } from "dexie";
import type {
  ActivityTemplate,
  Goal,
  GoalHistoryEvent,
  LifeEvent,
  LifeArea,
  PlannedActivity,
  Week,
  WeeklyReview,
} from "@/app/data/testPersonas";

class LifeOSDatabase extends Dexie {
  weeks!: Table<Week, string>;
  lifeAreas!: Table<LifeArea, string>;
  goals!: Table<Goal, string>;
  activityTemplates!: Table<ActivityTemplate, string>;
  plannedActivities!: Table<PlannedActivity, string>;
  lifeEvents!: Table<LifeEvent, string>;
  goalHistoryEvents!: Table<GoalHistoryEvent, string>;
  weeklyReviews!: Table<WeeklyReview, string>;

  constructor() {
    super("lifeos");

    this.version(1).stores({
      lifeAreas: "id, title",
      goals: "id, title, *lifeAreaIds",
      activityTemplates: "id, title, *goalIds",
      plannedActivities: "id, templateId, day, status",
    });

    this.version(2).stores({
      weeks: "id, weekStartDate, createdAt, updatedAt",
      lifeAreas: "id, title",
      goals: "id, title, *lifeAreaIds",
      activityTemplates: "id, title, *goalIds",
      plannedActivities: "id, weekId, templateId, day, status, sortOrder",
    });

    this.version(3).stores({
      weeks: "id, weekStartDate, createdAt, updatedAt",
      lifeAreas: "id, title",
      goals: "id, title, *lifeAreaIds",
      activityTemplates: "id, title, *goalIds",
      plannedActivities: "id, weekId, templateId, day, status, sortOrder",
      lifeEvents: "id, date, endDate, type, status, *lifeAreaIds, *goalIds",
    });

    this.version(4).stores({
      weeks: "id, weekStartDate, createdAt, updatedAt",
      lifeAreas: "id, title",
      goals: "id, title, status, createdAt, completedAt, archivedAt, *lifeAreaIds",
      activityTemplates: "id, title, *goalIds",
      plannedActivities: "id, weekId, templateId, day, status, sortOrder",
      lifeEvents: "id, date, endDate, type, status, *lifeAreaIds, *goalIds",
      goalHistoryEvents: "id, goalId, type, date, createdAt",
    });

    this.version(5).stores({
      weeks: "id, weekStartDate, createdAt, updatedAt",
      lifeAreas: "id, title",
      goals: "id, title, status, createdAt, completedAt, archivedAt, *lifeAreaIds",
      activityTemplates: "id, title, *goalIds",
      plannedActivities: "id, weekId, templateId, day, status, sortOrder",
      lifeEvents: "id, date, endDate, type, status, *lifeAreaIds, *goalIds",
      goalHistoryEvents: "id, goalId, type, date, createdAt",
      weeklyReviews: "id, weekId, generatedBy, createdAt, updatedAt",
    });
  }
}

export const lifeosDb = new LifeOSDatabase();

export function getAllWeeks() {
  return lifeosDb.weeks.toArray();
}

export function getWeek(id: string) {
  return lifeosDb.weeks.get(id);
}

export function getWeekByStartDate(weekStartDate: string) {
  return lifeosDb.weeks.where("weekStartDate").equals(weekStartDate).first();
}

export function getAllLifeAreas() {
  return lifeosDb.lifeAreas.toArray();
}

export function getAllGoals() {
  return lifeosDb.goals.toArray();
}

export function getAllActivityTemplates() {
  return lifeosDb.activityTemplates.toArray();
}

export function getAllPlannedActivities() {
  return lifeosDb.plannedActivities.toArray();
}

export function getAllLifeEvents() {
  return lifeosDb.lifeEvents.toArray();
}

export function getAllGoalHistoryEvents() {
  return lifeosDb.goalHistoryEvents.toArray();
}

export function getAllWeeklyReviews() {
  return lifeosDb.weeklyReviews.toArray();
}

export function saveLifeArea(lifeArea: LifeArea) {
  return lifeosDb.lifeAreas.put(lifeArea);
}

export function saveGoal(goal: Goal) {
  return lifeosDb.goals.put(goal);
}

export function saveActivityTemplate(activityTemplate: ActivityTemplate) {
  return lifeosDb.activityTemplates.put(activityTemplate);
}

export function savePlannedActivity(plannedActivity: PlannedActivity) {
  return lifeosDb.plannedActivities.put(plannedActivity);
}

export function saveWeek(week: Week) {
  return lifeosDb.weeks.put(week);
}

export function saveLifeEvent(lifeEvent: LifeEvent) {
  return lifeosDb.lifeEvents.put(lifeEvent);
}

export function saveGoalHistoryEvent(goalHistoryEvent: GoalHistoryEvent) {
  return lifeosDb.goalHistoryEvents.put(goalHistoryEvent);
}

export function saveWeeklyReview(weeklyReview: WeeklyReview) {
  return lifeosDb.weeklyReviews.put(weeklyReview);
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

export function deleteWeek(id: string) {
  return lifeosDb.weeks.delete(id);
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
