import { LegalPolicyPage } from "@/components/legal/legal-policy-page";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return <LegalPolicyPage policy="privacy" />;
}
