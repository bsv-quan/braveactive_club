"use client";

import { AlertTriangle, HelpCircle, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/i18n-provider";

export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

export type AlertOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  tone?: "default" | "info";
};

type ActiveDialog =
  | {
      kind: "confirm";
      options: ConfirmOptions;
      resolve: (confirmed: boolean) => void;
    }
  | {
      kind: "alert";
      options: AlertOptions;
      resolve: () => void;
    };

type DialogContextValue = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

/** Global styled confirmation and notice modal replacing browser window.confirm / window.alert. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const activeRef = useRef<ActiveDialog | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  activeRef.current = active;

  const confirm = useCallback((input: ConfirmOptions | string) => {
    const options: ConfirmOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<boolean>((resolve) => {
      if (activeRef.current) {
        if (activeRef.current.kind === "confirm") activeRef.current.resolve(false);
        else activeRef.current.resolve();
      }
      setActive({ kind: "confirm", options, resolve });
    });
  }, []);

  const alert = useCallback((input: AlertOptions | string) => {
    const options: AlertOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<void>((resolve) => {
      if (activeRef.current) {
        if (activeRef.current.kind === "confirm") activeRef.current.resolve(false);
        else activeRef.current.resolve();
      }
      setActive({ kind: "alert", options, resolve });
    });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) {
      dialog.showModal();
    } else if (!active && dialog.open) {
      dialog.close();
    }
  }, [active]);

  useEffect(() => () => {
    if (activeRef.current) {
      if (activeRef.current.kind === "confirm") activeRef.current.resolve(false);
      else activeRef.current.resolve();
    }
  }, []);

  function finish(accepted: boolean) {
    const current = activeRef.current;
    if (!current) return;
    activeRef.current = null;
    setActive(null);
    if (current.kind === "confirm") {
      current.resolve(accepted);
    } else {
      current.resolve();
    }
  }

  const tone = active?.options.tone ?? (active?.kind === "alert" ? "info" : "default");
  const Icon = tone === "danger" ? AlertTriangle : active?.kind === "alert" ? Info : HelpCircle;
  const title =
    active?.options.title ??
    (active?.kind === "alert" ? t("common.noticeTitle") : t("common.confirmTitle"));
  const confirmLabel =
    active?.options.confirmLabel ??
    (active?.kind === "alert" ? t("common.ok") : t("common.confirm"));
  const cancelLabel =
    active?.kind === "confirm" ? (active.options.cancelLabel ?? t("common.cancel")) : null;

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <dialog
        ref={dialogRef}
        className={`app-confirm-dialog tone-${tone}`}
        aria-labelledby="app-confirm-dialog-title"
        aria-describedby="app-confirm-dialog-message"
        onCancel={(event) => {
          event.preventDefault();
          finish(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) finish(false);
        }}
      >
        {active ? (
          <div className="app-confirm-dialog-inner">
            <div className="app-confirm-dialog-top">
              <span className={`app-confirm-dialog-icon tone-${tone}`} aria-hidden="true">
                <Icon size={22} />
              </span>
              <div className="app-confirm-dialog-copy">
                <h2 id="app-confirm-dialog-title">{title}</h2>
                <p id="app-confirm-dialog-message">{active.options.message}</p>
              </div>
              <button
                type="button"
                className="ui-icon-button app-confirm-dialog-close"
                aria-label={t("common.close")}
                onClick={() => finish(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="app-confirm-dialog-actions">
              {cancelLabel ? (
                <button
                  type="button"
                  className="button-secondary app-confirm-btn"
                  onClick={() => finish(false)}
                >
                  {cancelLabel}
                </button>
              ) : null}
              <button
                type="button"
                className={`app-confirm-btn ${tone === "danger" ? "app-confirm-danger" : "button-primary"}`}
                autoFocus
                onClick={() => finish(true)}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used inside DialogProvider");
  }
  return ctx;
}
