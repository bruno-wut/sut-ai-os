import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const docsDir = path.join(projectRoot, "docs");
const legalDir = path.join(projectRoot, "src", "lib", "legal");

function escapeString(content) {
  return content
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
}

async function main() {
  try {
    // English
    console.log("Bundling English policies...");
    const privacyEn = await readFile(path.join(docsDir, "privacy_policy_final.md"), "utf8");
    const termsEn = await readFile(path.join(docsDir, "sri-u-thong-grand-hotel-booking-terms-v1.5.md"), "utf8");
    const cancellationEn = await readFile(path.join(docsDir, "sri-u-thong-grand-hotel-cancellation-refund-policy-v1.1.md"), "utf8");

    const enContent = `// Automatically generated from docs/. Do not edit directly.

export const enPrivacyPolicyMarkdown = \`${escapeString(privacyEn)}\`;

export const enBookingTermsMarkdown = \`${escapeString(termsEn)}\`;

export const enCancellationPolicyMarkdown = \`${escapeString(cancellationEn)}\`;
`;
    await writeFile(path.join(legalDir, "en-policy-markdown.ts"), enContent, "utf8");

    // Thai
    console.log("Bundling Thai policies...");
    const privacyTh = await readFile(path.join(docsDir, "privacy_policy_thai.md"), "utf8");
    const termsTh = await readFile(path.join(docsDir, "sri-u-thong-grand-hotel-booking-terms-v1.5-th.md"), "utf8");
    const cancellationTh = await readFile(path.join(docsDir, "sri-u-thong-grand-hotel-cancellation-refund-policy-v1.1-th.md"), "utf8");

    const thContent = `// Automatically generated from docs/. Do not edit directly.

export const thaiPrivacyPolicyMarkdown = \`${escapeString(privacyTh)}\`;

export const thaiBookingTermsMarkdown = \`${escapeString(termsTh)}\`;

export const thaiCancellationPolicyMarkdown = \`${escapeString(cancellationTh)}\`;
`;
    await writeFile(path.join(legalDir, "thai-policy-markdown.ts"), thContent, "utf8");

    console.log("Success! Legal policies bundled.");
  } catch (error) {
    console.error("Failed to bundle legal policies:", error);
    process.exit(1);
  }
}

main();
