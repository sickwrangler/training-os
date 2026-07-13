export type DayKey =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";
export type Status = "planned" | "done" | "skipped" | "moved";
export type GoalStatus = "active" | "completed" | "paused" | "archived";
export type GoalHistoryEventType =
  | "created"
  | "updated"
  | "completed"
  | "paused"
  | "resumed"
  | "archived"
  | "reflection";
export type LifeEventType =
  | "race"
  | "exam"
  | "holiday"
  | "work"
  | "release"
  | "appointment"
  | "milestone"
  | "other";
export type LifeEventStatus = "upcoming" | "completed" | "cancelled" | "archived";

export type ExtractedActivityMetadata = {
  activityKind: string;
  summary: string;
  durationMinutes?: number | null;
  quantities: Array<{
    label: string;
    value: number | string;
    unit?: string;
    context?: string;
  }>;
  structuredItems: Array<{
    type: string;
    name: string;
    attributes: Record<
      string,
      string | number | boolean | string[] | number[] | null
    >;
  }>;
  tags: string[];
  people: string[];
  places: string[];
  datesOrTimes: string[];
  notes?: string;
  confidence: number;
};

export type ActivityExtractionMetadata = ExtractedActivityMetadata;

export type ActivityExtraction = {
  method: "ollama";
  model: string;
  extractedAt: string;
  confidence?: number;
  needsReview: boolean;
};

export type Week = {
  id: string;
  weekStartDate: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export type LifeArea = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
};

export type Goal = {
  id: string;
  title: string;
  description?: string;
  lifeAreaIds: string[];
  status?: GoalStatus;
  createdAt?: string;
  completedAt?: string;
  archivedAt?: string;
};

export type ActivityTemplate = {
  id: string;
  title: string;
  description?: string;
  goalIds: string[];
  defaultDuration?: string;
  defaultIcon?: string;
  defaultNotes?: string;
};

export type PlannedActivity = {
  id: string;
  weekId: string;
  templateId: string;
  day: DayKey;
  titleOverride?: string;
  duration?: string;
  details?: string;
  notes?: string;
  lifeAreaIds?: string[];
  goalIds?: string[];
  activityKind?: string;
  rawLog?: string;
  metadata?: ActivityExtractionMetadata;
  extraction?: ActivityExtraction;
  status: Status;
  completedAt?: string;
  sortOrder?: number;
};

export type PlannedActivitySeed = Omit<PlannedActivity, "weekId"> & {
  weekId?: string;
};

export type LifeEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  type: LifeEventType;
  lifeAreaIds: string[];
  goalIds: string[];
  status: LifeEventStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalHistoryEvent = {
  id: string;
  goalId: string;
  type: GoalHistoryEventType;
  note?: string;
  date: string;
  createdAt: string;
};

export type WeeklyReview = {
  id: string;
  weekId: string;
  summary?: string;
  wins?: string[];
  challenges?: string[];
  goalCoverage?: Array<{
    goalTitle: string;
    observation: string;
  }>;
  patterns?: string[];
  suggestedAdjustments?: string[];
  questionsForUser?: string[];
  userNotes?: string;
  generatedBy?: "ollama" | "manual";
  model?: string;
  createdAt: string;
  updatedAt: string;
};

export type TestPersona = {
  id: string;
  name: string;
  description: string;
  lifeAreas: LifeArea[];
  goals: Goal[];
  activityTemplates: ActivityTemplate[];
  plannedActivities: PlannedActivitySeed[];
  lifeEvents?: LifeEvent[];
  goalHistoryEvents?: GoalHistoryEvent[];
  weeklyReviews?: WeeklyReview[];
};

