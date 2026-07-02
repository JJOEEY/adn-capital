import { describe, expect, it } from "vitest";
import { newHealSpot, newHealStroke, spotWeight } from "./heal";

describe("heal spot weight", () => {
  it("is 1 at the destination center and 0 outside the radius", () => {
    const s = { ...newHealSpot(0.5, 0.5), radius: 0.1, feather: 0.4 };
    expect(spotWeight(0.5, 0.5, s, 1)).toBeCloseTo(1);
    expect(spotWeight(0.5 + 0.25, 0.5, s, 1)).toBeCloseTo(0); // well outside
  });
  it("falls off monotonically from center to edge", () => {
    const s = { ...newHealSpot(0.5, 0.5), radius: 0.2, feather: 0.5 };
    const near = spotWeight(0.5 + 0.05, 0.5, s, 1);
    const far = spotWeight(0.5 + 0.15, 0.5, s, 1);
    expect(near).toBeGreaterThanOrEqual(far);
  });
  it("aspect keeps the region circular (wide image needs more x to reach the edge)", () => {
    const s = { ...newHealSpot(0.5, 0.5), radius: 0.1, feather: 0 };
    // aspect=2 (wide): an x-offset counts double, so it leaves the circle sooner.
    const wide = spotWeight(0.5 + 0.06, 0.5, s, 2);
    const square = spotWeight(0.5 + 0.06, 0.5, s, 1);
    expect(wide).toBeLessThanOrEqual(square);
  });
});

describe("heal stroke", () => {
  it("carries its points and brush settings, with a sideways default source offset", () => {
    const st = newHealStroke([0.1, 0.2, 0.3, 0.4], 0.05, "heal");
    expect(st.points).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(st.radius).toBe(0.05);
    expect(st.mode).toBe("heal");
    expect(st.offsetX).toBeGreaterThan(0); // samples from the side, not in place
    expect(st.offsetY).toBe(0);
    expect(st.id).toBeTruthy();
  });
  it("gives each stroke a distinct id", () => {
    const a = newHealStroke([0, 0], 0.04, "clone");
    const b = newHealStroke([0, 0], 0.04, "clone");
    expect(a.id).not.toBe(b.id);
  });
});
