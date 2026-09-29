import { describe, expect, it } from "vitest";
import { tierFor, vnDayRange, START_POINTS, WIN_POINTS, LOSS_POINTS, DAILY_LIMIT_PER_PAIR } from "../src/domain/rules.js";

describe("scoring rules", () => {
  it("uses the agreed constants", () => {
    expect(START_POINTS).toBe(1000);
    expect(WIN_POINTS).toBe(20);
    expect(LOSS_POINTS).toBe(-20);
    expect(DAILY_LIMIT_PER_PAIR).toBe(3);
  });
});

describe("tierFor", () => {
  it("every 100 points is one tier", () => {
    const ids = [1000, 1100, 1200, 1300, 1400].map((p) => tierFor(p).id);
    expect(new Set(ids).size).toBe(5);
    expect(tierFor(1000).id).not.toBe(tierFor(999).id);
  });

  it.each([
    [-50, "bronze"], [999, "bronze"],
    [1000, "silver"], [1099, "silver"],
    [1100, "gold"], [1199, "gold"],
    [1200, "platinum"], [1299, "platinum"],
    [1300, "diamond"], [1399, "diamond"],
    [1400, "master"], [9999, "master"],
  ])("%i points maps to %s", (points, id) => {
    expect(tierFor(points).id).toBe(id);
  });

  it("has a display name", () => {
    expect(tierFor(1000).name).toBe("Silver");
    expect(tierFor(1400).name).toBe("Master");
  });
});

describe("vnDayRange", () => {
  it("23:59 Vietnam time still belongs to that day", () => {
    // 2026-09-17 23:59 +07:00 = 2026-09-17 16:59Z
    const r = vnDayRange(new Date("2026-09-17T16:59:00Z"));
    expect(r.start.toISOString()).toBe("2026-09-16T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-09-17T17:00:00.000Z");
  });

  it("00:00 Vietnam time starts a new day", () => {
    const r = vnDayRange(new Date("2026-09-17T17:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-09-17T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-09-18T17:00:00.000Z");
  });

  it("07:00 Vietnam time (00:00Z) sits mid-day, not on a boundary", () => {
    const r = vnDayRange(new Date("2026-09-18T00:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-09-17T17:00:00.000Z");
  });
});
