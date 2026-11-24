export function Head({
  back = false
}: {
  back?: boolean;
}) {
  return (
    <g>
      <path d="M142 58 Q143 69 143 79 Q151 82 160 79 Q160 68 160 58" fill="#cf9271" />
      <path d="M131 37 Q132 15 151 15 Q171 15 172 37 Q171 45 169 52 Q165 65 151 67 Q137 65 133 52 Q131 44 131 37Z" fill="#eab395" />
      <path d={back ? "M130 42 Q126 14 150 12 Q175 13 173 43 Q166 55 151 54 Q136 55 130 42Z" : "M130 38 Q126 14 150 12 Q175 13 173 37 Q163 35 157 28 Q147 36 131 35 Q130 37 130 38Z"} fill="#263e53" />
      {!back && <><circle cx="143" cy="42" r="1.5" fill="#263e53" /><circle cx="160" cy="42" r="1.5" fill="#263e53" /><path d="M147 53 Q151 56 155 53" fill="none" stroke="#ad715d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>}
    </g>
  );
}

export function Chair() {
  return (
    <g>
      <path d="M48 75 Q50 111 52 147 Q89 148 127 147 M59 149 Q57 187 55 225 M120 149 Q122 187 124 225" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 69 Q51 65 57 69 Q60 102 62 137 Q55 140 48 137 Q47 103 46 69Z M49 137 Q88 133 127 137 Q133 138 133 145 Q133 148 131 150 Q89 153 49 150 Q46 145 49 137Z" fill="#758ca0" />
    </g>
  );
}

export function Shoe({
  x = 0,
  y = 0
}: {
  x?: number;
  y?: number;
}) {
  return <path d={`M${x} ${y} q3 -8 12 -7 q8 2 16 5 q5 1 5 1 q-1 1 -4 1 q-13 0 -26 0 q-3 0 -3 0Z`} fill="#263e53" stroke="#d6e5ef" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
}
