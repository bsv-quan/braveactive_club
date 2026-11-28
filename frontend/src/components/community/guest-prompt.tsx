"use client";

import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n/i18n-provider";

/** Compact editorial sign-in bar for visitors so lead news stays above the fold. */
export function GuestPrompt() {
  const { t } = useI18n();
  return (
    <div className="guest-prompt">
      <div className="guest-prompt-copy">
        <span className="guest-prompt-kicker">{t("community.guest.kicker")}</span>
        <p>{t("community.guest.prompt")}</p>
      </div>
      <div className="guest-prompt-actions">
        <Link className="ui-button ui-button-primary ui-button-sm" href="/login?next=/community">
          <LogIn size={15} aria-hidden="true" /> {t("community.guest.login")}
        </Link>
        <Link className="ui-button ui-button-secondary ui-button-sm" href="/register?next=/community">
          <UserPlus size={15} aria-hidden="true" /> {t("community.guest.register")}
        </Link>
      </div>
    </div>
  );
}
