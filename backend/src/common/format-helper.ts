export function toTitleCaseWithSpaces(input: any) {
  const toTitleCase = (str: string) =>
    str
      .split(/[_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  const result: Record<string, any> = {};

  for (const key in input) {
    if (Object.hasOwn(input, key)) {
      const value = input[key];
      result[key] = typeof value === 'string' ? toTitleCase(value) : value;
    }
  }

  return result;
}

export function formatDuration(durationInMs: number): string {
  const totalSeconds = Math.floor(durationInMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`; // e.g., 0:08
}
