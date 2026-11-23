import type { Locale } from "@/i18n/config";

export type ExercisePosition = "seated" | "standing";
export type ExerciseRegion = "shoulders" | "arms" | "legs" | "whole";
export type ExerciseLevel = 1 | 2 | 3;
export const exerciseGroups = ["neckShoulders", "limbs", "wholeBody"] as const;
export type ExerciseGroup = (typeof exerciseGroups)[number];
export type ExerciseId =
  | "shoulder-lifts" | "shoulder-blades" | "neck-side-tilt" | "chin-tuck" | "wrist-circles"
  | "seated-heel-raises" | "seated-knee-extension" | "sit-to-stand"
  | "standing-heel-raises" | "march-in-place" | "standing-arm-stretch"
  | "elbow-bends" | "seated-toe-raises" | "shoulder-side-raise" | "weighted-shoulder-raise"
  | "supported-side-leg-raise" | "side-step-arms";

type ExerciseText = {
  title: string;
  equipment: string;
  steps: string[];
  note: string;
};

export type Exercise = {
  id: ExerciseId;
  group: ExerciseGroup;
  position: ExercisePosition;
  region: ExerciseRegion;
  level: ExerciseLevel;
  minutes: number;
  text: Record<Locale, ExerciseText>;
};

export type ExerciseFilters = {
  position: ExercisePosition | "all";
  region: ExerciseRegion | "all";
  level: ExerciseLevel | "all";
  duration: "all" | "short" | "longer";
};

export const initialExerciseFilters: ExerciseFilters = {
  position: "all", region: "all", level: "all", duration: "all",
};

/** Match all selected filters; a short exercise lasts at most one minute. */
export function filterExercises(exercises: readonly Exercise[], filters: ExerciseFilters): Exercise[] {
  return exercises.filter((exercise) =>
    (filters.position === "all" || exercise.position === filters.position) &&
    (filters.region === "all" || exercise.region === filters.region) &&
    (filters.level === "all" || exercise.level === filters.level) &&
    (filters.duration === "all" || (filters.duration === "short" ? exercise.minutes <= 1 : exercise.minutes > 1)),
  );
}

/** Order exercises by difficulty without changing the source catalogue. */
export function sortExercisesByLevel(items: readonly Exercise[]): Exercise[] {
  return [...items].sort((a, b) => a.level - b.level);
}

