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

export const activityAnnouncementsKey = "braveactive:activity-announcements";

export const initialAnnouncements: ClubAnnouncement[] = [
  {
    id: "welcome",
    category: "CÂU LẠC BỘ",
    title: "Chào mừng bạn đến với Brave Active",
    description:
      "Nơi kết nối những thành viên yêu vận động, sẻ chia và cùng nhau tạo nên những hoạt động ý nghĩa.",
    date: "2026-10-28",
    color: "mint",
  },
];

export const initialPosts: ClubPost[] = [
  {
    id: "badminton-beginners",
    category: "CẦU LÔNG",
    title: "Buổi giao lưu cầu lông cho mọi trình độ",
    description:
      "Không cần là tay vợt chuyên nghiệp — chỉ cần bạn muốn chơi và gặp gỡ mọi người.",
    date: "2026-10-26",
    readTime: "3 phút đọc",
  },
  {
    id: "weekend-run",
    category: "THỂ THAO",
    title: "Cuối tuần năng động, bắt đầu từ một bước chân",
    description:
      "Cùng các thành viên duy trì thói quen vận động và tiếp thêm năng lượng tích cực.",
    date: "2026-10-23",
    readTime: "2 phút đọc",
  },
  {
    id: "community-day",
    category: "TỪ THIỆN",
    title: "Một ngày sẻ chia cùng cộng đồng",
    description:
      "Những hoạt động nhỏ sẽ trở nên ý nghĩa hơn khi chúng ta cùng góp sức.",
    date: "2026-10-20",
    readTime: "4 phút đọc",
  },
];
