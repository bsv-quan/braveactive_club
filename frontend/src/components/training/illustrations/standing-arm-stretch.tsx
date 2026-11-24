import { Head, Shoe } from "./shared";

function StretchArm({ side }: { side: "left" | "right" }) {
  return side === "left" ? (
    <>
      <path d="M124 84 Q116 79 111 89 Q104 105 99 121 Q97 136 96 150 Q96 157 102 158 Q108 158 109 151 Q111 138 114 126 Q122 108 130 94 Q128 88 124 84Z" fill="#eab395" />
      <path d="M124 78 Q115 75 110 87 Q108 94 106 100 Q112 104 119 106 Q125 98 130 91 Q128 83 124 78Z" fill="#397fbd" />
    </>
  ) : (
    <>
      <path d="M178 84 Q186 79 191 89 Q198 105 203 121 Q205 136 206 150 Q206 157 200 158 Q194 158 193 151 Q191 138 188 126 Q180 108 172 94 Q174 88 178 84Z" fill="#eab395" />
      <path d="M178 78 Q187 75 192 87 Q194 94 196 100 Q190 104 183 106 Q177 98 172 91 Q174 83 178 78Z" fill="#397fbd" />
    </>
  );
}

export function StandingArmStretchIllustration() {
  return (
    <g>
      <path d="M37 228 H269" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <path d="M131 139 H149 L145 222 H127Z" fill="#304e80" />
      <path d="M153 139 H171 L175 222 H157Z" fill="#456ba4" />
      <Shoe x={121} y={228} />
      <Shoe x={154} y={228} />
      <g opacity="0.2"><StretchArm side="left" /></g>
      <g className="training-stretch-arm training-stretch-arm-left"><StretchArm side="left" /></g>
      <g opacity="0.2"><StretchArm side="right" /></g>
      <g className="training-stretch-arm training-stretch-arm-right"><StretchArm side="right" /></g>
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L177 141 H126Z" fill="#4a8fcb" />
      <path d="M126 135 H177 V143 H126Z" fill="#3676b4" />
      <Head />
      <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M71 143 V92 M66 98 L71 92 L76 98 M66 137 L71 143 L76 137" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M231 143 V92 M226 98 L231 92 L236 98 M226 137 L231 143 L236 137" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