export const exercises: readonly Exercise[] = [
  {
    id: "shoulder-lifts", group: "neckShoulders", position: "seated", region: "shoulders", level: 1, minutes: 1,
    text: {
      vi: { title: "Nâng và thả lỏng vai", equipment: "Ghế vững", steps: ["Ngồi thoải mái, hai bàn chân đặt trên sàn và thả lỏng hai tay.", "Nhẹ nhàng nâng hai vai lên, không gồng cổ.", "Thả vai xuống và thư giãn. Lặp lại chậm khoảng 5 lần."], note: "Không cố nâng vai quá cao, hít thở tự nhiên." },
      en: { title: "Shoulder lifts", equipment: "A stable chair", steps: ["Sit comfortably with both feet on the floor and arms relaxed.", "Gently lift both shoulders without tensing your neck.", "Lower and relax your shoulders. Repeat slowly about 5 times."], note: "Do not force your shoulders up, breathe naturally." },
      ja: { title: "肩の上げ下げ", equipment: "安定した椅子", steps: ["両足を床につけて楽に座り、腕の力を抜きます。", "首に力を入れず、両肩をゆっくり上げます。", "肩を下ろして力を抜きます。ゆっくり約5回繰り返します。"], note: "肩を無理に高く上げず、自然に呼吸しましょう。" },
    },
  },
  {
    id: "shoulder-blades", group: "neckShoulders", position: "seated", region: "shoulders", level: 1, minutes: 1,
    text: {
      vi: { title: "Khép nhẹ bả vai", equipment: "Ghế vững", steps: ["Ngồi thẳng thoải mái, hai tay thả lỏng bên người.", "Nhẹ nhàng đưa hai bả vai về phía nhau, không ưỡn lưng.", "Giữ khoảng 2 giây rồi thả lỏng. Lặp lại khoảng 5 lần."], note: "Giữ vai cách xa tai và không nín thở." },
      en: { title: "Gentle shoulder-blade squeeze", equipment: "A stable chair", steps: ["Sit comfortably upright with your arms at your sides.", "Gently draw your shoulder blades together without arching your back.", "Hold for about 2 seconds, then relax. Repeat about 5 times."], note: "Keep your shoulders away from your ears and breathe normally." },
      ja: { title: "肩甲骨を寄せる", equipment: "安定した椅子", steps: ["楽に背筋を伸ばして座り、腕を体の横に下ろします。", "腰を反らさず、肩甲骨を軽く寄せます。", "約2秒保ってから力を抜きます。約5回繰り返します。"], note: "肩を耳から離し、呼吸を止めないようにしましょう。" },
    },
  },
  {
    id: "neck-side-tilt", group: "neckShoulders", position: "seated", region: "shoulders", level: 1, minutes: 1,
    text: {
      vi: { title: "Nghiêng cổ nhẹ sang hai bên", equipment: "Ghế vững", steps: ["Ngồi thẳng thoải mái, thả lỏng vai và nhìn về phía trước.", "Từ từ nghiêng đầu sang một bên, đưa tai về phía vai mà không nâng vai, giữ khoảng 2 giây.", "Đưa đầu về giữa rồi đổi bên. Lặp lại chậm khoảng 3 lần mỗi bên."], note: "Không dùng tay kéo đầu, chỉ nghiêng trong phạm vi thoải mái. Dừng nếu thấy đau hoặc chóng mặt." },
      en: { title: "Gentle side neck tilts", equipment: "A stable chair", steps: ["Sit comfortably upright, relax your shoulders and look ahead.", "Slowly tilt your head to one side, bringing your ear towards your shoulder without raising it, hold for about 2 seconds.", "Return to the centre and switch sides. Repeat slowly about 3 times on each side."], note: "Do not pull your head with your hands, move only within a comfortable range. Stop if you feel pain or dizziness." },
      ja: { title: "首を左右にゆっくり傾ける", equipment: "安定した椅子", steps: ["楽に背筋を伸ばして座り、肩の力を抜いて前を見ます。", "肩を上げず、耳を肩に近づけるように頭をゆっくり片側へ傾け、約2秒保ちます。", "頭を中央に戻して反対側も行います。左右それぞれゆっくり約3回繰り返します。"], note: "手で頭を引っ張らず、無理のない範囲で動かします。痛みやめまいがあれば中止してください。" },
    },
  },
  {
    id: "chin-tuck", group: "neckShoulders", position: "seated", region: "shoulders", level: 1, minutes: 1,
    text: {
      vi: { title: "Thu cằm nhẹ", equipment: "Ghế vững", steps: ["Ngồi thẳng thoải mái, thả lỏng vai và nhìn thẳng về phía trước.", "Nhẹ nhàng đưa cằm thẳng ra sau như tạo cằm đôi, không cúi hay ngửa đầu, giữ khoảng 2 giây.", "Thả lỏng và đưa đầu về vị trí ban đầu. Lặp lại chậm khoảng 5 lần."], note: "Không ép cằm quá mạnh, dừng nếu thấy đau hoặc chóng mặt." },
      en: { title: "Gentle chin tucks", equipment: "A stable chair", steps: ["Sit comfortably upright, relax your shoulders and look straight ahead.", "Gently draw your chin straight back as if making a double chin, without tipping your head, hold for about 2 seconds.", "Relax and return your head to its starting position. Repeat slowly about 5 times."], note: "Do not force your chin back, stop if you feel pain or dizziness." },
      ja: { title: "あごを軽く引く", equipment: "安定した椅子", steps: ["楽に背筋を伸ばして座り、肩の力を抜いてまっすぐ前を見ます。", "頭を上下に傾けず、二重あごを作るようにあごを真後ろへ軽く引き、約2秒保ちます。", "力を抜いて頭を元の位置に戻します。ゆっくり約5回繰り返します。"], note: "あごを無理に引かず、痛みやめまいがあれば中止してください。" },
    },
  },
  {
    id: "shoulder-side-raise", group: "neckShoulders", position: "seated", region: "shoulders", level: 2, minutes: 1,
    text: {
      vi: { title: "Nâng tay sang ngang", equipment: "Ghế vững", steps: ["Ngồi thẳng thoải mái, hai tay thả lỏng bên người.", "Từ từ nâng hai tay sang ngang đến ngang vai hoặc thấp hơn nếu thoải mái, giữ vai thả lỏng.", "Hạ tay chậm rãi. Lặp lại khoảng 8 lần."], note: "Không nhún vai hay ưỡn lưng, dừng nếu thấy đau." },
      en: { title: "Seated lateral arm raises", equipment: "A stable chair", steps: ["Sit comfortably upright with your arms at your sides.", "Slowly raise both arms out to shoulder height or lower if more comfortable, keeping your shoulders relaxed.", "Lower your arms slowly. Repeat about 8 times."], note: "Avoid shrugging or arching your back, stop if you feel pain." },
      ja: { title: "座って腕を横に上げる", equipment: "安定した椅子", steps: ["楽に背筋を伸ばして座り、腕を体の横に下ろします。", "肩の力を抜き、両腕を横に肩の高さまで、または無理のない高さまでゆっくり上げます。", "腕をゆっくり下ろします。約8回繰り返します。"], note: "肩をすくめたり腰を反らしたりしないでください。痛みがあれば中止してください。" },
    },
  },
  {
    id: "weighted-shoulder-raise", group: "neckShoulders", position: "seated", region: "shoulders", level: 3, minutes: 2,
    text: {
      vi: { title: "Nâng tay ngang với chai nước nhỏ", equipment: "Ghế vững và hai chai nước nhỏ cùng trọng lượng", steps: ["Ngồi thẳng, cầm một chai nước nhỏ trong mỗi tay và thả tay bên người.", "Từ từ nâng hai tay sang ngang đến ngang vai hoặc thấp hơn, giữ vai thả lỏng.", "Hạ tay chậm rãi. Lặp lại khoảng 6 lần."], note: "Chọn chai thật nhẹ, không nhún vai hay ưỡn lưng. Dừng nếu thấy đau, tập không có chai nếu cần." },
      en: { title: "Lateral raises with small water bottles", equipment: "A stable chair and two equally weighted small water bottles", steps: ["Sit upright holding a small water bottle in each hand with arms at your sides.", "Slowly lift your arms out to shoulder height or lower, keeping your shoulders relaxed.", "Lower your arms slowly. Repeat about 6 times."], note: "Choose very light bottles, avoid shrugging or arching your back. Stop if you feel pain and exercise without bottles if needed." },
      ja: { title: "小さな水のボトルで腕を横に上げる", equipment: "安定した椅子と同じ重さの小さな水のボトル2本", steps: ["背筋を伸ばして座り、両手に小さな水のボトルを持ち、腕を体の横に下ろします。", "肩の力を抜き、両腕を横に肩の高さまで、またはそれより低くゆっくり上げます。", "腕をゆっくり下ろします。約6回繰り返します。"], note: "軽いボトルを選び、肩をすくめたり腰を反らしたりしないでください。痛みがあれば中止し、必要ならボトルなしで行います。" },
    },
  },
  {
    id: "supported-side-leg-raise", group: "limbs", position: "standing", region: "legs", level: 3, minutes: 2,
    text: {
      vi: { title: "Nâng chân sang bên có điểm tựa", equipment: "Bàn vững và khoảng trống hai bên", steps: ["Đứng thẳng, đặt một tay lên bàn vững, hai chân rộng bằng hông.", "Giữ thân người thẳng, từ từ nâng một chân sang bên trong phạm vi thoải mái.", "Hạ chân về vị trí ban đầu rồi đổi bên. Lặp lại khoảng 5 lần mỗi bên."], note: "Không nghiêng người hay vung chân. Luôn giữ điểm tựa, dừng nếu đau hoặc mất thăng bằng." },
      en: { title: "Supported side leg raises", equipment: "A stable table and space on both sides", steps: ["Stand upright with one hand on a stable table and your feet hip-width apart.", "Keep your body upright and slowly lift one leg out to the side within a comfortable range.", "Lower it to the starting position and switch sides. Repeat about 5 times per side."], note: "Do not lean or swing your leg. Hold the support throughout and stop if you feel pain or unsteady." },
      ja: { title: "支えを持って脚を横に上げる", equipment: "安定した机と左右のスペース", steps: ["安定した机に片手を置き、足を腰幅に開いて立ちます。", "体をまっすぐ保ち、片脚を無理のない範囲でゆっくり横に上げます。", "脚を元に戻して反対側も行います。左右それぞれ約5回繰り返します。"], note: "体を傾けたり脚を振ったりしないでください。支えを持ち続け、痛みやふらつきがあれば中止してください。" },
    },
  },
  {
    id: "side-step-arms", group: "wholeBody", position: "standing", region: "whole", level: 3, minutes: 2,
    text: {
      vi: { title: "Bước ngang kết hợp mở tay", equipment: "Khoảng trống an toàn", steps: ["Đứng thẳng, hai chân rộng bằng hông và hai tay bên người.", "Bước một chân sang bên, đồng thời đưa hai tay sang ngang đến ngang vai hoặc thấp hơn.", "Đưa chân và tay về vị trí ban đầu rồi đổi bên. Lặp lại chậm khoảng 5 lần mỗi bên."], note: "Không bật nhảy hay vung tay, tập chậm và dừng nếu đau, chóng mặt hoặc mất thăng bằng." },
      en: { title: "Side steps with arm raises", equipment: "A clear, safe space", steps: ["Stand upright with feet hip-width apart and arms at your sides.", "Step one foot to the side while lifting both arms out to shoulder height or lower.", "Return your foot and arms to the starting position, then switch sides. Repeat slowly about 5 times per side."], note: "Do not jump or swing your arms. Move slowly and stop if you feel pain, dizziness or unsteady." },
      ja: { title: "横に踏み出して腕を上げる", equipment: "安全に動けるスペース", steps: ["足を腰幅に開き、腕を体の横に下ろして立ちます。", "片足を横に踏み出しながら、両腕を横に肩の高さまで、またはそれより低く上げます。", "足と腕を元に戻し、反対側も行います。左右それぞれゆっくり約5回繰り返します。"], note: "跳んだり腕を振ったりせず、ゆっくり動きます。痛み、めまい、ふらつきがあれば中止してください。" },
    },
  },
  {
    id: "wrist-circles", group: "limbs", position: "seated", region: "arms", level: 1, minutes: 1,
    text: {
      vi: { title: "Xoay cổ tay", equipment: "Ghế vững", steps: ["Ngồi thoải mái, đưa hai tay ra trước và thả lỏng các ngón tay.", "Xoay cổ tay chậm theo vòng tròn nhỏ khoảng 5 lần.", "Đổi chiều và xoay thêm khoảng 5 lần."], note: "Chỉ xoay trong phạm vi thoải mái, không ép khớp." },
      en: { title: "Wrist circles", equipment: "A stable chair", steps: ["Sit comfortably, extend your hands in front and relax your fingers.", "Slowly circle your wrists in small circles about 5 times.", "Reverse direction and repeat about 5 times."], note: "Move only within a comfortable range, do not force the joints." },
      ja: { title: "手首回し", equipment: "安定した椅子", steps: ["楽に座り、両手を前に出して指の力を抜きます。", "手首を小さくゆっくり約5回回します。", "反対方向にも約5回回します。"], note: "関節に無理をかけず、心地よい範囲で動かしましょう。" },
    },
  },
  {
    id: "elbow-bends", group: "limbs", position: "seated", region: "arms", level: 1, minutes: 1,
    text: {
      vi: { title: "Gập và duỗi khuỷu tay", equipment: "Ghế vững", steps: ["Ngồi thẳng thoải mái, thả lỏng vai và để hai cánh tay bên người.", "Từ từ gập khuỷu tay, đưa hai bàn tay về phía vai, giữ khuỷu tay gần thân người.", "Từ từ duỗi tay trở lại vị trí ban đầu. Lặp lại chậm khoảng 8 lần."], note: "Không khóa khuỷu tay hay dùng lực quá mạnh. Dừng nếu thấy đau." },
      en: { title: "Elbow bends", equipment: "A stable chair", steps: ["Sit comfortably upright, relax your shoulders and keep your upper arms at your sides.", "Slowly bend your elbows, bringing your hands towards your shoulders while keeping your elbows near your body.", "Slowly straighten your arms back to the starting position. Repeat about 8 times."], note: "Do not lock your elbows or force the movement. Stop if you feel pain." },
      ja: { title: "肘の曲げ伸ばし", equipment: "安定した椅子", steps: ["楽に背筋を伸ばして座り、肩の力を抜いて腕を体の横に下ろします。", "肘を体の近くに保ちながらゆっくり曲げ、手を肩に近づけます。", "腕をゆっくり元の位置に伸ばします。約8回繰り返します。"], note: "肘を突っ張らせたり、無理に力を入れたりしないでください。痛みがあれば中止してください。" },
    },
  },
  {
    id: "seated-toe-raises", group: "limbs", position: "seated", region: "legs", level: 1, minutes: 1,
    text: {
      vi: { title: "Nâng mũi chân khi ngồi", equipment: "Ghế vững", steps: ["Ngồi thoải mái, đặt hai bàn chân trên sàn và giữ hai gót chân vững.", "Giữ gót trên sàn, từ từ nâng mũi chân lên trong phạm vi thoải mái.", "Hạ mũi chân xuống chậm rãi. Lặp lại khoảng 10 lần."], note: "Không nhấc gót hay giật cổ chân, dừng nếu thấy đau." },
      en: { title: "Seated toe raises", equipment: "A stable chair", steps: ["Sit comfortably with both feet on the floor and your heels supported.", "Keep your heels on the floor and slowly lift your toes within a comfortable range.", "Slowly lower your toes. Repeat about 10 times."], note: "Keep your heels down and avoid jerking your ankles. Stop if you feel pain." },
      ja: { title: "座ってつま先上げ", equipment: "安定した椅子", steps: ["楽に座り、両足を床につけてかかとを安定させます。", "かかとを床につけたまま、つま先を無理のない範囲でゆっくり上げます。", "つま先をゆっくり下ろします。約10回繰り返します。"], note: "かかとを浮かせず、足首を急に動かさないようにしましょう。痛みがあれば中止してください。" },
    },
  },
  {
    id: "seated-heel-raises", group: "limbs", position: "seated", region: "legs", level: 1, minutes: 1,
    text: {
      vi: { title: "Nâng gót khi ngồi", equipment: "Ghế vững", steps: ["Ngồi với hai bàn chân đặt trên sàn, rộng bằng hông.", "Giữ mũi chân trên sàn và từ từ nâng hai gót chân.", "Hạ gót xuống chậm rãi. Lặp lại khoảng 10 lần."], note: "Đặt chân chắc chắn và không nhún người." },
      en: { title: "Seated heel raises", equipment: "A stable chair", steps: ["Sit with your feet flat on the floor, hip-width apart.", "Keep your toes on the floor and slowly lift both heels.", "Lower your heels slowly. Repeat about 10 times."], note: "Keep your feet secure and avoid bouncing." },
      ja: { title: "座ってかかと上げ", equipment: "安定した椅子", steps: ["足を腰幅に開き、足裏を床につけて座ります。", "つま先を床につけたまま、両かかとをゆっくり上げます。", "ゆっくり下ろします。約10回繰り返します。"], note: "足を安定させ、反動をつけないようにしましょう。" },
    },
  },
  {
    id: "seated-knee-extension", group: "limbs", position: "seated", region: "legs", level: 1, minutes: 2,
    text: {
      vi: { title: "Duỗi gối khi ngồi", equipment: "Ghế vững", steps: ["Ngồi thẳng thoải mái, hai bàn chân trên sàn.", "Từ từ duỗi một chân về phía trước trong phạm vi thoải mái.", "Hạ chân xuống, đổi bên. Lặp lại khoảng 5 lần mỗi bên."], note: "Không khóa gối hoặc đá chân mạnh." },
      en: { title: "Seated knee extensions", equipment: "A stable chair", steps: ["Sit comfortably upright with both feet on the floor.", "Slowly straighten one leg in front of you within a comfortable range.", "Lower it and switch sides. Repeat about 5 times per side."], note: "Do not lock your knee or kick forcefully." },
      ja: { title: "座って膝伸ばし", equipment: "安定した椅子", steps: ["背筋を楽に伸ばして座り、両足を床につけます。", "片脚を無理のない範囲でゆっくり前に伸ばします。", "足を下ろして反対側も行います。左右それぞれ約5回繰り返します。"], note: "膝を突っ張らせたり、勢いよく蹴ったりしないでください。" },
    },
  },
  {
    id: "sit-to-stand", group: "wholeBody", position: "standing", region: "legs", level: 2, minutes: 2,
    text: {
      vi: { title: "Đứng lên ngồi xuống", equipment: "Ghế chắc, không có bánh xe", steps: ["Ngồi gần mép ghế, đặt hai chân vững trên sàn.", "Hơi nghiêng người về trước và từ từ đứng lên, dùng tay vịn nếu cần.", "Lùi đến khi cảm nhận ghế phía sau, rồi từ từ ngồi xuống. Lặp lại khoảng 5 lần."], note: "Dùng ghế không trượt, đặt sát tường, dừng nếu thấy mất thăng bằng." },
      en: { title: "Sit to stand", equipment: "A stable chair without wheels", steps: ["Sit near the front of the chair with both feet firmly on the floor.", "Lean slightly forward and slowly stand up, use the armrests if needed.", "Step back until you feel the chair behind you, then slowly sit down. Repeat about 5 times."], note: "Use a non-slip chair against a wall, stop if you feel unsteady." },
      ja: { title: "椅子から立ち座り", equipment: "キャスターのない安定した椅子", steps: ["椅子に浅く座り、両足をしっかり床につけます。", "少し前に体を傾けてゆっくり立ちます。必要なら肘掛けを使います。", "椅子が脚の後ろに触れるまで戻り、ゆっくり座ります。約5回繰り返します。"], note: "滑らない椅子を壁につけて使い、ふらついたら中止してください。" },
    },
  },
  {
    id: "standing-heel-raises", group: "limbs", position: "standing", region: "legs", level: 2, minutes: 1,
    text: {
      vi: { title: "Nâng gót khi đứng", equipment: "Bàn hoặc thành ghế vững", steps: ["Đứng thẳng, hai chân rộng bằng hông, đặt tay lên điểm tựa vững.", "Từ từ nâng gót, giữ trọng lượng trên phần trước bàn chân.", "Hạ gót xuống chậm rãi. Lặp lại khoảng 8 lần."], note: "Không dùng ghế có bánh xe làm điểm tựa." },
      en: { title: "Standing heel raises", equipment: "A stable table or chair back", steps: ["Stand with feet hip-width apart, holding a stable support.", "Slowly lift your heels, keeping your weight over the balls of your feet.", "Slowly lower your heels. Repeat about 8 times."], note: "Do not use a chair with wheels for support." },
      ja: { title: "立ってかかと上げ", equipment: "安定した机または椅子の背", steps: ["足を腰幅に開いて立ち、安定した支えに手を置きます。", "足の指の付け根に体重を乗せ、かかとをゆっくり上げます。", "かかとをゆっくり下ろします。約8回繰り返します。"], note: "キャスター付きの椅子を支えにしないでください。" },
    },
  },
  {
    id: "march-in-place", group: "wholeBody", position: "standing", region: "whole", level: 2, minutes: 2,
    text: {
      vi: { title: "Đi bộ tại chỗ", equipment: "Khoảng trống và điểm tựa vững nếu cần", steps: ["Đứng trong khoảng trống, giữ điểm tựa vững nếu cần.", "Lần lượt nâng từng chân thấp khỏi sàn như đang đi bộ.", "Tiếp tục chậm rãi khoảng 1–2 phút, hít thở tự nhiên."], note: "Không cần nâng gối cao, giảm tốc độ hoặc nghỉ khi mệt." },
      en: { title: "March in place", equipment: "Clear space and a stable support if needed", steps: ["Stand in a clear space, holding a stable support if needed.", "Lift each foot a little off the floor in turn as if walking.", "Continue slowly for about 1–2 minutes, breathing naturally."], note: "There is no need to lift your knees high, slow down or rest if tired." },
      ja: { title: "その場足踏み", equipment: "十分なスペースと、必要に応じて安定した支え", steps: ["周囲に物のない場所に立ち、必要なら安定した支えにつかまります。", "歩くように左右の足を交互に少し床から上げます。", "自然に呼吸しながら、ゆっくり1〜2分ほど続けます。"], note: "膝を高く上げる必要はありません。疲れたら速度を落とすか休みましょう。" },
    },
  },
  {
    id: "standing-arm-stretch", group: "wholeBody", position: "standing", region: "whole", level: 1, minutes: 1,
    text: {
      vi: { title: "Vươn tay và duỗi người", equipment: "Khoảng trống an toàn", steps: ["Đứng thoải mái, hai chân rộng bằng hông và hai tay thả lỏng bên người.", "Từ từ đưa hai tay từ hai bên lên cao trong phạm vi thoải mái, giữ thân người thẳng và hít thở tự nhiên.", "Nhẹ nhàng hạ hai tay xuống bên người. Lặp lại chậm khoảng 5 lần."], note: "Không ưỡn lưng hay cố nâng tay quá cao. Dừng nếu thấy đau, chóng mặt hoặc mất thăng bằng." },
      en: { title: "Standing arm stretch", equipment: "A clear, safe space", steps: ["Stand comfortably with your feet hip-width apart and your arms relaxed at your sides.", "Slowly raise both arms out to the sides and up within a comfortable range, keeping your body upright and breathing naturally.", "Gently lower your arms back to your sides. Repeat slowly about 5 times."], note: "Do not arch your back or force your arms too high. Stop if you feel pain, dizziness or unsteady." },
      ja: { title: "立って腕を伸ばす", equipment: "安全に動けるスペース", steps: ["足を腰幅に開いて楽に立ち、腕を体の横に下ろします。", "背筋を保ち、自然に呼吸しながら、両腕を横から無理のない高さまでゆっくり上げます。", "両腕をゆっくり体の横に下ろします。ゆっくり約5回繰り返します。"], note: "腰を反らしたり、腕を無理に高く上げたりしないでください。痛み、めまい、ふらつきがあれば中止してください。" },
    },
  },
];
