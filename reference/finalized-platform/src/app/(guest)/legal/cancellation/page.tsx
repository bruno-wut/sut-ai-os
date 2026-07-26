import { LegalPolicyPage } from "@/components/legal/legal-policy-page";

export const metadata = {
  title: "Cancellation Policy",
};

export default function CancellationPage() {
  return <LegalPolicyPage policy="cancellation" />;
}
