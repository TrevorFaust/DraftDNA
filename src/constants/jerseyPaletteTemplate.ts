/**
 * Slot-based palette for a simple vector template (e.g. `football-jersey.svg`).
 * The live player jersey uses `empty_football_jersey.svg` + `jerseyRecolorByLabel` instead.
 */
export const JERSEY_PALETTE_PRIMARY_SLOT = '#AAB001';
export const JERSEY_PALETTE_SECONDARY_SLOT = '#AAB002';
export const JERSEY_PALETTE_TERTIARY_SLOT = '#AAB003';

export function applyJerseyPalette(
  svg: string,
  primary: string,
  secondary: string,
  tertiary: string
): string {
  return svg
    .replaceAll(JERSEY_PALETTE_PRIMARY_SLOT, primary)
    .replaceAll(JERSEY_PALETTE_SECONDARY_SLOT, secondary)
    .replaceAll(JERSEY_PALETTE_TERTIARY_SLOT, tertiary);
}
