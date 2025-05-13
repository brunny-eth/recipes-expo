/**
 * Parses an ISO 8601 duration string (e.g., P1DT2H30M) into a human-readable format.
 * Handles basic PnYnMnDTnHnMnS formats. Does not handle weeks (PnW) or combined date/time components perfectly for large durations.
 *
 * @param durationString The ISO 8601 duration string.
 * @returns A human-readable string representation (e.g., "1 day 2 hours 30 minutes") or null if parsing fails or duration is zero.
 */
export function parseISODuration(durationString: string | null | undefined): string | null {
  if (!durationString) {
    return null;
  }

  // Regex to capture components of ISO 8601 duration PnYnMnDTnHnMnS
  // It handles optional components.
  const regex = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;
  const matches = durationString.match(regex);

  if (!matches) {
    console.warn(`[parseISODuration] Could not parse duration string: ${durationString}`);
    // Optionally return the original string or handle specific common non-ISO formats if needed
    // For now, return null for unparseable formats.
    return null;
  }

  const parts = {
    years: parseInt(matches[1]) || 0,
    months: parseInt(matches[2]) || 0,
    days: parseInt(matches[3]) || 0,
    hours: parseInt(matches[4]) || 0,
    minutes: parseInt(matches[5]) || 0,
    seconds: parseFloat(matches[6]) || 0,
  };

  const readableParts: string[] = [];

  if (parts.years > 0) readableParts.push(`${parts.years} year${parts.years > 1 ? 's' : ''}`);
  if (parts.months > 0) readableParts.push(`${parts.months} month${parts.months > 1 ? 's' : ''}`);
  if (parts.days > 0) readableParts.push(`${parts.days} day${parts.days > 1 ? 's' : ''}`);
  if (parts.hours > 0) readableParts.push(`${parts.hours} hour${parts.hours > 1 ? 's' : ''}`);
  if (parts.minutes > 0) readableParts.push(`${parts.minutes} minute${parts.minutes > 1 ? 's' : ''}`);
  // Optionally include seconds if needed, or round them if fractional
  // if (parts.seconds > 0) readableParts.push(`${Math.round(parts.seconds)} second${parts.seconds !== 1 ? 's' : ''}`);

  if (readableParts.length === 0) {
      // Handle cases like PT0S or P0D etc.
      console.warn(`[parseISODuration] Duration string resulted in zero time: ${durationString}`);
      return null; 
  }

  return readableParts.join(' ');
} 