export type CookieConsentState = {
  version: "v1.0";
  timestamp: string;
  categories: {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
  };
};

export const CONSENT_COOKIE_NAME = "cookie_consent_state";
export const ROOT_DOMAIN = ".sriuthonghotels.com";

export const DEFAULT_CONSENT_STATE: CookieConsentState = {
  version: "v1.0",
  timestamp: new Date().toISOString(),
  categories: {
    necessary: true,
    analytics: false,
    marketing: false,
  },
};

export function getCookieConsentState(): CookieConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp('(^| )' + CONSENT_COOKIE_NAME + '=([^;]+)'));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2])) as CookieConsentState;
    } catch (e) {
      console.error("Failed to parse consent cookie", e);
    }
  }
  return null;
}

function getCookieDomain(): string {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  if (hostname.endsWith("sriuthonghotels.com")) {
    return "; domain=.sriuthonghotels.com";
  }
  return "";
}

export function setCookieConsentState(state: CookieConsentState) {
  if (typeof document === "undefined") return;
  const encodedState = encodeURIComponent(JSON.stringify(state));
  const maxAge = 31536000; // 1 year
  const domainAttr = getCookieDomain();
  const secureAttr = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodedState}${domainAttr}; path=/; max-age=${maxAge}; SameSite=Lax${secureAttr}`;
  
  // Also push to dataLayer for Google Consent Mode v2
  if (typeof window !== "undefined") {
    const dataLayer = (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) { dataLayer.push(args); }
    
    gtag('consent', 'update', {
      'analytics_storage': state.categories.analytics ? 'granted' : 'denied',
      'ad_storage': state.categories.marketing ? 'granted' : 'denied',
      'ad_user_data': state.categories.marketing ? 'granted' : 'denied',
      'ad_personalization': state.categories.marketing ? 'granted' : 'denied',
    });
  }
}
