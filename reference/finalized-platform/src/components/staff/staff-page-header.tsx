import type { ReactNode } from "react";

type StaffPageHeaderProps = Readonly<{
  action?: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}>;

export function StaffPageHeader({
  action,
  description,
  eyebrow,
  title,
}: StaffPageHeaderProps) {
  return (
    <header className="staff-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
