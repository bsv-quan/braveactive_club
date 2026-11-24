type MarchLegProps = { side: "far" | "near"; resting?: boolean };

function MarchLeg({ side, resting = false }: MarchLegProps) {
  const far = side === "far";
  const x = far ? 139 : 147;
  return (
    <g className={resting ? undefined : `training-march-thigh training-march-thigh-${side}`}>
      <path d={`M${x - 8} 140 Q${x} 135 ${x + 8} 142 Q${x + 9} 162 ${x + 8} 182 Q${x} 189 ${x - 8} 182 Q${x - 9} 161 ${x - 8} 140Z`} fill={far ? "#304e80" : "#456ba4"} />
      <g className={resting ? undefined : `training-march-shin training-march-shin-${side}`}>
        <path d={`M${x - 8} 182 Q${x} 176 ${x + 8} 182 Q${x + 9} 202 ${x + 9} 222 Q${x + 1} 225 ${x - 7} 222 Q${x - 8} 202 ${x - 8} 182Z`} fill={far ? "#304e80" : "#456ba4"} />
        <path d={`M${x - 7} 222 Q${x - 4} 216 ${x + 5} 219 Q${x + 12} 220 ${x + 18} 222 Q${x + 23} 224 ${x + 23} 228 Q${x + 8} 228 ${x - 7} 228 Q${x - 9} 225 ${x - 7} 222Z`} fill="#263e53" stroke="#d6e5ef" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** Side view uses linked thigh and shin rotations so the knees lift in turn. */
export function MarchIllustration({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 300 240" role="img" aria-label={label} className="training-drawing" data-exercise="march-in-place">
      <path d="M37 228 H269" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <g opacity="0.2"><MarchLeg side="far" resting /></g>
      <MarchLeg side="far" />
      <g opacity="0.2"><MarchLeg side="near" resting /></g>
      <MarchLeg side="near" />
      <path d="M129 139 Q130 122 133 102 Q135 90 137 79 Q140 70 150 70 Q155 71 160 73 Q168 75 168 85 Q167 101 165 117 Q165 129 164 141 Q146 144 129 139Z" fill="#4a8fcb" />
      <path d="M129 135 Q146 137 164 135 Q165 139 164 143 Q146 145 129 143 Q128 139 129 135Z" fill="#3676b4" />
      <path d="M145 73 Q146 67 148 61 Q154 61 160 63 Q161 70 160 76 Q153 77 145 73Z" fill="#cf9271" />
      <path d="M144 40 Q146 24 160 24 Q176 24 177 40 Q176 46 174 51 Q172 62 163 64 Q151 64 147 52 Q144 46 144 40Z" fill="#eab395" />
      <path d="M143 43 Q140 28 149 23 Q159 17 169 23 Q178 26 178 39 Q175 39 173 40 Q170 34 166 33 Q157 39 145 38 Q146 44 148 49 Q145 47 143 43Z" fill="#263e53" />
      <path d="M173 42 Q176 44 178 46 Q176 48 173 48" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="169" cy="41" r="1.5" fill="#263e53" />
      <path d="M150 80 Q155 76 161 81 Q166 90 170 99 Q177 103 184 107 Q188 110 185 114 Q183 117 178 114 Q170 111 163 107 Q155 99 148 91 Q145 85 150 80Z" fill="#eab395" />
      <path d="M145 77 Q151 72 158 76 Q162 81 165 87 Q160 91 154 94 Q149 91 145 87 Q142 82 145 77Z" fill="#397fbd" />
      <g className="training-arrow-up" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M204 192 V149 M199 154 L204 149 L209 154" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-down" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M199 187 L204 192 L209 187" strokeLinecap="round" strokeLinejoin="round" /></g>
    </svg>
  );
}
