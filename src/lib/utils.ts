import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Uppercase the first letter in trimmed text (after optional leading punctuation). */
export function capitalizeSentenceStart(text: string): string {
  const s = text.trim();
  if (!s) return s;
  return s.replace(/[a-zA-Z]/, (c) => c.toLocaleUpperCase("en-US"));
}
