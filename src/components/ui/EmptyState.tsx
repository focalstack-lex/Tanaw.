import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  /** One sentence (spec 8.4). */
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {title && <p className="empty-title">{title}</p>}
      <p className="empty-message">{message}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
