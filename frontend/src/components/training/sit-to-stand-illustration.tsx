/** Side-view illustration with articulated joints and a fixed, stable chair. */
export function SitToStandIllustration({ label }: { label: string }) {
  return (
    <svg viewBox="0 -20 320 280" role="img" aria-label={label} className="sit-stand-illustration">
      <path d="M37 231 H280" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 112 L66 168 M69 168 L146 168 M76 171 L72 227 M137 171 L142 227" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 106 Q58 102 63 102 H70 Q74 103 75 110 L78 157 H64 Z" fill="#758ca0" />
      <path d="M65 157 H144 Q151 157 151 164 V171 H65 Z" fill="#758ca0" />

      <path d="M180 218 Q184 213 193 215 L207 219 Q213 221 213 226 H181 Q177 225 180 218Z" fill="#344b64" />
      <g className="sit-stand-shin">
        <path d="M167 164 Q167 155 177 155 Q187 155 188 165 L195 211 Q195 218 188 220 Q180 221 178 213 Z" fill="#304e80" />
        <g className="sit-stand-thigh">
          <path d="M117 151 Q111 151 108 158 Q105 166 115 173 L171 176 Q182 176 184 167 Q184 157 174 154 Z" fill="#456ba4" />
          <circle cx="176" cy="165" r="7" fill="#3c6097" />
          <g className="sit-stand-upper">
            <path d="M108 153 Q111 137 117 117 L124 100 Q129 91 141 93 L150 98 Q155 103 152 114 L146 136 Q143 148 140 159 Q125 165 108 159 Z" fill="#4a8fcb" />
            <path d="M114 151 Q126 156 141 151 L140 159 Q125 165 108 159 Z" fill="#3676b4" />
            <path d="M128 95 L132 84 L143 87 L143 99 Z" fill="#cf9271" />
            <path d="M128 67 Q131 52 146 52 Q161 53 162 68 L159 79 Q157 89 148 91 Q136 91 131 80 Z" fill="#eab395" />
            <path d="M127 70 Q124 57 133 51 Q142 44 153 50 Q162 53 163 66 L158 67 Q155 62 151 61 Q141 67 129 65 L132 76 Z" fill="#263e53" />
            <path d="M158 70 L163 74 L158 76" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="153" cy="69" r="1.5" fill="#263e53" />
            <path d="M135 105 Q140 100 146 105 L155 123 L173 131 Q178 133 176 138 Q174 142 169 140 L145 132 L133 115 Q130 110 135 105Z" fill="#eab395" />
            <path d="M130 102 Q135 96 142 100 L149 111 L138 118 L129 111 Q126 107 130 102Z" fill="#397fbd" />
            <path d="M169 131 Q177 128 181 133 Q183 137 177 140 L171 140" fill="#eab395" />
          </g>
        </g>
      </g>
      <path d="M184 219 Q188 215 198 217 L212 220 Q217 222 217 227 H185 Q181 226 184 219Z" fill="#263e53" />
      <path d="M186 224 H213" stroke="#d6e5ef" strokeWidth="2" strokeLinecap="round" />
      <path d="M234 80 V170 M228 86 L234 80 L240 86 M228 164 L234 170 L240 164" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </svg>
  );
}
