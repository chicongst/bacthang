/** 20 becomes "+20", -20 becomes "−" plus the digits: a real minus sign, not a hyphen. */
export const fmtDelta = (points: number): string =>
  points > 0 ? `+${points}` : String(points).replace("-", "−");

/** Strips Vietnamese accents and lowercases, so searching "quan" matches "Quận". */
export const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
