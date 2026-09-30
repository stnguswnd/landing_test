export const GA_MEASUREMENT_ID = "G-S9S8HFKVVV";
export const GTM_CONTAINER_ID = "GTM-NXVZVMWN";

type AnalyticsValue = string | number | boolean;

export type AnalyticsParameters = Record<string, AnalyticsValue | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsParameters = {},
) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  const cleanParameters = Object.fromEntries(
    Object.entries(parameters).filter((entry) => entry[1] !== undefined),
  );

  window.gtag("event", eventName, cleanParameters);
}
