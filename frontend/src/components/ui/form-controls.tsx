import type { LucideIcon } from "lucide-react";
import { AlertCircle, Check, CheckCircle2, Copy, Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import { reportGlobalError } from "@/lib/api/client";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  trailing?: ReactNode;
};

/** Labelled input with an optional leading icon. */
export function TextField({ label, icon: Icon, hint, trailing, id, name, className, ...props }: TextFieldProps) {
  const inputId = id ?? name;
  const inputClassName = [Icon && "has-icon", trailing && "has-trailing", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="ui-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="ui-input-wrap">
        {Icon ? <Icon size={18} aria-hidden /> : null}
        <input id={inputId} name={name} className={inputClassName} {...props} />
        {trailing}
      </div>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing"> & {
  onCopy?: () => void;
  copyDisabled?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  copied?: boolean;
};

/** Password input with an accessible control to reveal or conceal its value. */
export function PasswordField({ onCopy, copyDisabled = false, copyLabel, copiedLabel, copied = false, ...props }: PasswordFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const visibilityLabel = t(visible ? "common.hidePassword" : "common.showPassword");
  const VisibilityIcon = visible ? EyeOff : Eye;
  const CopyIcon = copied ? Check : Copy;

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <span className={`ui-input-trailing-actions${onCopy ? " has-copy" : ""}`}>
          {onCopy && (
            <button
              type="button"
              className="ui-input-toggle"
              disabled={copyDisabled}
              aria-label={copied ? copiedLabel : copyLabel}
              title={copied ? copiedLabel : copyLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onCopy}
            >
              <CopyIcon size={18} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="ui-input-toggle"
            aria-label={visibilityLabel}
            aria-pressed={visible}
            title={visibilityLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisible((current) => !current)}
          >
            <VisibilityIcon size={18} aria-hidden />
          </button>
        </span>
      }
    />
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
