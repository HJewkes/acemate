import { describe, expect, it } from "vitest";
import { countryCodeFromLocale, setTimeRequest } from "../src/protocol/clock";

describe("countryCodeFromLocale", () => {
  it.each([
    ["en-GB", "GB"],
    ["fr_ca", "CA"],
    ["zh-Hant-TW", "TW"],
    ["en", "US"],
    ["", "US"],
    [undefined, "US"],
  ])("maps %s to %s", (locale, country) => {
    expect(countryCodeFromLocale(locale)).toBe(country);
  });
});

describe("setTimeRequest", () => {
  it("sends whole seconds, the time zone and the country code", () => {
    const request = setTimeRequest(1_700_000_000_999, "GB");

    expect(request.type).toBe("set_time");
    expect(request.data).toEqual({
      unix_timestamp: 1_700_000_000,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      country_code: "GB",
    });
  });

  it("defaults the country to US", () => {
    expect((setTimeRequest(0).data as { country_code: string }).country_code).toBe("US");
  });
});
