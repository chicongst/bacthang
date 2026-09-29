/** 20 → "+20"; -20 → "−20" (dùng dấu trừ thật, không phải gạch nối). */
export const fmtDelta = (n: number): string => (n > 0 ? `+${n}` : String(n).replace("-", "−"));
