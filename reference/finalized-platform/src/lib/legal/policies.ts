import "server-only";

import type { Locale } from "@/lib/i18n/config";
import { LEGAL_VERSIONS } from "@/lib/legal/legal-versions";
import {
  enBookingTermsMarkdown,
  enCancellationPolicyMarkdown,
  enPrivacyPolicyMarkdown,
} from "@/lib/legal/en-policy-markdown";
import {
  thaiBookingTermsMarkdown,
  thaiCancellationPolicyMarkdown,
  thaiPrivacyPolicyMarkdown,
} from "@/lib/legal/thai-policy-markdown";
import { SITE_CONFIG } from "@/lib/site-config";

export type LegalPolicyKey = "terms" | "privacy" | "cancellation";

export type LegalPolicyBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "divider" };

type LocalizedLegalPolicy = Readonly<{
  title: string;
  version: string;
  blocks: LegalPolicyBlock[];
}>;

type LegalPolicyDefinition = Readonly<{
  en: LocalizedLegalPolicy;
  th?: LocalizedLegalPolicy;
}>;

const THAI_POLICY_PLACEHOLDERS = {
  __PRIVACY_EMAIL__: SITE_CONFIG.contact.privacyEmail,
  __PRIVACY_PHONE__: SITE_CONFIG.contact.phoneDisplay,
  __RESERVATIONS_EMAIL__: SITE_CONFIG.contact.reservationsEmail,
  __RESERVATIONS_PHONE__: SITE_CONFIG.contact.phoneDisplay,
} as const;

function hydrateThaiPolicyMarkdown(markdown: string) {
  return Object.entries(THAI_POLICY_PLACEHOLDERS).reduce(
    (content, [token, value]) => content.replaceAll(token, value),
    markdown,
  );
}

function normalizeInlineMarkdown(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

function markdownToBlocks(markdown: string): LegalPolicyBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: LegalPolicyBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({ type: "paragraph", text: normalizeInlineMarkdown(paragraphBuffer.join(" ").trim()) });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push({ type: "list", items: listBuffer.map((item) => normalizeInlineMarkdown(item)) });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line === "---") {
      flushParagraph();
      flushList();
      blocks.push({ type: "divider" });
      continue;
    }

    if (line.startsWith("## ") || line.startsWith("### ")) {
      flushParagraph();
      flushList();
      const headingText = line.startsWith("### ") ? line.slice(4) : line.slice(3);
      blocks.push({ type: "heading", text: normalizeInlineMarkdown(headingText) });
      continue;
    }

    if (line.startsWith("* ") || line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2));
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

const LEGAL_POLICIES: Record<LegalPolicyKey, LegalPolicyDefinition> = {
  terms: {
    en: {
      title: "Booking Terms & Conditions",
      version: LEGAL_VERSIONS.terms,
      blocks: markdownToBlocks(enBookingTermsMarkdown),
    },
    th: {
      title: "ข้อกำหนดและเงื่อนไขการสำรองห้องพักและการจองออนไลน์สำหรับผู้เข้าพัก",
      version: LEGAL_VERSIONS.terms,
      blocks: markdownToBlocks(hydrateThaiPolicyMarkdown(thaiBookingTermsMarkdown)),
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy",
      version: LEGAL_VERSIONS.privacyPolicy,
      blocks: markdownToBlocks(enPrivacyPolicyMarkdown),
    },
    th: {
      title: "นโยบายความเป็นส่วนตัว",
      version: LEGAL_VERSIONS.privacyPolicy,
      blocks: markdownToBlocks(hydrateThaiPolicyMarkdown(thaiPrivacyPolicyMarkdown)),
    },
  },
  cancellation: {
    en: {
      title: "Cancellation Policy",
      version: LEGAL_VERSIONS.cancellationPolicy,
      blocks: markdownToBlocks(enCancellationPolicyMarkdown),
    },
    th: {
      title: "นโยบายการยกเลิกและการคืนเงิน",
      version: LEGAL_VERSIONS.cancellationPolicy,
      blocks: markdownToBlocks(hydrateThaiPolicyMarkdown(thaiCancellationPolicyMarkdown)),
    },
  },
};

export function getLegalPolicy(policy: LegalPolicyKey, locale: Locale): LocalizedLegalPolicy {
  const entry = LEGAL_POLICIES[policy];
  return locale === "th" && entry.th ? entry.th : entry.en;
}
