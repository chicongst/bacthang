import { describe, expect, it } from "vitest";
import { tierFor, vnDayRange, START_POINTS, WIN_POINTS, LOSS_POINTS, DAILY_LIMIT_PER_PAIR } from "../src/domain/rules.js";

describe("luật điểm", () => {
  it("dùng đúng hằng số đã chốt", () => {
    expect(START_POINTS).toBe(1000);
    expect(WIN_POINTS).toBe(20);
    expect(LOSS_POINTS).toBe(-20);
    expect(DAILY_LIMIT_PER_PAIR).toBe(3);
  });
});

describe("tierFor", () => {
  it("mỗi 100 điểm là một hạng", () => {
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
  ])("%i điểm → %s", (points, id) => {
    expect(tierFor(points).id).toBe(id);
  });

  it("có tên tiếng Việt", () => {
    expect(tierFor(1000).name).toBe("Bạc");
    expect(tierFor(1400).name).toBe("Cao Thủ");
  });
});

describe("vnDayRange", () => {
  it("23:59 giờ VN vẫn thuộc ngày đó", () => {
    // 2026-09-17 23:59 +07:00 = 2026-09-17 16:59Z
    const r = vnDayRange(new Date("2026-09-17T16:59:00Z"));
    expect(r.start.toISOString()).toBe("2026-09-16T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-09-17T17:00:00.000Z");
  });

  it("00:00 giờ VN là ngày mới", () => {
    const r = vnDayRange(new Date("2026-09-17T17:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-09-17T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-09-18T17:00:00.000Z");
  });

  it("07:00 sáng giờ VN (00:00Z) nằm giữa ngày VN, không phải ranh giới", () => {
    const r = vnDayRange(new Date("2026-09-18T00:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-09-17T17:00:00.000Z");
  });
});
