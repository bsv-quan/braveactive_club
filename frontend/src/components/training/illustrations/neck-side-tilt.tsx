import { Head } from "./shared";

export function NeckSideTiltIllustration() {
  return (
    <g>
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 Q190 96 194 113 Q188 120 181 122 Q179 154 177 185 Q151 188 126 185 Q124 154 122 122 Q114 120 108 113 Q113 95 120 79Z" fill="#4a8fcb" />
      <path d="M142 58 Q143 69 143 79 Q151 82 160 79 Q160 68 160 58" fill="#cf9271" />
      <g opacity="0.2"><Head /></g>
      <g className="training-neck-tilt"><Head /></g>
      <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M95 35 Q102 18 118 16 M98 29 L95 35 L102 34" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="training-arrow-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M184 16 Q200 18 207 35 M200 34 L207 35 L204 29" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}
