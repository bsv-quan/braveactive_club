function Character({ resting = false }: { resting?: boolean }) {
  return (
    <g>
      <path d="M180 218 Q184 213 193 215 Q200 217 207 219 Q213 221 213 226 Q197 227 181 226 Q177 225 180 218Z" fill="#344b64" />
      <g className={resting ? undefined : "sit-stand-shin"}>
        <path d="M167 164 Q167 155 177 155 Q187 155 188 165 Q191 188 195 211 Q195 218 188 220 Q180 221 178 213 Q172 188 167 164Z" fill="#304e80" />
        <g className={resting ? undefined : "sit-stand-thigh"}>
          <path d="M117 151 Q111 151 108 158 Q105 166 115 173 Q143 176 171 176 Q182 176 184 167 Q184 157 174 154 Q146 151 117 151Z" fill="#456ba4" />
          <circle cx="176" cy="165" r="7" fill="#3c6097" />
          <g className={resting ? undefined : "sit-stand-upper"}>
            <path d="M108 153 Q111 137 117 117 Q120 108 124 100 Q129 91 141 93 Q146 95 150 98 Q155 103 152 114 Q149 125 146 136 Q143 148 140 159 Q125 165 108 159 Q107 156 108 153Z" fill="#4a8fcb" />
            <path d="M114 151 Q126 156 141 151 Q141 155 140 159 Q125 165 108 159 Q111 155 114 151Z" fill="#3676b4" />
            <path d="M128 95 Q130 90 132 84 Q138 85 143 87 Q144 93 143 99 Q135 99 128 95Z" fill="#cf9271" />
            <path d="M128 67 Q131 52 146 52 Q161 53 162 68 Q161 74 159 79 Q157 89 148 91 Q136 91 131 80 Q128 74 128 67Z" fill="#eab395" />
            <path d="M127 70 Q124 57 133 51 Q142 44 153 50 Q162 53 163 66 Q160 67 158 67 Q155 62 151 61 Q141 67 129 65 Q130 71 132 76 Q128 74 127 70Z" fill="#263e53" />
            <path d="M158 70 Q161 72 163 74 Q161 76 158 76" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="153" cy="69" r="1.5" fill="#263e53" />
            <path d="M135 105 Q140 100 146 105 Q151 114 155 123 Q164 127 173 131 Q178 133 176 138 Q174 142 169 140 Q157 137 145 132 Q139 123 133 115 Q130 110 135 105Z" fill="#eab395" />
            <path d="M130 102 Q135 96 142 100 Q146 105 149 111 Q144 115 138 118 Q133 115 129 111 Q126 107 130 102Z" fill="#397fbd" />
            <path d="M169 131 Q177 128 181 133 Q183 137 177 140 Q174 141 171 140" fill="#eab395" />
          </g>
        </g>
      </g>
      <path d="M184 219 Q188 215 198 217 Q205 218 212 220 Q217 222 217 227 Q201 228 185 227 Q181 226 184 219Z" fill="#263e53" />
      <path d="M186 224 H213" stroke="#d6e5ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Side-view illustration with articulated joints and a fixed, stable chair. */
export function SitToStandIllustration({ label }: { label: string }) {
  return (
    <svg viewBox="0 -20 320 280" role="img" aria-label={label} className="sit-stand-illustration">
      <path d="M37 231 H280" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M62 112 L66 168 M69 168 L146 168 M76 171 L72 227 M137 171 L142 227" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 106 Q58 102 63 102 H70 Q74 103 75 110 L78 157 H64 Z" fill="#758ca0" />
      <path d="M65 157 H144 Q151 157 151 164 V171 H65 Z" fill="#758ca0" />
      <g opacity="0.2"><Character resting /></g>
      <Character />
      <g className="training-arrow-up" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M234 170 V80 M228 86 L234 80 L240 86" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-down" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M228 164 L234 170 L240 164" strokeLinecap="round" strokeLinejoin="round" /></g>
    </svg>
  );
}
