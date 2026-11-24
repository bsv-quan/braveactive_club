import { Head } from "./shared";

function ShoulderArm({ side }: { side: "left" | "right" }) {
  return side === "left" ? (
    <>
      <path d="M119 79 Q127 72 140 74 Q141 81 140 88 Q130 94 120 98 Q117 88 119 79Z" fill="#4a8fcb" />
      <path d="M120 79 Q112 78 107 88 Q102 104 100 121 Q106 124 112 125 Q117 114 123 103 Q124 90 120 79Z" fill="#397fbd" />
      <path d="M100 121 Q97 145 96 168 Q96 177 102 178 Q108 179 110 171 Q111 147 112 125 Q106 122 100 121Z" fill="#eab395" />
    </>
  ) : (
    <>
      <path d="M183 79 Q175 72 163 74 Q162 81 163 88 Q173 94 183 98 Q186 88 183 79Z" fill="#4a8fcb" />
      <path d="M183 79 Q191 78 196 88 Q201 104 203 121 Q197 124 191 125 Q186 114 180 103 Q179 90 183 79Z" fill="#397fbd" />
      <path d="M203 121 Q206 145 207 168 Q207 177 201 178 Q195 179 193 171 Q192 147 191 125 Q197 122 203 121Z" fill="#eab395" />
    </>
  );
}

export function ShoulderLiftsIllustration() {
  return (
    <g>
      <Head />
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 Q190 96 194 113 Q188 120 181 122 Q179 154 177 185 Q151 188 126 185 Q124 154 122 122 Q114 120 108 113 Q113 95 120 79Z" fill="#4a8fcb" />
      <path d="M126 177 Q151 179 177 177 Q178 182 177 187 Q151 189 126 187 Q125 182 126 177Z" fill="#3676b4" />
      <g opacity="0.2"><ShoulderArm side="left" /></g>
      <g className="training-shoulder-lift"><ShoulderArm side="left" /></g>
      <g opacity="0.2"><ShoulderArm side="right" /></g>
      <g className="training-shoulder-lift"><ShoulderArm side="right" /></g>
      <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M77 82 V113 M72 87 L77 82 L82 87 M72 108 L77 113 L82 108" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M226 82 V113 M221 87 L226 82 L231 87 M221 108 L226 113 L231 108" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
