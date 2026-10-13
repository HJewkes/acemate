import { describe, expect, it } from "vitest";
import { deviceRows, rssiBars, upsertRobot, type SeenRobot } from "../src/robot/device-list";

const robot = (id: string, rssi: number | null, name = `ACEMATE-${id}`): SeenRobot => ({ id, name, rssi });

describe("nearby robot list", () => {
  it("keeps one entry per id, updating its RSSI in place", () => {
    let list = upsertRobot([], robot("a", -70));
    list = upsertRobot(list, robot("b", -60));

    list = upsertRobot(list, robot("a", -55));

    expect(list).toEqual([robot("a", -55), robot("b", -60)]);
  });

  it("returns the same list when an advertisement changes nothing", () => {
    const list = upsertRobot([], robot("a", -70));

    expect(upsertRobot(list, robot("a", -70))).toBe(list);
  });

  it("sorts by signal, strongest first, with the connected robot on top", () => {
    const list = [robot("far", -88), robot("near", -50), robot("mine", -75)];

    const rows = deviceRows(list, { id: "mine", name: "ACEMATE-mine" });

    expect(rows.map((row) => [row.id, row.connected])).toEqual([
      ["mine", true],
      ["near", false],
      ["far", false],
    ]);
  });

  it("lists the connected robot even when it no longer advertises", () => {
    const rows = deviceRows([robot("other", -60)], { id: "mine", name: "Court 2" });

    expect(rows[0]).toEqual({ id: "mine", name: "Court 2", rssi: null, connected: true });
    expect(rows).toHaveLength(2);
  });

  it("shows more bars for a stronger signal and none without one", () => {
    expect([null, -95, -85, -75, -65, -40].map(rssiBars)).toEqual([0, 0, 1, 2, 3, 4]);
  });
});
