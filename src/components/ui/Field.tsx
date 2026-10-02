import { cloneElement, useId, type ReactElement } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  /** A single form control; it receives the generated id for the label. */
  children: ReactElement<{ id?: string }>;
}

export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-text">
        <label htmlFor={id} className="field-label">{label}</label>
        {hint && <p className="field-hint">{hint}</p>}
      </div>
      <div className="field-control">{cloneElement(children, { id })}</div>
    </div>
  );
}
