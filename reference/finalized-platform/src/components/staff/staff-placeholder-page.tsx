import { Database } from "lucide-react";

import { StaffPageHeader } from "@/components/staff/staff-page-header";

type StaffPlaceholderPageProps = Readonly<{
  description: string;
  eyebrow: string;
  title: string;
}>;

export function StaffPlaceholderPage({
  description,
  eyebrow,
  title,
}: StaffPlaceholderPageProps) {
  return (
    <>
      <StaffPageHeader description={description} eyebrow={eyebrow} title={title} />
      <section className="staff-panel staff-placeholder">
        <div className="empty-state">
          <div>
            <Database aria-hidden="true" size={28} strokeWidth={1.5} />
            <strong>Data connection is the next step</strong>
            <p>This route is ready for its validated Supabase workflow.</p>
          </div>
        </div>
      </section>
    </>
  );
}
