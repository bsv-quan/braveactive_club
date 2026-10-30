import type { ReactNode } from "react";
import { weekdayNames } from "@/lib/club-ui";

type MonthGridProps = {
  days: Date[];
  className: string;
  renderDay: (day: Date) => ReactNode;
};

export function MonthGrid({ days, className, renderDay }: MonthGridProps) {
  return (
    <div className={className}>
      {weekdayNames.map((day) => (
        <span className="weekday" key={day}>{day}</span>
      ))}
      {days.map(renderDay)}
    </div>
  );
}
