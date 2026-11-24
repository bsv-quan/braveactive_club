function ProfileHead() {
  return (
    <>
      <path d="M144 40 Q146 24 160 24 Q176 24 177 40 Q176 46 174 51 Q172 62 163 64 Q151 64 147 52 Q144 46 144 40Z" fill="#eab395" />
      <path d="M143 43 Q140 28 149 23 Q159 17 169 23 Q178 26 178 39 Q175 39 173 40 Q170 34 166 33 Q157 39 145 38 Q146 44 148 49 Q145 47 143 43Z" fill="#263e53" />
      <path d="M173 42 Q176 44 178 46 Q176 48 173 48" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="169" cy="41" r="1.5" fill="#263e53" />
      <path d="M157 61 Q162 64 168 61" fill="none" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export function ChinTuckIllustration() {
  return (
    <g>
      <path d="M116 185 Q118 145 124 105 Q128 80 143 75 Q151 73 160 76 Q171 81 172 95 Q169 140 166 185 Q141 188 116 185Z" fill="#4a8fcb" />
      <path opacity="0.2" d="M143 76 Q145 68 147 59 Q154 58 160 60 Q160 69 160 79 Q151 80 143 76Z" fill="#cf9271" />
      <path className="training-neck-tuck-neck" d="M143 76 Q145 68 147 59 Q154 58 160 60 Q160 69 160 79 Q151 80 143 76Z" fill="#cf9271" />
      <g opacity="0.2"><ProfileHead /></g>
      <g className="training-neck-tuck"><ProfileHead /></g>
      <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M169 12 H127 M133 7 L127 12 L133 17" strokeLinecap="round" strokeLinejoin="round" /></g>
      <path d="M188 41 H225" fill="none" stroke="#91a8ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" aria-hidden="true" />
    </g>
  );
}
