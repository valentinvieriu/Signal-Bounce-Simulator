function formatOriginLabel(origin) {
  return origin && origin !== "null" ? origin : "this page";
}

export function getGeolocationSupportState({
  hasGeolocation = typeof navigator !== "undefined" && Boolean(navigator.geolocation),
  isSecureContext = typeof window !== "undefined" && window.isSecureContext,
  origin = typeof window !== "undefined" ? window.location.origin : "",
} = {}) {
  if (!isSecureContext) {
    return {
      available: false,
      message: `Location permissions require HTTPS or localhost. This page is running on ${formatOriginLabel(origin)}, so the browser will not show a prompt.`,
    };
  }

  if (!hasGeolocation) {
    return {
      available: false,
      message: "Geolocation is not available in this browser.",
    };
  }

  return { available: true, message: null };
}

export function getPendingGeolocationMessage() {
  return "Still waiting for your location. If iPhone Safari does not show a permission sheet, it usually means the site was already blocked. Open aA menu > Website Settings > Location, or Settings > Privacy & Security > Location Services > Safari Websites, then try again.";
}

export function getGeolocationErrorMessage(error) {
  if (!error) {
    return "Location request failed.";
  }

  const hints = {
    1: "Location was blocked. On iPhone Safari, if no prompt appeared, open aA menu > Website Settings > Location, or Settings > Privacy & Security > Location Services > Safari Websites, then try again.",
    2: "Location unavailable. Try again outdoors or with Wi-Fi enabled.",
    3: "Location request timed out. Please try again.",
  };

  return hints[error.code] || `Location request failed: ${error.message}`;
}
