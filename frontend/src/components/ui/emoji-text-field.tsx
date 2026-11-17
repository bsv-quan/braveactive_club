"use client";

import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/i18n-provider";

const EMOJIS = ["😀", "😃", "😄", "😁", "😂", "😊", "😍", "🥰", "😘", "😉", "😎", "🤔", "😢", "😭", "😡", "👍", "👏", "🙏", "❤️", "🎉", "🔥", "💪", "⚽", "🏸"];

const EMOTICONS: Array<[RegExp, string]> = [
  [/:-\)/gi, "🙂"],
  [/:\)/g, "🙂"],
  [/:-\(/g, "🙁"],
  [/:\(/g, "🙁"],
  [/:-D/gi, "😄"],
  [/:D/gi, "😄"],
  [/;-\)/g, "😉"],
  [/;\)/g, "😉"],
  [/:-P/gi, "😛"],
  [/:P/gi, "😛"],
  [/<3/g, "❤️"],
];

function parseEmoticons(value: string) {
  return EMOTICONS.reduce((text, [pattern, emoji]) => text.replace(pattern, emoji), value);
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label": string;
  maxLength: number;
  multiline?: boolean;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  autoResize?: boolean;
};

/** Controlled text field with an emoji picker and common emoticon conversion. */
export function EmojiTextField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  maxLength,
  multiline = false,
  rows = 3,
  className,
  autoFocus,
  autoResize = false,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!multiline || !autoResize) return;
    const field = fieldRef.current;
    if (!(field instanceof HTMLTextAreaElement)) return;

    const resizeField = () => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    };
    resizeField();
    const observer = new ResizeObserver(resizeField);
    observer.observe(field.parentElement ?? field);
    return () => observer.disconnect();
  }, [autoResize, multiline, value]);

  function updateValue(field: HTMLInputElement | HTMLTextAreaElement) {
    const cursor = field.selectionStart ?? field.value.length;
    const parsed = parseEmoticons(field.value);
    onChange(parsed);
    const nextCursor = parseEmoticons(field.value.slice(0, cursor)).length;
    requestAnimationFrame(() => fieldRef.current?.setSelectionRange(nextCursor, nextCursor));
  }

  function insertEmoji(emoji: string) {
    const field = fieldRef.current;
    if (!field) return;
    const start = field.selectionStart ?? value.length;
    const end = field.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      fieldRef.current?.focus();
      const cursor = start + emoji.length;
      fieldRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  const fieldClassName = ["emoji-text-field", className].filter(Boolean).join(" ");

  return (
    <div className={`emoji-field-wrap${multiline ? " emoji-field-multiline" : ""}`}>
      {multiline ? (
        <textarea
          ref={(element) => { fieldRef.current = element; }}
          className={fieldClassName}
          value={value}
          onChange={(event) => updateValue(event.currentTarget)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          style={autoResize ? { overflow: "hidden", resize: "none" } : undefined}
        />
      ) : (
        <input
          ref={(element) => { fieldRef.current = element; }}
          className={fieldClassName}
          value={value}
          onChange={(event) => updateValue(event.currentTarget)}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
        />
      )}
      <button
        ref={pickerButtonRef}
        className="emoji-picker-trigger"
        type="button"
        aria-label={t("common.emojiPicker")}
        aria-expanded={open}
        title={t("common.emojiPicker")}
        onClick={() => setOpen((current) => !current)}
      >
        <Smile size={19} aria-hidden />
      </button>
      {open ? (
        <div className="emoji-picker-panel" role="group" aria-label={t("common.emojiPicker")}>
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={t("common.chooseEmoji", { emoji })}
              onClick={() => insertEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="emoji-picker-dismiss"
            onClick={() => {
              setOpen(false);
              pickerButtonRef.current?.focus();
            }}
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
