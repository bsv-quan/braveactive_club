type MarchLegProps = { side: "far" | "near" };

function MarchLeg({ side }: MarchLegProps) {
  const far = side === "far";
  const x = far ? 139 : 147;
  return (
    <g className={`training-march-thigh training-march-thigh-${side}`}>
      <path d={`M${x - 8} 140 Q${x} 135 ${x + 8} 142 L${x + 8} 182 Q${x} 189 ${x - 8} 182Z`} fill={far ? "#304e80" : "#456ba4"} />
      <g className={`training-march-shin training-march-shin-${side}`}>
        <path d={`M${x - 8} 182 Q${x} 176 ${x + 8} 182 L${x + 9} 222 H${x - 7}Z`} fill={far ? "#304e80" : "#456ba4"} />
        <path d={`M${x - 7} 222 Q${x - 4} 216 ${x + 5} 219 L${x + 18} 222 Q${x + 23} 224 ${x + 23} 228 H${x - 7}Z`} fill="#263e53" stroke="#d6e5ef" strokeWidth="1.5" />
      </g>
    </g>
  );
}

/** Side view uses linked thigh and shin rotations so the knees lift in turn. */
export function MarchIllustration({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 300 240" role="img" aria-label={label} className="training-drawing" data-exercise="march-in-place">
      <path d="M37 228 H269" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <MarchLeg side="far" />
      <MarchLeg side="near" />
      <path d="M129 139 Q130 122 133 102 L137 79 Q140 70 150 70 L160 73 Q168 75 168 85 L165 117 L164 141Z" fill="#4a8fcb" />
      <path d="M129 135 H164 V143 H129Z" fill="#3676b4" />
      <path d="M145 73 L148 61 L160 63 L160 76Z" fill="#cf9271" />
      <path d="M144 40 Q146 24 160 24 Q176 24 177 40 L174 51 Q172 62 163 64 Q151 64 147 52Z" fill="#eab395" />
      <path d="M143 43 Q140 28 149 23 Q159 17 169 23 Q178 26 178 39 L173 40 Q170 34 166 33 Q157 39 145 38 L148 49Z" fill="#263e53" />
      <path d="M173 42 L178 46 L173 48" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="169" cy="41" r="1.5" fill="#263e53" />
      <path d="M150 80 Q155 76 161 81 L170 99 L184 107 Q188 110 185 114 Q183 117 178 114 L163 107 L148 91 Q145 85 150 80Z" fill="#eab395" />
      <path d="M145 77 Q151 72 158 76 L165 87 L154 94 L145 87 Q142 82 145 77Z" fill="#397fbd" />
      <path d="M204 149 V192 M199 154 L204 149 L209 154 M199 187 L204 192 L209 187" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </svg>
  );
}
