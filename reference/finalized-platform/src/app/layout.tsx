import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Serif_Thai, Trirong } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { LocaleProvider } from "@/components/localization/locale-provider";
import { CookieBanner } from "@/components/shared/CookieBanner";
import { type CookieConsentState } from "@/lib/cookie-consent";
import { isLocale } from "@/lib/i18n/config";

import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
});

const bodyFont = Noto_Serif_Thai({
  subsets: ["latin", "thai"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const thaiDisplayFont = Trirong({
  subsets: ["latin", "thai"],
  variable: "--font-display-thai",
  weight: ["400", "500"],
});

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://secure.sriuthonghotels.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Sri U-Thong Grand Hotel",
    template: "%s | Sri U-Thong Grand Hotel",
  },
  description: "Direct reservations and hotel inventory operations.",
  alternates: {
    canonical: `${appUrl}/en/`,
    languages: {
      en: `${appUrl}/en/`,
      th: `${appUrl}/th/`,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Sri U-Thong Grand Hotel",
    title: "Sri U-Thong Grand Hotel",
    description: "Direct reservations and hotel inventory operations.",
    url: `${appUrl}/en/`,
    images: [{ url: "/images/grand-exterior.jpg", width: 1800, height: 1200, alt: "Sri U-Thong Grand Hotel exterior" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sri U-Thong Grand Hotel",
    description: "Direct reservations and hotel inventory operations.",
    images: ["/images/grand-exterior.jpg"],
  },
  icons: {
    icon: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  
  const requestedLocale = headerStore.get("x-sut-locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  
  let initialConsentState: CookieConsentState | null = null;
  const cookieVal = cookieStore.get("cookie_consent_state")?.value;
  if (cookieVal) {
    try {
      initialConsentState = JSON.parse(decodeURIComponent(cookieVal)) as CookieConsentState;
    } catch (e) {}
  }

  return (
    <html className={`${displayFont.variable} ${thaiDisplayFont.variable} ${bodyFont.variable}`} lang={locale}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                'analytics_storage': 'denied',
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'wait_for_update': 500
              });
            `,
          }}
        />
      </head>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        <CookieBanner initialState={initialConsentState} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Hotel",
              name: "Sri U-Thong Grand Hotel",
              url: "https://sriuthonggrand.com",
              telephone: "+66 35 502 293",
              email: "reservations@sriuthonghotels.com",
              address: { "@type": "PostalAddress", streetAddress: "19 Nangpim Road, T. Tha Pee Liang, A. Muang", addressLocality: "Suphanburi", postalCode: "72000", addressCountry: "TH" },
            }),
          }}
        />
      </body>
    </html>
  );
}
