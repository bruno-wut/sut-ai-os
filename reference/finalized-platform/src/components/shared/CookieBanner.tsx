"use client";

import { useEffect, useState } from "react";
import { 
  type CookieConsentState, 
  DEFAULT_CONSENT_STATE, 
  getCookieConsentState, 
  setCookieConsentState 
} from "@/lib/cookie-consent";

interface CookieBannerProps {
  initialState: CookieConsentState | null;
}

export function CookieBanner({ initialState }: CookieBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentState["categories"]>(
    initialState?.categories ?? DEFAULT_CONSENT_STATE.categories
  );

  useEffect(() => {
    // Show the banner if there is no consent cookie found on the client
    const currentState = getCookieConsentState();
    if (!currentState) {
      setShowBanner(true);
    }
  }, []);

  // Expose a global method to open settings from the footer
  useEffect(() => {
    (window as any).openCookieSettings = () => {
      const currentState = getCookieConsentState();
      if (currentState) {
        setPreferences(currentState.categories);
      }
      setShowModal(true);
    };
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const handleAcceptAll = () => {
    const newState: CookieConsentState = {
      version: "v1.0",
      timestamp: new Date().toISOString(),
      categories: {
        necessary: true,
        analytics: true,
        marketing: true,
      },
    };
    setCookieConsentState(newState);
    setShowBanner(false);
    setShowModal(false);
  };

  const handleRejectAll = () => {
    const newState: CookieConsentState = {
      version: "v1.0",
      timestamp: new Date().toISOString(),
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
    };
    setCookieConsentState(newState);
    setShowBanner(false);
    setShowModal(false);
  };

  const handleSavePreferences = () => {
    const newState: CookieConsentState = {
      version: "v1.0",
      timestamp: new Date().toISOString(),
      categories: preferences,
    };
    setCookieConsentState(newState);
    setShowBanner(false);
    setShowModal(false);
  };

  if (!showBanner && !showModal) return null;

  return (
    <>
      {showBanner && !showModal && (
        <div className="ibe-cookie-banner">
          <div className="ibe-cookie-banner__inner">
            <div className="ibe-cookie-banner__text">
              <h3 className="ibe-cookie-banner__heading">สัมผัสประสบการณ์การพักผ่อนที่ออกแบบมาเพื่อคุณ</h3>
              <p>
                เราใช้คุกกี้เพื่อพัฒนาประสิทธิภาพการใช้งาน นำเสนอข้อเสนอพิเศษ และมอบประสบการณ์การจองห้องพักที่ราบรื่น (We use cookies to analyze site traffic, optimize your reservation journey, and present tailored room offers.)
              </p>
              <a href="/legal/privacy" className="ibe-cookie-banner__link">
                อ่านนโยบายความเป็นส่วนตัว / Read Privacy Policy
              </a>
            </div>
            <div className="ibe-cookie-banner__actions">
              <button
                onClick={handleAcceptAll}
                className="ibe-cookie-btn ibe-cookie-btn--primary"
              >
                ยอมรับทั้งหมด / Accept All
              </button>
              <button
                onClick={handleRejectAll}
                className="ibe-cookie-btn ibe-cookie-btn--secondary"
              >
                ปฏิเสธทั้งหมด / Reject All
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="ibe-cookie-btn ibe-cookie-btn--custom"
              >
                ตั้งค่าคุกกี้ / Cookie Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="ibe-cookie-modal">
          <div className="ibe-cookie-modal__backdrop" onClick={() => setShowModal(false)} />
          <div className="ibe-cookie-modal__content">
            <button 
              onClick={() => setShowModal(false)} 
              className="ibe-cookie-modal__close"
              aria-label="Close"
            >
              &times;
            </button>
            <h2>ตั้งค่าคุกกี้ / Cookie Preferences</h2>
            <div className="ibe-cookie-options">
              <div className="ibe-cookie-option">
                <div>
                  <h3>คุกกี้ที่จำเป็น (Strictly Necessary Cookies)</h3>
                  <p>จำเป็นต่อการทำงานของระบบจองห้องพัก การรักษาความปลอดภัย และการชำระเงิน (Always Active)</p>
                </div>
                <div className="ibe-cookie-toggle-badge">ALWAYS ACTIVE</div>
              </div>
              
              <div className="ibe-cookie-option">
                <div>
                  <h3>คุกกี้เพื่อการวิเคราะห์ (Analytics Cookies)</h3>
                  <p>ช่วยให้เราเข้าใจพฤติกรรมผู้เข้าชมเว็บไซต์เพื่อปรับปรุงบริการ (Google Analytics)</p>
                </div>
                <button 
                  onClick={() => setPreferences(p => ({...p, analytics: !p.analytics}))}
                  className={`ibe-cookie-toggle ${preferences.analytics ? 'ibe-cookie-toggle--active' : ''}`}
                  type="button"
                  aria-pressed={preferences.analytics}
                >
                  <span className="ibe-cookie-toggle__thumb" />
                </button>
              </div>

              <div className="ibe-cookie-option">
                <div>
                  <h3>คุกกี้เพื่อการตลาด (Marketing Cookies)</h3>
                  <p>ใช้สำหรับการแสดงโฆษณาและข้อเสนอพิเศษที่ตรงกับความสนใจของคุณ (Google Ads)</p>
                </div>
                <button 
                  onClick={() => setPreferences(p => ({...p, marketing: !p.marketing}))}
                  className={`ibe-cookie-toggle ${preferences.marketing ? 'ibe-cookie-toggle--active' : ''}`}
                  type="button"
                  aria-pressed={preferences.marketing}
                >
                  <span className="ibe-cookie-toggle__thumb" />
                </button>
              </div>
            </div>
            
            <button
              onClick={handleSavePreferences}
              className="ibe-cookie-btn ibe-cookie-btn--primary ibe-cookie-btn--full"
            >
              บันทึกการตั้งค่า / Save Preferences
            </button>
          </div>
        </div>
      )}
    </>
  );
}
