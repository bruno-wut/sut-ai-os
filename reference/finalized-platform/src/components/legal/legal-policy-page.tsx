import { headers } from "next/headers";

import { isLocale } from "@/lib/i18n/config";
import { getLegalPolicy, type LegalPolicyKey } from "@/lib/legal/policies";

type LegalPolicyPageProps = Readonly<{
  policy: LegalPolicyKey;
}>;

export async function LegalPolicyPage({ policy }: LegalPolicyPageProps) {
  const headerStore = await headers();
  const requestedLocale = headerStore.get("x-sut-locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const content = getLegalPolicy(policy, locale);

  return (
    <main className="legal-page" id="guest-content">
      <section className="legal-document" aria-labelledby="legal-title">
        <p className="eyebrow">Sri U-Thong Grand Hotel</p>
        <h1 className="display-title" id="legal-title">{content.title}</h1>
        <p className="legal-document__version">Version {content.version}</p>
        <div className="legal-document__body">
          {content.blocks.map((block, index) => {
            if (block.type === "paragraph") return <p key={`${block.type}-${index}`}>{block.text}</p>;
            if (block.type === "heading") return <h2 key={`${block.type}-${index}`}>{block.text}</h2>;
            if (block.type === "divider") return <hr key={`${block.type}-${index}`} />;
            return (
              <ul key={`${block.type}-${index}`}>
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            );
          })}
        </div>
      </section>
    </main>
  );
}
