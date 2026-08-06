/**
 * Turn unknown errors into short copy safe for toasts and UI.
 * Keeps intentional short API messages; hides DB/stack/code dumps.
 */

const TECHNICAL_MESSAGE_RE =
  /duplicate key|violates\s+(?:unique|foreign key|check|not[- ]null)|constraint|null value in column|invalid input syntax|permission denied|row[- ]level security|\bPGRST\d+\b|\b22P02\b|\b23505\b|\b23503\b|\b42501\b|\b42P01\b|column .+ does not exist|relation .+ does not exist|could not find the ['"`].+['"`] (?:column|table)|failed to fetch|networkerror|typeerror|referenceerror|syntaxerror|\bat\s+\S+\s+\(|\.tsx?:\d+|supabase|postgres|jwt|stack trace|migration file|sql\b/i;

function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string') return msg.trim();
  }
  return '';
}

export function isTechnicalErrorMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length > 140) return true;
  if (/[{}=;]/.test(trimmed) && trimmed.length > 40) return true;
  return TECHNICAL_MESSAGE_RE.test(trimmed);
}

/** Prefer `fallback` whenever the raw error looks technical or empty. */
export function userFacingErrorMessage(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error);
  if (!message || isTechnicalErrorMessage(message)) return fallback;
  return message;
}
