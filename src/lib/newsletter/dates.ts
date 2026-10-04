const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CalendarDate = { y: number; m: number; d: number };

/** Parse YYYY-MM-DD without timezone drift. */
export function parseCalendarDate(iso: string): CalendarDate {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function addCalendarDays(iso: string, delta: number): CalendarDate {
  const { y, m, d } = parseCalendarDate(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

function utcWeekday(iso: string): number {
  const { y, m, d } = parseCalendarDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Format a calendar date for display (timezone-stable for SSR + client). */
export function formatIssueDate(iso: string): string {
  const { y, m, d } = parseCalendarDate(iso);
  const weekday = WEEKDAY_SHORT[utcWeekday(iso)];
  return `${weekday}, ${MONTH_SHORT[m - 1]} ${d}, ${y}`;
}

/** Monday weekly issue → prior Mon–Sun content window (matches pipeline). */
export function weekContentRange(weeklyIssueDate: string) {
  const sunday = addCalendarDays(weeklyIssueDate, -1);
  const weekStart = addCalendarDays(weeklyIssueDate, -7);
  return { weekStart, sunday };
}

function dayOrdinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** e.g. "August 3rd through 9th, 2026" */
export function weekRangeLabel(weeklyIssueDate: string): string {
  const { weekStart, sunday } = weekContentRange(weeklyIssueDate);

  if (weekStart.m === sunday.m && weekStart.y === sunday.y) {
    return `${MONTH_LONG[weekStart.m - 1]} ${dayOrdinal(weekStart.d)} through ${dayOrdinal(sunday.d)}, ${sunday.y}`;
  }

  return `${MONTH_LONG[weekStart.m - 1]} ${dayOrdinal(weekStart.d)} through ${MONTH_LONG[sunday.m - 1]} ${dayOrdinal(sunday.d)}, ${sunday.y}`;
}

const REG_WEEK1_TUESDAY = "2026-09-15";

function daysBetween(fromIso: string, toIso: string): number {
  const a = parseCalendarDate(fromIso);
  const b = parseCalendarDate(toIso);
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.floor(ms / 86_400_000);
}

/** NFL regular-season week for a Tuesday recap. Null for preseason issues. */
export function nflWeekNumber(weeklyIssueDate: string): number | null {
  const delta = daysBetween(REG_WEEK1_TUESDAY, weeklyIssueDate);
  if (delta < 0) return null;
  return 1 + Math.floor(delta / 7);
}

/**
 * Monday issues before the Week 1 recap, oldest first.
 * Week 1 of training camp is the first edition (Jun 8). The last three are preseason.
 */
const PRE_WEEK1_ISSUE_DATES = [
  "2026-06-08",
  "2026-06-15",
  "2026-06-22",
  "2026-06-29",
  "2026-07-07",
  "2026-07-20",
  "2026-07-27",
  "2026-08-03",
  "2026-08-10",
  "2026-08-17",
  "2026-08-24",
  "2026-08-31",
  "2026-09-07",
  "2026-09-14",
] as const;
const PRESEASON_WEEKS = 3;

export type SeasonPhase = "regular" | "preseason" | "camp";

export function seasonWeek(weeklyIssueDate: string): { phase: SeasonPhase; week: number } | null {
  const n = nflWeekNumber(weeklyIssueDate);
  if (n) return { phase: "regular", week: n };
  const idx = PRE_WEEK1_ISSUE_DATES.indexOf(
    weeklyIssueDate.slice(0, 10) as (typeof PRE_WEEK1_ISSUE_DATES)[number],
  );
  if (idx < 0) return null;
  const campWeeks = PRE_WEEK1_ISSUE_DATES.length - PRESEASON_WEEKS;
  return idx >= campWeeks
    ? { phase: "preseason", week: idx - campWeeks + 1 }
    : { phase: "camp", week: idx + 1 };
}

const PHASE_PREFIX: Record<SeasonPhase, string> = {
  regular: "Week",
  preseason: "Preseason Week",
  camp: "Training Camp Week",
};

/** "Week 3 Recap", "Preseason Week 2 Recap", "Training Camp Week 1 Recap". */
export function recapLabel(weeklyIssueDate: string): string {
  const sw = seasonWeek(weeklyIssueDate);
  if (sw) return `${PHASE_PREFIX[sw.phase]} ${sw.week} Recap`;
  return `Week in review: ${weekRangeCompact(weeklyIssueDate)}`;
}

export function weekRecapSubtitle(weeklyIssueDate: string): string {
  const { weekStart, sunday } = weekContentRange(weeklyIssueDate);
  const fmt = ({ y, m, d }: CalendarDate) =>
    `${WEEKDAY_SHORT[utcWeekday(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)]}, ${MONTH_SHORT[m - 1]} ${d}`;
  const range = `${fmt(weekStart)} through ${fmt(sunday)}`;
  const sw = seasonWeek(weeklyIssueDate);
  if (sw) return `${recapLabel(weeklyIssueDate)} · ${range}`;
  return `Week in review: ${range}`;
}

/** e.g. "Aug 10-16, 2026" or "Jul 27-Aug 2, 2026" */
export function weekRangeCompact(weeklyIssueDate: string): string {
  const { weekStart, sunday } = weekContentRange(weeklyIssueDate);
  if (weekStart.m === sunday.m && weekStart.y === sunday.y) {
    return `${MONTH_SHORT[weekStart.m - 1]} ${weekStart.d}-${sunday.d}, ${sunday.y}`;
  }
  return `${MONTH_SHORT[weekStart.m - 1]} ${weekStart.d}-${MONTH_SHORT[sunday.m - 1]} ${sunday.d}, ${sunday.y}`;
}

export function weekInReviewTitle(weeklyIssueDate: string): string {
  return recapLabel(weeklyIssueDate);
}

/** Short label under the stack and on the stub: "Week 3", "Preseason Week 2", "Training Camp Week 1". */
export function weekTabLabel(weeklyIssueDate: string): string {
  const sw = seasonWeek(weeklyIssueDate);
  if (sw) return `${PHASE_PREFIX[sw.phase]} ${sw.week}`;
  return weekRangeCompact(weeklyIssueDate);
}

/** Breadcrumb / adjacent-week label. Same phase names as the ticket title. */
export function weeklyNavLabel(weeklyIssueDate: string): string {
  return recapLabel(weeklyIssueDate);
}
