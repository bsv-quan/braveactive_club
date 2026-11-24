import { Head } from "./shared";

function ShoulderBlade({ side }: { side: "left" | "right" }) {
  return side === "left"
    ? <path d="M126 94 Q132 91 137 97 Q141 106 143 116 Q144 123 140 125 Q133 122 129 113 Q126 103 126 94Z" fill="#bce0f5" stroke="#d9effc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    : <path d="M177 94 Q171 91 166 97 Q162 106 160 116 Q159 123 163 125 Q170 122 174 113 Q177 103 177 94Z" fill="#bce0f5" stroke="#d9effc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
}

export function ShoulderBladesIllustration() {
  return (
    <g>
      <Head back />
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 Q190 96 194 113 Q188 120 181 122 Q179 154 177 185 Q151 188 126 185 Q124 154 122 122 Q114 120 108 113 Q113 95 120 79Z" fill="#4a8fcb" />
      <path d="M126 177 Q151 179 177 177 Q178 182 177 187 Q151 189 126 187 Q125 182 126 177Z" fill="#3676b4" />
      <path d="M120 79 Q112 78 107 88 Q102 104 100 121 Q106 124 112 125 Q117 114 123 103 Q124 90 120 79Z" fill="#397fbd" />
      <path d="M100 121 Q97 145 96 168 Q96 177 102 178 Q108 179 110 171 Q111 147 112 125 Q106 122 100 121Z" fill="#eab395" />
      <path d="M183 79 Q191 78 196 88 Q201 104 203 121 Q197 124 191 125 Q186 114 180 103 Q179 90 183 79Z" fill="#397fbd" />
      <path d="M203 121 Q206 145 207 168 Q207 177 201 178 Q195 179 193 171 Q192 147 191 125 Q197 122 203 121Z" fill="#eab395" />
      <g aria-hidden="true">
        <g opacity="0.2"><ShoulderBlade side="left" /></g>
        <g className="training-shoulder-left-back"><ShoulderBlade side="left" /></g>
        <g opacity="0.2"><ShoulderBlade side="right" /></g>
        <g className="training-shoulder-right-back"><ShoulderBlade side="right" /></g>
        <g className="training-arrow-left" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M101 68 H132 M126 63 L132 68 L126 73" strokeLinecap="round" strokeLinejoin="round" /></g>
        <g className="training-arrow-right" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M202 68 H171 M177 63 L171 68 L177 73" strokeLinecap="round" strokeLinejoin="round" /></g>
      </g>
    </g>
  );
}
