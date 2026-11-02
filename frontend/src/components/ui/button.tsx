import { Loader2, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: LucideIcon;
  loading?: boolean;
};

/** Standard button with optional leading icon and loading state. */
export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`ui-button ui-button-${variant} ui-button-${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="ui-spin" size={16} aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
};

/** Icon-only button; `label` is used for accessibility and tooltip. */
export function IconButton({ icon: Icon, label, active = false, className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={`ui-icon-button ${active ? "is-active" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
