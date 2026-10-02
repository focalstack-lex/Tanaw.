import type { ComponentProps } from "react";

interface IconButtonProps extends ComponentProps<"button"> {
  /** Accessible name; also the tooltip. */
  label: string;
  active?: boolean;
}

export function IconButton({ label, active, className, type = "button", children, ...rest }: IconButtonProps) {
  const classes = ["icon-btn", active ? "is-active" : "", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} aria-label={label} title={label} aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
