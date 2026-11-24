import { Head, Shoe } from "./shared";

export function SupportedSideLegRaiseIllustration() {
  return (
    <g className="training-side-supported">
      <path d="M30 228 H276" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <path d="M203 112 H270 M250 112 V225" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" />
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
      <path d="M174 87 L188 109 L210 108 L210 116 L183 117 L165 98Z" fill="#eab395" />
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L177 141 H126Z" fill="#4a8fcb" />
      <path d="M126 135 H177 V143 H126Z" fill="#3676b4" />
      <Head />

      <g className="training-arrow-step-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M62 205 H94 M68 200 L62 205 L68 210 M88 200 L94 205 L88 210" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="training-arrow-step-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M205 205 H237 M211 200 L205 205 L211 210 M231 200 L237 205 L231 210" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  );
}
