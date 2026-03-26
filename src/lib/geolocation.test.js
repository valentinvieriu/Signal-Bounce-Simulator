import { describe, expect, it } from "vitest";

import {
  getGeolocationErrorMessage,
  getGeolocationSupportState,
  getPendingGeolocationMessage,
} from "./geolocation";

describe("getGeolocationSupportState", () => {
  it("blocks requests on insecure origins even when the API exists", () => {
    expect(
      getGeolocationSupportState({
        hasGeolocation: true,
        isSecureContext: false,
        origin: "http://192.168.1.20:5173",
      }),
    ).toEqual({
      available: false,
      message:
        "Location permissions require HTTPS or localhost. This page is running on http://192.168.1.20:5173, so the browser will not show a prompt.",
    });
  });

  it("reports unsupported browsers on secure origins", () => {
    expect(
      getGeolocationSupportState({
        hasGeolocation: false,
        isSecureContext: true,
        origin: "https://example.com",
      }),
    ).toEqual({
      available: false,
      message: "Geolocation is not available in this browser.",
    });
  });

  it("allows requests when geolocation is available on a secure origin", () => {
    expect(
      getGeolocationSupportState({
        hasGeolocation: true,
        isSecureContext: true,
        origin: "https://example.com",
      }),
    ).toEqual({
      available: true,
      message: null,
    });
  });
});

describe("getGeolocationErrorMessage", () => {
  it("returns the iOS reset hint for denied permission", () => {
    expect(getGeolocationErrorMessage({ code: 1, message: "User denied Geolocation" })).toBe(
      "Location was blocked. On iPhone Safari, if no prompt appeared, open aA menu > Website Settings > Location, or Settings > Privacy & Security > Location Services > Safari Websites, then try again.",
    );
  });

  it("falls back to the browser-provided error message", () => {
    expect(getGeolocationErrorMessage({ code: 99, message: "Unknown failure" })).toBe(
      "Location request failed: Unknown failure",
    );
  });
});

describe("getPendingGeolocationMessage", () => {
  it("explains the likely iPhone Safari saved-permission state", () => {
    expect(getPendingGeolocationMessage()).toBe(
      "Still waiting for your location. If iPhone Safari does not show a permission sheet, it usually means the site was already blocked. Open aA menu > Website Settings > Location, or Settings > Privacy & Security > Location Services > Safari Websites, then try again.",
    );
  });
});
