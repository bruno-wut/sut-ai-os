import { SITE_LEGAL_PATHS } from "@/lib/site-config";

export const LEGAL_VERSIONS = {
  terms: process.env.NEXT_PUBLIC_LEGAL_TERMS_VERSION || "1.5 · 2026-07-05",
  privacyPolicy: process.env.NEXT_PUBLIC_LEGAL_PRIVACY_POLICY_VERSION || "2026-06-29",
  cancellationPolicy: process.env.NEXT_PUBLIC_LEGAL_CANCELLATION_POLICY_VERSION || "1.1 · 2026-07-05",
} as const;

export const LEGAL_DOCUMENT_LINKS = SITE_LEGAL_PATHS;
