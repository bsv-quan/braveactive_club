import { Shoe } from "./shared";

function StandingBody() {
  return (
    <>
        <path d="M132 141 Q141 134 148 143 L144 220 H128Z" fill="#304e80" />
        <path d="M149 141 Q158 134 165 143 L164 222 H148Z" fill="#456ba4" />
        <path d="M129 139 Q130 122 133 102 L137 79 Q140 70 150 70 L160 73 Q168 75 168 85 L165 117 L164 141Z" fill="#4a8fcb" />
        <path d="M129 135 H164 V143 H129Z" fill="#3676b4" />
        <path d="M145 73 L148 61 L160 63 L160 76Z" fill="#cf9271" />
        <path d="M144 40 Q146 24 160 24 Q176 24 177 40 L174 51 Q172 62 163 64 Q151 64 147 52Z" fill="#eab395" />
        <path d="M143 43 Q140 28 149 23 Q159 17 169 23 Q178 26 178 39 L173 40 Q170 34 166 33 Q157 39 145 38 L148 49Z" fill="#263e53" />
        <path d="M173 42 L178 46 L173 48" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="169" cy="41" r="1.5" fill="#263e53" />
    </>
  );
}

function StandingArm() {
  return (
    <>
      <path d="M150 80 Q156 76 162 82 L179 104 L211 108 Q218 108 219 112 Q219 116 212 116 L175 114 L148 92 Q145 86 150 80Z" fill="#eab395" />
      <path d="M145 77 Q151 72 158 76 L166 87 L154 95 L145 87 Q142 82 145 77Z" fill="#397fbd" />
    </>
  );
}

export function StandingHeelRaisesIllustration() {
  return (
    <g>
      <path d="M30 228 H276" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M211 116 H265 M245 116 V225" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <g opacity="0.2"><Shoe x={125} y={228} /></g>
      <g className="training-standing-shoe training-standing-shoe-far"><Shoe x={125} y={228} /></g>
      <g opacity="0.2"><Shoe x={145} y={228} /></g>
      <g className="training-standing-shoe"><Shoe x={145} y={228} /></g>
      <g opacity="0.2"><StandingBody /></g>
      <g className="training-standing-lift"><StandingBody /></g>
      <g opacity="0.2"><StandingArm /></g>
      <g className="training-standing-arm"><StandingArm /></g>
      <g className="training-arrow-up" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M102 211 V183 M97 188 L102 183 L107 188" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-down" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M97 206 L102 211 L107 206" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
