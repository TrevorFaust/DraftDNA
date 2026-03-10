/**
 * Calculate age from birth_date string (YYYY-MM-DD).
 * Example: 1974-06-28 → born June 28, 1974 → age as of today.
 */
export function getAgeFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}
