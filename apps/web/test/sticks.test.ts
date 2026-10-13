import { describe, expect, it } from "vitest";
import { CENTERED, StickPair, offsetToStick } from "../src/sticks.js";

const RADIUS = 100;

describe("offsetToStick", () => {
  it("reads a small wobble inside the deadzone as centred", () => {
    expect(offsetToStick(6, -7, RADIUS)).toEqual(CENTERED);
  });

  it("scales offsets inside the rim linearly", () => {
    expect(offsetToStick(50, -30, RADIUS)).toEqual({ x: 0.5, y: -0.3 });
  });

  it("clamps a drag past the rim to full deflection in the same direction", () => {
    const stick = offsetToStick(300, 400, RADIUS);

    expect(Math.hypot(stick.x, stick.y)).toBeCloseTo(1);
    expect(stick.x / stick.y).toBeCloseTo(0.75);
  });
});

describe("StickPair", () => {
  it("lets two thumbs drive both sticks at once and maps them to translate and turn", () => {
    const pair = new StickPair(() => RADIUS);

    pair.down("left", 1, 0, -100);
    pair.down("right", 2, 80, 0);

    expect(pair.input()).toEqual({ x: 0, y: 1, turn: 0.8 });
  });

  it("routes each pointer's moves to the stick it pressed", () => {
    const pair = new StickPair(() => RADIUS);
    pair.down("left", 1, 0, 0);
    pair.down("right", 2, 0, 0);

    expect(pair.move(2, -100, 0)).toBe("right");
    expect(pair.move(1, 40, 0)).toBe("left");
    expect(pair.move(3, 100, 100)).toBeNull();
    expect(pair.input()).toEqual({ x: 0.4, y: 0, turn: -1 });
  });

  it("ignores a second finger on a stick that is already held", () => {
    const pair = new StickPair(() => RADIUS);
    pair.down("left", 1, 0, -100);

    expect(pair.down("left", 7, 0, 100)).toBe(false);
    pair.move(7, 0, 100);

    expect(pair.stick("left")).toEqual({ x: 0, y: -1 });
  });

  it("re-centres only the stick whose finger lifted", () => {
    const pair = new StickPair(() => RADIUS);
    pair.down("left", 1, 0, -100);
    pair.down("right", 2, 100, 0);

    expect(pair.up(2)).toBe("right");

    expect(pair.stick("right")).toEqual(CENTERED);
    expect(pair.stick("left")).toEqual({ x: 0, y: -1 });
  });

  it("uses only the horizontal axis of the turn stick", () => {
    const pair = new StickPair(() => RADIUS);

    pair.down("right", 1, 0, -100);

    expect(pair.stick("right")).toEqual(CENTERED);
  });
});
