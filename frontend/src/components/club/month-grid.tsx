"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import { weekdayShortKeys } from "@/lib/club-ui";

type MonthGridProps = {
  days: Date[];
  className: string;
  renderDay: (day: Date) => ReactNode;
};

export function MonthGrid({ days, className, renderDay }: MonthGridProps) {
  const { t } = useI18n();
  return (
    <div className={className}>
      {weekdayShortKeys.map((key) => (
        <span className="weekday" key={key}>{t(key)}</span>
      ))}
      {days.map(renderDay)}
    </div>
  );
}
