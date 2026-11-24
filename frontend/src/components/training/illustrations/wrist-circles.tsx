function Hand({ side }: { side: "left" | "right" }) {
  return side === "left" ? (
    <path d="M131 122 Q126 112 129 103 L129 79 Q129 74 133 74 Q137 74 137 79 L137 97 L138 69 Q138 64 142 64 Q146 64 146 69 L146 96 L148 73 Q148 68 152 69 Q156 69 155 74 L155 99 L158 83 Q159 78 163 79 Q167 80 165 85 L163 112 Q162 120 155 126Z" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  ) : (
    <path d="M169 122 Q174 112 171 103 L171 79 Q171 74 167 74 Q163 74 163 79 L163 97 L162 69 Q162 64 158 64 Q154 64 154 69 L154 96 L152 73 Q152 68 148 69 Q144 69 145 74 L145 99 L142 83 Q141 78 137 79 Q133 80 135 85 L137 112 Q138 120 145 126Z" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  );
}

export function WristCirclesIllustration() {
  return (
    <g>
      <path d="M43 168 Q61 134 114 130 L128 146 Q111 160 92 174 L64 196Z" fill="#4a8fcb" />
      <path d="M257 168 Q239 134 186 130 L172 146 Q189 160 208 174 L236 196Z" fill="#4a8fcb" />
      <path d="M78 141 Q88 128 99 122 L123 124 L123 140 L102 155Z" fill="#eab395" />
      <path d="M222 141 Q212 128 201 122 L177 124 L177 140 L198 155Z" fill="#eab395" />
      <g transform="translate(-32 0)">
        <g opacity="0.2"><Hand side="left" /></g>
        <g className="training-wrist training-wrist-left"><Hand side="left" /></g>
      </g>
      <g transform="translate(32 0)">
        <g opacity="0.2"><Hand side="right" /></g>
        <g className="training-wrist training-wrist-right"><Hand side="right" /></g>
      </g>
      <g fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <g className="training-wrist-clockwise">
          <path d="M92 57 Q115 40 136 57 M129 55 L136 57 L134 50" />
          <path d="M164 57 Q185 40 208 57 M201 55 L208 57 L206 50" />
        </g>
        <g className="training-wrist-counterclockwise">
          <path d="M136 57 Q115 40 92 57 M94 50 L92 57 L99 55" />
          <path d="M208 57 Q185 40 164 57 M166 50 L164 57 L171 55" />
        </g>
      </g>
    </g>
  );
}
