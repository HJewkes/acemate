import type { Request } from "./protocol";

const DEFAULT_COUNTRY = "US";

/** "en-GB" gives "GB", "zh-Hant-TW" gives "TW"; a locale without a region gives "US". */
export function countryCodeFromLocale(locale?: string): string {
  const region = locale
    ?.split(/[-_]/)
    .slice(1)
    .find((part) => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : DEFAULT_COUNTRY;
}

/** The robot ignores run_start until this sets its clock; `now` is in milliseconds. */
export function setTimeRequest(now: number, countryCode: string = DEFAULT_COUNTRY): Request {
  return {
    type: "set_time",
    data: {
      unix_timestamp: Math.floor(now / 1000),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      country_code: countryCode,
    },
  };
}

/** set_time with this device's clock, time zone and locale region, as every controller sends it. */
export function localSetTimeRequest(now: number): Request {
  return setTimeRequest(now, countryCodeFromLocale(Intl.DateTimeFormat().resolvedOptions().locale));
}
