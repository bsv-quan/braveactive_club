import { Head } from "./shared";

function WeightedArm({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <>
      <path d={left ? "M124 84 Q116 79 111 89 Q104 105 99 121 Q97 136 96 150 Q96 157 102 158 Q108 158 109 151 Q111 138 114 126 Q122 108 130 94 Q128 88 124 84Z" : "M178 84 Q186 79 191 89 Q198 105 203 121 Q205 136 206 150 Q206 157 200 158 Q194 158 193 151 Q191 138 188 126 Q180 108 172 94 Q174 88 178 84Z"} fill="#eab395" />
      <rect x={left ? 94 : 191} y="146" width="17" height="27" rx="4" ry="4" fill="#758ca0" stroke="#526778" strokeWidth="2" />
    </>
  );
}

export function WeightedShoulderRaiseIllustration() {
  return (
    <g>
      <Head />
      <g opacity="0.2"><WeightedArm side="left" /></g>
      <g className="training-lateral-arm training-lateral-arm-left"><WeightedArm side="left" /></g>
      <g opacity="0.2"><WeightedArm side="right" /></g>
      <g className="training-lateral-arm training-lateral-arm-right"><WeightedArm side="right" /></g>
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 Q180 132 177 185 Q151 188 126 185 Q123 132 120 79Z" fill="#4a8fcb" />
      <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M72 154 Q54 120 79 91 M73 96 L79 91 L79 99" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M226 154 Q244 120 220 91 M220 99 L220 91 L226 96" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
