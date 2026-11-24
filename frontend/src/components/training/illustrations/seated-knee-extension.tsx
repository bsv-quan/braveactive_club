import { Chair, Shoe } from "./shared";

function LowerLeg({ side }: { side: "far" | "near" }) {
  return side === "far" ? (
    <>
      <path d="M132 145 Q132 137 141 137 Q150 137 150 147 Q153 187 155 227 Q146 227 137 227 Q135 187 132 145Z" fill="#304e80" />
      <Shoe x={135} y={227} />
    </>
  ) : (
    <>
      <path d="M145 149 Q145 141 154 141 Q163 141 163 151 Q166 189 169 227 Q159 227 150 227 Q147 188 145 149Z" fill="#456ba4" />
      <Shoe x={149} y={227} />
    </>
  );
}

export function SeatedKneeExtensionIllustration() {
  return (
    <g>
      <path d="M31 227 H271" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Chair />
      <path d="M74 85 Q76 68 92 68 Q103 68 114 70 Q125 72 126 86 Q123 113 120 138 Q96 141 72 138 Q72 111 74 85Z" fill="#4a8fcb" />
      <path d="M112 80 Q119 79 123 90 Q128 103 132 116 Q128 119 124 120 Q117 108 110 96 Q109 87 112 80Z" fill="#eab395" />
      <path d="M75 132 Q67 140 76 151 Q110 154 143 151 Q153 150 153 140 Q152 132 140 131 Q108 129 75 132Z" fill="#456ba4" />
      <path d="M85 136 Q79 143 88 154 Q122 157 155 154 Q164 153 164 144 Q163 136 153 135 Q119 133 85 136Z" fill="#3c6097" />
      <g opacity="0.2"><LowerLeg side="far" /></g>
      <g className="training-knee-far"><LowerLeg side="far" /></g>
      <g opacity="0.2"><LowerLeg side="near" /></g>
      <g className="training-knee-near"><LowerLeg side="near" /></g>
      <g className="training-arrow-up" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M190 210 Q221 196 225 160 M219 164 L225 160 L229 166" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-down" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M184 208 L190 210 L189 216" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
