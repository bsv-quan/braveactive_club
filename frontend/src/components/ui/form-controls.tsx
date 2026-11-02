import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, type InputHTMLAttributes } from "react";
import { reportGlobalError } from "@/lib/api/client";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  hint?: string;
};

/** Labelled input with an optional leading icon. */
export function TextField({ label, icon: Icon, hint, id, name, ...props }: TextFieldProps) {
  const inputId = id ?? name;
  return (
    <div className="ui-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="ui-input-wrap">
        {Icon ? <Icon size={18} aria-hidden /> : null}
        <input id={inputId} name={name} className={Icon ? "has-icon" : ""} {...props} />
      </div>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

type AlertProps = { tone: "error" | "success"; children: React.ReactNode };

/** Inline feedback banner (errors are announced to screen readers). */
export function Alert({ tone, children }: AlertProps) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  useEffect(() => {
    if (tone === "error" && typeof children === "string") {
      reportGlobalError(children);
    }
  }, [children, tone]);

  return (
    <div className={`ui-alert ui-alert-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden />
      <span>{children}</span>
    </div>
  );
}
