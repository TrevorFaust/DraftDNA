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

/** Display title: "Week 1 Recap" in season, date-range title in preseason. */
export function recapLabel(weeklyIssueDate: string): string {
  const n = nflWeekNumber(weeklyIssueDate);
  if (n) return `Week ${n} Recap`;
  return `Week in review: ${weekRangeCompact(weeklyIssueDate)}`;
}

export function weekRecapSubtitle(weeklyIssueDate: string): string {
  const { weekStart, sunday } = weekContentRange(weeklyIssueDate);
  const fmt = ({ y, m, d }: CalendarDate) =>
    `${WEEKDAY_SHORT[utcWeekday(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)]}, ${MONTH_SHORT[m - 1]} ${d}`;
  const range = `${fmt(weekStart)} through ${fmt(sunday)}`;
  const n = nflWeekNumber(weeklyIssueDate);
  if (n) return `Week ${n} Recap · ${range}`;
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

/** Breadcrumb / adjacent-week label: Week N Recap in season, compact dates in preseason. */
export function weeklyNavLabel(weeklyIssueDate: string): string {
  const n = nflWeekNumber(weeklyIssueDate);
  if (n) return `Week ${n} Recap`;
  return weekRangeCompact(weeklyIssueDate);
}
