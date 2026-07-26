export const CONSENT_COOKIE_NAME = "cookie_consent_state";
export const ROOT_DOMAIN = ".sriuthonghotels.com";

export const DEFAULT_CONSENT_STATE = {
  version: "v1.0",
  timestamp: new Date().toISOString(),
  categories: {
    necessary: true,
    analytics: false,
    marketing: false,
  },
};

export function getCookieConsentState() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp('(^| )' + CONSENT_COOKIE_NAME + '=([^;]+)'));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch (e) {
      console.error("Failed to parse consent cookie", e);
    }
  }
  return null;
}

function getCookieDomain() {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  if (hostname.endsWith("sriuthonghotels.com")) {
    return "; domain=.sriuthonghotels.com";
  }
  return "";
}

export function setCookieConsentState(state) {
  if (typeof document === "undefined") return;
  const encodedState = encodeURIComponent(JSON.stringify(state));
  const maxAge = 31536000; // 1 year
  const domainAttr = getCookieDomain();
  const secureAttr = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodedState}${domainAttr}; path=/; max-age=${maxAge}; SameSite=Lax${secureAttr}`;
  
  if (typeof window !== "undefined") {
    const dataLayer = window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    
    gtag('consent', 'update', {
      'analytics_storage': state.categories.analytics ? 'granted' : 'denied',
      'ad_storage': state.categories.marketing ? 'granted' : 'denied',
      'ad_user_data': state.categories.marketing ? 'granted' : 'denied',
      'ad_personalization': state.categories.marketing ? 'granted' : 'denied',
    });
    
    // Trigger custom event so Partytown scripts might re-evaluate if needed
    window.dispatchEvent(new CustomEvent('cookie_consent_updated', { detail: state }));
  }
}
