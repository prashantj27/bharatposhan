// Lightweight Umami event tracking helper.
// Safely no-ops if the Umami script hasn't loaded yet.
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && window.umami?.track) {
      window.umami.track(eventName, eventData);
    }
  } catch {
    // Never let analytics break the app
  }
}
