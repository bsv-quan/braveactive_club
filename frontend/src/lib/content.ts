import type { Translate } from "@/lib/club-ui";

export type ClubAnnouncement = {
  id: string;
  category: string;
  title: string;
  description: string;
  date: string;
  color: "mint" | "peach" | "lavender";
};

export type ClubPost = {
  id: string;
  category: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
};

/** Seed content; text comes from the dictionary so it follows the active language. */
export function getInitialAnnouncements(t: Translate): ClubAnnouncement[] {
  return [
    {
      id: "welcome",
      category: "CÂU LẠC BỘ",
      title: t("club.announcements.welcome.title"),
      description: t("club.announcements.welcome.description"),
      date: "2026-10-28",
      color: "mint",
    },
  ];
}

export function getInitialPosts(t: Translate): ClubPost[] {
  return [
    {
      id: "badminton-beginners",
      category: "CẦU LÔNG",
      title: t("club.posts.beginners.title"),
      description: t("club.posts.beginners.description"),
      date: "2026-10-26",
      readTime: t("club.posts.beginners.readTime"),
    },
    {
      id: "weekend-run",
      category: "THỂ THAO",
      title: t("club.posts.weekendRun.title"),
      description: t("club.posts.weekendRun.description"),
      date: "2026-10-23",
      readTime: t("club.posts.weekendRun.readTime"),
    },
    {
      id: "community-day",
      category: "TỪ THIỆN",
      title: t("club.posts.communityDay.title"),
      description: t("club.posts.communityDay.description"),
      date: "2026-10-20",
      readTime: t("club.posts.communityDay.readTime"),
    },
  ];
}
