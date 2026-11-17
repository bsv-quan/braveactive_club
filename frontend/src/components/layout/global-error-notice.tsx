"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/messages/types";
import {
  dismissGlobalError,
  subscribeGlobalErrors,
  type GlobalApiErrorCode,
  type GlobalErrorDetail,
} from "@/lib/api/client";

type Notice = { message: string };

const API_ERROR_KEYS: Record<GlobalApiErrorCode, MessageKey> = {
  network: "common.errors.network",
};

/** Shows the newest application error at the top of every page. */
export function GlobalErrorNotice() {
  const { t } = useI18n();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const handleError = (detail: GlobalErrorDetail) => {
      const message =
        detail.type === "api" ? t(API_ERROR_KEYS[detail.code]) : detail.message;
      setNotice({ message });
    };

    return subscribeGlobalErrors(handleError);
  }, [t]);

  if (!notice) return null;

  return (
    <div className="global-error-notice" role="alert" aria-live="assertive">
      <span>{notice.message}</span>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={() => {
          dismissGlobalError();
          setNotice(null);
        }}
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