// Development/demo-only data for local UI testing. This is deliberately kept
// separate from the core LifeOS model so it can be deleted later without
// changing product logic.
export const testPersonas: TestPersona[] = [
  {
    id: "patrick",
    name: "Patrick",
    description:
      "Current-user style demo data across exercise, learning, and flexible technology consulting.",
    lifeAreas: [
      {
        id: "patrick-area-exercise",
        title: "Exercise",
        description: "Running, mountain biking, strength, mobility, and recovery.",
        icon: "E",
      },
      {
        id: "patrick-area-learning",
        title: "Learning",
        description: "Welsh language, cooking, and practical skill-building.",
        icon: "L",
      },
      {
        id: "patrick-area-work",
        title: "Work",
        description: "Technology consulting, solution architecture, and flexible work.",
        icon: "W",
      },
      {
        id: "patrick-area-home",
        title: "Home",
        description: "Admin and lightweight routines that keep life smooth.",
        icon: "H",
      },
      {
        id: "patrick-area-recovery",
        title: "Recovery",
        description: "Sleep, rest, and lower-intensity care.",
        icon: "R",
      },
    ],
    goals: [
      {
        id: "patrick-goal-running-base",
        title: "Build a consistent running base",
        description: "Keep aerobic running regular without making the week brittle.",
        lifeAreaIds: ["patrick-area-exercise"],
      },
      {
        id: "patrick-goal-bike-confidence",
        title: "Improve mountain bike confidence",
        description: "Practice skills and endurance for better trail riding.",
        lifeAreaIds: ["patrick-area-exercise"],
      },
      {
        id: "patrick-goal-strength",
        title: "Stay strong and resilient",
        description: "Support running, riding, posture, and injury resistance.",
        lifeAreaIds: ["patrick-area-exercise", "patrick-area-recovery"],
      },
      {
        id: "patrick-goal-welsh",
        title: "Make Welsh feel usable",
        description: "Build speaking confidence and grammar fluency.",
        lifeAreaIds: ["patrick-area-learning"],
      },
      {
        id: "patrick-goal-cooking",
        title: "Cook more interesting vegetarian food",
        description: "Practice seasonal meals and restaurant-style technique.",
        lifeAreaIds: ["patrick-area-learning", "patrick-area-home"],
      },
      {
        id: "patrick-goal-consulting",
        title: "Shape a flexible consulting offer",
        description: "Clarify useful offers around architecture and technology consulting.",
        lifeAreaIds: ["patrick-area-work"],
      },
      {
        id: "patrick-goal-portfolio",
        title: "Keep portfolio and admin moving",
        description: "Small maintenance work that keeps opportunities visible.",
        lifeAreaIds: ["patrick-area-work", "patrick-area-home"],
      },
      {
        id: "patrick-goal-recovery",
        title: "Protect recovery",
        description: "Keep mobility, sleep, and rest in the plan.",
        lifeAreaIds: ["patrick-area-recovery"],
      },
      {
        id: "patrick-goal-race",
        title: "Plan a future race block",
        description: "A low-coverage goal for testing empty planning states.",
        lifeAreaIds: ["patrick-area-exercise"],
      },
    ],
    activityTemplates: [
      {
        id: "patrick-template-easy-run",
        title: "Easy run",
        description: "Relaxed aerobic running.",
        goalIds: ["patrick-goal-running-base"],
        defaultDuration: "45 min",
        defaultIcon: "R",
        defaultNotes: "Keep it conversational.",
      },
      {
        id: "patrick-template-threshold-run",
        title: "Threshold run",
        description: "Controlled harder running without racing the workout.",
        goalIds: ["patrick-goal-running-base"],
        defaultDuration: "55 min",
        defaultIcon: "T",
      },
      {
        id: "patrick-template-long-run",
        title: "Long run",
        description: "Steady longer effort for endurance.",
        goalIds: ["patrick-goal-running-base"],
        defaultDuration: "1.5 hours",
        defaultIcon: "L",
      },
      {
        id: "patrick-template-mtb-skills",
        title: "Mountain bike skills ride",
        description: "Practice cornering, braking, body position, and line choice.",
        goalIds: ["patrick-goal-bike-confidence"],
        defaultDuration: "75 min",
        defaultIcon: "M",
      },
      {
        id: "patrick-template-ebike-endurance",
        title: "E-bike endurance ride",
        description: "Low-pressure endurance ride with trail time.",
        goalIds: ["patrick-goal-bike-confidence", "patrick-goal-recovery"],
        defaultDuration: "2 hours",
        defaultIcon: "B",
      },
      {
        id: "patrick-template-strength",
        title: "Strength session",
        description: "Full-body strength with legs, core, and pulling work.",
        goalIds: ["patrick-goal-strength"],
        defaultDuration: "45 minutes",
        defaultIcon: "S",
      },
      {
        id: "patrick-template-mobility",
        title: "Mobility routine",
        description: "Short movement session for hips, ankles, back, and shoulders.",
        goalIds: ["patrick-goal-strength", "patrick-goal-recovery"],
        defaultDuration: "20 min",
        defaultIcon: "O",
      },
      {
        id: "patrick-template-welsh-speaking",
        title: "Welsh speaking practice",
        description: "Speak aloud, shadow audio, or chat with a tutor.",
        goalIds: ["patrick-goal-welsh"],
        defaultDuration: "25 min",
        defaultIcon: "W",
      },
      {
        id: "patrick-template-welsh-grammar",
        title: "Welsh grammar study",
        description: "Focused grammar or vocabulary study.",
        goalIds: ["patrick-goal-welsh"],
        defaultDuration: "30 min",
        defaultIcon: "G",
      },
      {
        id: "patrick-template-seasonal-meal",
        title: "Cook a seasonal vegetarian meal",
        description: "Use seasonal produce and cook deliberately.",
        goalIds: ["patrick-goal-cooking"],
        defaultDuration: "1 hour",
        defaultIcon: "C",
      },
      {
        id: "patrick-template-cooking-skills",
        title: "Restaurant/cooking skills practice",
        description: "Practice one technique, sauce, garnish, or plating idea.",
        goalIds: ["patrick-goal-cooking"],
        defaultDuration: "45 min",
        defaultIcon: "K",
      },
      {
        id: "patrick-template-consulting-offer",
        title: "Consulting offer work",
        description: "Clarify service shape, outcomes, or positioning.",
        goalIds: ["patrick-goal-consulting"],
        defaultDuration: "90 min",
        defaultIcon: "C",
      },
      {
        id: "patrick-template-portfolio-admin",
        title: "Portfolio/admin work",
        description: "Update examples, write notes, invoices, or tidy loose ends.",
        goalIds: ["patrick-goal-portfolio"],
        defaultDuration: "45 min",
        defaultIcon: "P",
      },
      {
        id: "patrick-template-architecture-notes",
        title: "Architecture notes",
        description: "Capture reusable consulting patterns and diagrams.",
        goalIds: ["patrick-goal-consulting", "patrick-goal-portfolio"],
        defaultDuration: "60 min",
        defaultIcon: "A",
      },
      {
        id: "patrick-template-sleep-winddown",
        title: "Sleep wind-down",
        description: "Gentle shutdown routine before bed.",
        goalIds: ["patrick-goal-recovery"],
        defaultDuration: "30 min",
        defaultIcon: "Z",
      },
    ],
    plannedActivities: [
      {
        id: "patrick-plan-mon-easy-run",
        templateId: "patrick-template-easy-run",
        day: "Monday",
        duration: "45 min",
        details: "Flat loop, Zone 2",
        status: "done",
      },
      {
        id: "patrick-plan-mon-welsh",
        templateId: "patrick-template-welsh-speaking",
        day: "Monday",
        duration: "25 min",
        details: "Speak through weekend recap",
        status: "done",
      },
      {
        id: "patrick-plan-tue-consulting",
        templateId: "patrick-template-consulting-offer",
        day: "Tuesday",
        duration: "90 min",
        details: "Draft architecture advisory offer",
        status: "planned",
      },
      {
        id: "patrick-plan-tue-mobility",
        templateId: "patrick-template-mobility",
        day: "Tuesday",
        duration: "20 min",
        status: "planned",
      },
      {
        id: "patrick-plan-wed-threshold",
        templateId: "patrick-template-threshold-run",
        day: "Wednesday",
        duration: "55 min",
        details: "3 x 8 min controlled",
        status: "moved",
      },
      {
        id: "patrick-plan-wed-grammar",
        templateId: "patrick-template-welsh-grammar",
        day: "Wednesday",
        duration: "30 min",
        status: "planned",
      },
      {
        id: "patrick-plan-thu-strength",
        templateId: "patrick-template-strength",
        day: "Thursday",
        duration: "45 min",
        status: "planned",
      },
      {
        id: "patrick-plan-thu-portfolio",
        templateId: "patrick-template-portfolio-admin",
        day: "Thursday",
        duration: "45 min",
        status: "skipped",
      },
      {
        id: "patrick-plan-fri-skills",
        templateId: "patrick-template-mtb-skills",
        day: "Friday",
        duration: "75 min",
        details: "Cornering and braking drills",
        status: "planned",
      },
      {
        id: "patrick-plan-fri-meal",
        templateId: "patrick-template-seasonal-meal",
        day: "Friday",
        duration: "1 hour",
        details: "Leeks, beans, greens",
        status: "planned",
      },
      {
        id: "patrick-plan-sat-ebike",
        templateId: "patrick-template-ebike-endurance",
        day: "Saturday",
        duration: "2 hours",
        status: "planned",
      },
      {
        id: "patrick-plan-sat-cooking",
        templateId: "patrick-template-cooking-skills",
        day: "Saturday",
        duration: "45 min",
        details: "Sauce and plating practice",
        status: "planned",
      },
      {
        id: "patrick-plan-sun-long-run",
        templateId: "patrick-template-long-run",
        day: "Sunday",
        duration: "1.5 hours",
        status: "planned",
      },
      {
        id: "patrick-plan-sun-winddown",
        templateId: "patrick-template-sleep-winddown",
        day: "Sunday",
        duration: "30 min",
        status: "planned",
      },
    ],
  },
  {
    id: "busy-parent",
    name: "Maya",
    description:
      "Busy parent and professional balancing family, career, health, home, and money.",
    lifeAreas: [
      {
        id: "maya-area-family",
        title: "Family",
        description: "Intentional time with children and smoother shared routines.",
        icon: "F",
      },
      {
        id: "maya-area-career",
        title: "Career",
        description: "Focused progress toward promotion without constant spillover.",
        icon: "C",
      },
      {
        id: "maya-area-health",
        title: "Health",
        description: "Practical movement, sleep, and energy.",
        icon: "H",
      },
      {
        id: "maya-area-home",
        title: "Home",
        description: "Household admin, reset routines, and fewer surprises.",
        icon: "O",
      },
      {
        id: "maya-area-money",
        title: "Money",
        description: "Budgeting and saving for family goals.",
        icon: "M",
      },
    ],
    goals: [
      {
        id: "maya-goal-kids-time",
        title: "Spend more intentional time with children",
        description: "Make small windows of attention visible and protected.",
        lifeAreaIds: ["maya-area-family"],
      },
      {
        id: "maya-goal-morning",
        title: "Build a calmer morning routine",
        description: "Reduce weekday friction before work and school.",
        lifeAreaIds: ["maya-area-family", "maya-area-home", "maya-area-health"],
      },
      {
        id: "maya-goal-promotion",
        title: "Progress toward promotion",
        description: "Make strategic work and visibility consistent.",
        lifeAreaIds: ["maya-area-career"],
      },
      {
        id: "maya-goal-health",
        title: "Improve general health",
        description: "Build simple movement and recovery into full weeks.",
        lifeAreaIds: ["maya-area-health"],
      },
      {
        id: "maya-goal-admin",
        title: "Keep household admin under control",
        description: "Handle forms, school logistics, and home tasks in batches.",
        lifeAreaIds: ["maya-area-home", "maya-area-family"],
      },
      {
        id: "maya-goal-holiday",
        title: "Save for a family holiday",
        description: "Keep the holiday fund moving with calm reviews.",
        lifeAreaIds: ["maya-area-money", "maya-area-family"],
      },
      {
        id: "maya-goal-learning",
        title: "Refresh leadership skills",
        description: "Low-coverage test goal for future learning.",
        lifeAreaIds: ["maya-area-career"],
      },
    ],
    activityTemplates: [
      {
        id: "maya-template-family-walk",
        title: "Family walk",
        description: "Easy walk with phones away.",
        goalIds: ["maya-goal-kids-time", "maya-goal-health"],
        defaultDuration: "45 min",
        defaultIcon: "W",
      },
      {
        id: "maya-template-board-game",
        title: "Board game or reading time",
        description: "Focused time with children after dinner.",
        goalIds: ["maya-goal-kids-time"],
        defaultDuration: "30 min",
        defaultIcon: "B",
      },
      {
        id: "maya-template-meal-prep",
        title: "Meal prep",
        description: "Prep simple meals or snacks for the week.",
        goalIds: ["maya-goal-morning", "maya-goal-health"],
        defaultDuration: "1 hour",
        defaultIcon: "M",
      },
      {
        id: "maya-template-school-admin",
        title: "School admin",
        description: "Forms, calendar checks, bags, and messages.",
        goalIds: ["maya-goal-admin", "maya-goal-morning"],
        defaultDuration: "25 min",
        defaultIcon: "S",
      },
      {
        id: "maya-template-focus-work",
        title: "Focus work block",
        description: "Deep work on promotion-relevant projects.",
        goalIds: ["maya-goal-promotion"],
        defaultDuration: "90 min",
        defaultIcon: "F",
      },
      {
        id: "maya-template-career-reading",
        title: "Career development reading",
        description: "Read or take notes on leadership and strategy.",
        goalIds: ["maya-goal-promotion", "maya-goal-learning"],
        defaultDuration: "30 min",
        defaultIcon: "R",
      },
      {
        id: "maya-template-manager-notes",
        title: "Manager update notes",
        description: "Capture wins, blockers, and promotion evidence.",
        goalIds: ["maya-goal-promotion"],
        defaultDuration: "20 min",
        defaultIcon: "N",
      },
      {
        id: "maya-template-budget-review",
        title: "Budget review",
        description: "Check spending and move money toward the holiday fund.",
        goalIds: ["maya-goal-holiday"],
        defaultDuration: "30 min",
        defaultIcon: "B",
      },
      {
        id: "maya-template-home-reset",
        title: "Home reset",
        description: "Quick reset of kitchen, laundry, and surfaces.",
        goalIds: ["maya-goal-admin", "maya-goal-morning"],
        defaultDuration: "30 min",
        defaultIcon: "H",
      },
      {
        id: "maya-template-short-workout",
        title: "Short workout",
        description: "Simple strength or cardio session at home.",
        goalIds: ["maya-goal-health"],
        defaultDuration: "25 min",
        defaultIcon: "X",
      },
      {
        id: "maya-template-sleep-routine",
        title: "Sleep routine",
        description: "Prepare tomorrow and wind down earlier.",
        goalIds: ["maya-goal-health", "maya-goal-morning"],
        defaultDuration: "30 min",
        defaultIcon: "Z",
      },
      {
        id: "maya-template-lunch-walk",
        title: "Lunch walk",
        description: "Short daylight movement between meetings.",
        goalIds: ["maya-goal-health"],
        defaultDuration: "20 min",
        defaultIcon: "L",
      },
      {
        id: "maya-template-holiday-research",
        title: "Holiday research",
        description: "Compare dates, costs, and realistic options.",
        goalIds: ["maya-goal-holiday"],
        defaultDuration: "45 min",
        defaultIcon: "V",
      },
    ],
    plannedActivities: [
      {
        id: "maya-plan-mon-school",
        templateId: "maya-template-school-admin",
        day: "Monday",
        duration: "25 min",
        status: "done",
      },
      {
        id: "maya-plan-mon-focus",
        templateId: "maya-template-focus-work",
        day: "Monday",
        duration: "90 min",
        details: "Promotion project proposal",
        status: "done",
      },
      {
        id: "maya-plan-tue-workout",
        templateId: "maya-template-short-workout",
        day: "Tuesday",
        duration: "25 min",
        status: "planned",
      },
      {
        id: "maya-plan-tue-board-game",
        templateId: "maya-template-board-game",
        day: "Tuesday",
        duration: "30 min",
        status: "planned",
      },
      {
        id: "maya-plan-wed-manager",
        templateId: "maya-template-manager-notes",
        day: "Wednesday",
        duration: "20 min",
        status: "moved",
      },
      {
        id: "maya-plan-wed-home",
        templateId: "maya-template-home-reset",
        day: "Wednesday",
        duration: "30 min",
        status: "planned",
      },
      {
        id: "maya-plan-thu-lunch-walk",
        templateId: "maya-template-lunch-walk",
        day: "Thursday",
        duration: "20 min",
        status: "done",
      },
      {
        id: "maya-plan-thu-reading",
        templateId: "maya-template-career-reading",
        day: "Thursday",
        duration: "30 min",
        status: "skipped",
      },
      {
        id: "maya-plan-fri-budget",
        templateId: "maya-template-budget-review",
        day: "Friday",
        duration: "30 min",
        status: "planned",
      },
      {
        id: "maya-plan-fri-sleep",
        templateId: "maya-template-sleep-routine",
        day: "Friday",
        duration: "30 min",
        status: "planned",
      },
      {
        id: "maya-plan-sat-family-walk",
        templateId: "maya-template-family-walk",
        day: "Saturday",
        duration: "45 min",
        status: "planned",
      },
      {
        id: "maya-plan-sat-holiday",
        templateId: "maya-template-holiday-research",
        day: "Saturday",
        duration: "45 min",
        status: "planned",
      },
      {
        id: "maya-plan-sun-meal",
        templateId: "maya-template-meal-prep",
        day: "Sunday",
        duration: "1 hour",
        status: "planned",
      },
      {
        id: "maya-plan-sun-home",
        templateId: "maya-template-home-reset",
        day: "Sunday",
        duration: "30 min",
        status: "planned",
      },
    ],
  },
  {
    id: "creative-freelancer",
    name: "Rowan",
    description:
      "Creative freelancer and artist testing creative practice, business, wellbeing, community, and learning.",
    lifeAreas: [
      {
        id: "rowan-area-creative",
        title: "Creative Work",
        description: "Studio practice, finished pieces, and creative momentum.",
        icon: "C",
      },
      {
        id: "rowan-area-business",
        title: "Business",
        description: "Shop, client pipeline, portfolio, and promotion.",
        icon: "B",
      },
      {
        id: "rowan-area-wellbeing",
        title: "Wellbeing",
        description: "Mental energy, movement, and sustainable pace.",
        icon: "W",
      },
      {
        id: "rowan-area-community",
        title: "Community",
        description: "Local creative connection and shared inspiration.",
        icon: "M",
      },
      {
        id: "rowan-area-learning",
        title: "Learning",
        description: "Photography, design, and craft development.",
        icon: "L",
      },
    ],
    goals: [
      {
        id: "rowan-goal-practice",
        title: "Build a consistent creative practice",
        description: "Keep studio work visible even when client work is loud.",
        lifeAreaIds: ["rowan-area-creative"],
      },
      {
        id: "rowan-goal-shop",
        title: "Launch an online shop",
        description: "Prepare listings, photos, descriptions, and launch assets.",
        lifeAreaIds: ["rowan-area-business", "rowan-area-creative"],
      },
      {
        id: "rowan-goal-pipeline",
        title: "Grow client pipeline",
        description: "Make outreach and portfolio updates routine.",
        lifeAreaIds: ["rowan-area-business"],
      },
      {
        id: "rowan-goal-energy",
        title: "Improve mental energy",
        description: "Use movement and boundaries to protect creative energy.",
        lifeAreaIds: ["rowan-area-wellbeing"],
      },
      {
        id: "rowan-goal-community",
        title: "Connect with local creative community",
        description: "Visit, attend, and follow up with local creative spaces.",
        lifeAreaIds: ["rowan-area-community", "rowan-area-creative"],
      },
      {
        id: "rowan-goal-photography",
        title: "Improve photography skills",
        description: "Practice product and documentary photography.",
        lifeAreaIds: ["rowan-area-learning", "rowan-area-business"],
      },
      {
        id: "rowan-goal-grant",
        title: "Research small arts grants",
        description: "Low-coverage test goal for future funding.",
        lifeAreaIds: ["rowan-area-business", "rowan-area-community"],
      },
    ],
    activityTemplates: [
      {
        id: "rowan-template-studio",
        title: "Studio session",
        description: "Focused making time for current body of work.",
        goalIds: ["rowan-goal-practice"],
        defaultDuration: "2 hours",
        defaultIcon: "S",
      },
      {
        id: "rowan-template-sketching",
        title: "Sketching practice",
        description: "Looser practice without needing a finished outcome.",
        goalIds: ["rowan-goal-practice", "rowan-goal-energy"],
        defaultDuration: "30 min",
        defaultIcon: "K",
      },
      {
        id: "rowan-template-listing",
        title: "Product listing update",
        description: "Write copy, adjust pricing, or improve a shop listing.",
        goalIds: ["rowan-goal-shop"],
        defaultDuration: "45 min",
        defaultIcon: "L",
      },
      {
        id: "rowan-template-client-outreach",
        title: "Client outreach",
        description: "Send thoughtful pitches or follow-ups.",
        goalIds: ["rowan-goal-pipeline"],
        defaultDuration: "45 min",
        defaultIcon: "O",
      },
      {
        id: "rowan-template-portfolio",
        title: "Portfolio update",
        description: "Add work, refine descriptions, or reorder projects.",
        goalIds: ["rowan-goal-pipeline", "rowan-goal-shop"],
        defaultDuration: "1 hour",
        defaultIcon: "P",
      },
      {
        id: "rowan-template-social",
        title: "Social post planning",
        description: "Plan calm, non-frantic posts around current work.",
        goalIds: ["rowan-goal-pipeline", "rowan-goal-community"],
        defaultDuration: "30 min",
        defaultIcon: "S",
      },
      {
        id: "rowan-template-gallery",
        title: "Gallery visit",
        description: "Visit a show and take notes on what resonates.",
        goalIds: ["rowan-goal-community", "rowan-goal-practice"],
        defaultDuration: "1.5 hours",
        defaultIcon: "G",
      },
      {
        id: "rowan-template-mindful-walk",
        title: "Mindful walk",
        description: "Walk without headphones and let ideas settle.",
        goalIds: ["rowan-goal-energy"],
        defaultDuration: "40 min",
        defaultIcon: "W",
      },
      {
        id: "rowan-template-photo-practice",
        title: "Photography practice",
        description: "Practice lighting, framing, or editing.",
        goalIds: ["rowan-goal-photography", "rowan-goal-shop"],
        defaultDuration: "60 min",
        defaultIcon: "F",
      },
      {
        id: "rowan-template-product-photo",
        title: "Product photo batch",
        description: "Shoot product images for shop launch.",
        goalIds: ["rowan-goal-photography", "rowan-goal-shop"],
        defaultDuration: "90 min",
        defaultIcon: "B",
      },
      {
        id: "rowan-template-invoice-admin",
        title: "Invoice/admin block",
        description: "Invoices, estimates, bookkeeping, and small admin.",
        goalIds: ["rowan-goal-pipeline"],
        defaultDuration: "45 min",
        defaultIcon: "A",
      },
      {
        id: "rowan-template-community-message",
        title: "Community follow-up",
        description: "Message someone met at an event or arrange a coffee.",
        goalIds: ["rowan-goal-community"],
        defaultDuration: "20 min",
        defaultIcon: "M",
      },
      {
        id: "rowan-template-design-study",
        title: "Design study",
        description: "Study layout, type, colour, or references.",
        goalIds: ["rowan-goal-photography", "rowan-goal-practice"],
        defaultDuration: "45 min",
        defaultIcon: "D",
      },
    ],
    plannedActivities: [
      {
        id: "rowan-plan-mon-studio",
        templateId: "rowan-template-studio",
        day: "Monday",
        duration: "2 hours",
        status: "done",
      },
      {
        id: "rowan-plan-mon-walk",
        templateId: "rowan-template-mindful-walk",
        day: "Monday",
        duration: "40 min",
        status: "done",
      },
      {
        id: "rowan-plan-tue-listing",
        templateId: "rowan-template-listing",
        day: "Tuesday",
        duration: "45 min",
        details: "Three ceramic prints",
        status: "planned",
      },
      {
        id: "rowan-plan-tue-outreach",
        templateId: "rowan-template-client-outreach",
        day: "Tuesday",
        duration: "45 min",
        status: "planned",
      },
      {
        id: "rowan-plan-wed-photo",
        templateId: "rowan-template-photo-practice",
        day: "Wednesday",
        duration: "60 min",
        details: "Window light test",
        status: "moved",
      },
      {
        id: "rowan-plan-wed-social",
        templateId: "rowan-template-social",
        day: "Wednesday",
        duration: "30 min",
        status: "planned",
      },
      {
        id: "rowan-plan-thu-sketch",
        templateId: "rowan-template-sketching",
        day: "Thursday",
        duration: "30 min",
        status: "done",
      },
      {
        id: "rowan-plan-thu-admin",
        templateId: "rowan-template-invoice-admin",
        day: "Thursday",
        duration: "45 min",
        status: "skipped",
      },
      {
        id: "rowan-plan-fri-portfolio",
        templateId: "rowan-template-portfolio",
        day: "Friday",
        duration: "1 hour",
        status: "planned",
      },
      {
        id: "rowan-plan-fri-community",
        templateId: "rowan-template-community-message",
        day: "Friday",
        duration: "20 min",
        status: "planned",
      },
      {
        id: "rowan-plan-sat-gallery",
        templateId: "rowan-template-gallery",
        day: "Saturday",
        duration: "1.5 hours",
        status: "planned",
      },
      {
        id: "rowan-plan-sat-product",
        templateId: "rowan-template-product-photo",
        day: "Saturday",
        duration: "90 min",
        status: "planned",
      },
      {
        id: "rowan-plan-sun-studio",
        templateId: "rowan-template-studio",
        day: "Sunday",
        duration: "2 hours",
        details: "Finish small works",
        status: "planned",
      },
      {
        id: "rowan-plan-sun-design",
        templateId: "rowan-template-design-study",
        day: "Sunday",
        duration: "45 min",
        status: "planned",
      },
    ],
  },
];
