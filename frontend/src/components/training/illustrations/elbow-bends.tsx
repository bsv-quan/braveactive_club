import { Head } from "./shared";

export function ElbowBendsIllustration() {
  return (
    <g>
      <Head />
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 Q181 132 180 185 Q151 188 123 185 Q122 132 120 79Z" fill="#4a8fcb" />
      <path d="M120 79 Q111 77 107 88 Q102 104 100 121 Q106 124 112 125 Q119 111 125 99 Q123 88 120 79Z M183 79 Q192 77 196 88 Q201 104 203 121 Q197 124 191 125 Q184 111 178 99 Q180 88 183 79Z" fill="#397fbd" />
      <g opacity="0.2"><path d="M100 121 Q106 118 112 125 Q112 143 111 160 Q110 167 104 167 Q98 167 98 160 Q98 140 100 121Z" fill="#eab395" /></g>
      <g className="training-elbow-bend training-elbow-bend-left">
        <path d="M100 121 Q106 118 112 125 Q112 143 111 160 Q110 167 104 167 Q98 167 98 160 Q98 140 100 121Z" fill="#eab395" />
      </g>
      <g opacity="0.2"><path d="M191 125 Q197 118 203 121 Q205 140 205 160 Q205 167 199 167 Q193 167 192 160 Q191 142 191 125Z" fill="#eab395" /></g>
      <g className="training-elbow-bend training-elbow-bend-right">
        <path d="M191 125 Q197 118 203 121 Q205 140 205 160 Q205 167 199 167 Q193 167 192 160 Q191 142 191 125Z" fill="#eab395" />
      </g>
      <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M70 154 Q54 133 65 108 M61 113 L65 108 L70 113 M66 149 L70 154 L64 154" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M232 154 Q248 133 237 108 M232 113 L237 108 L241 113 M236 149 L232 154 L238 154" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
