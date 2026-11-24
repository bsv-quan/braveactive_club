import { Head, Shoe } from "./shared";

export function SideStepArmsIllustration() {
  return (
    <g>
      <path d="M30 228 H276" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />

      <g opacity="0.2"><path d="M131 139 H149 L145 222 H127Z" fill="#304e80" /></g>
      <g className="training-side-leg training-side-leg-left">
        <path d="M131 139 H149 L145 222 H127Z" fill="#304e80" />
      </g>
      <g opacity="0.2"><path d="M153 139 H171 L175 222 H157Z" fill="#456ba4" /></g>
      <g className="training-side-leg training-side-leg-right">
        <path d="M153 139 H171 L175 222 H157Z" fill="#456ba4" />
      </g>
      <g opacity="0.2"><Shoe x={121} y={228} /></g>
      <g className="training-side-shoe training-side-shoe-left"><Shoe x={121} y={228} /></g>
      <g opacity="0.2"><Shoe x={154} y={228} /></g>
      <g className="training-side-shoe training-side-shoe-right"><Shoe x={154} y={228} /></g>
      <>
          <g opacity="0.2"><path d="M124 84 Q116 79 111 89 L99 121 L96 150 Q96 157 102 158 Q108 158 109 151 L114 126 L130 94Z" fill="#eab395" /></g>
          <g className="training-side-arm training-side-arm-left"><path d="M124 84 Q116 79 111 89 L99 121 L96 150 Q96 157 102 158 Q108 158 109 151 L114 126 L130 94Z" fill="#eab395" /></g>
          <g opacity="0.2"><path d="M178 84 Q186 79 191 89 L203 121 L206 150 Q206 157 200 158 Q194 158 193 151 L188 126 L172 94Z" fill="#eab395" /></g>
          <g className="training-side-arm training-side-arm-right"><path d="M178 84 Q186 79 191 89 L203 121 L206 150 Q206 157 200 158 Q194 158 193 151 L188 126 L172 94Z" fill="#eab395" /></g>
        </>
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L177 141 H126Z" fill="#4a8fcb" />
      <path d="M126 135 H177 V143 H126Z" fill="#3676b4" />
      <Head />
      <g className="training-side-arm-cues" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <g className="training-arrow-arm-left"><path transform="translate(-16 0)" d="M72 154 Q54 120 79 91 M73 96 L79 91 L79 99 M72 146 L72 154 L64 152" strokeLinecap="round" strokeLinejoin="round" /></g>
          <g className="training-arrow-arm-right"><path transform="translate(16 0)" d="M226 154 Q244 120 220 91 M220 99 L220 91 L226 96 M226 146 L226 154 L234 152" strokeLinecap="round" strokeLinejoin="round" /></g>
        </g>
      <g className="training-arrow-step-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M62 205 H94 M68 200 L62 205 L68 210 M88 200 L94 205 L88 210" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-step-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M205 205 H237 M211 200 L205 205 L211 210 M231 200 L237 205 L231 210" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
