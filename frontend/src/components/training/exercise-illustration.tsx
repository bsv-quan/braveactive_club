import { SitToStandIllustration } from "@/components/training/sit-to-stand-illustration";
import { MarchIllustration } from "@/components/training/march-illustration";
import type { ExerciseId } from "@/lib/training";

type Props = { id: ExerciseId; label: string };

function Head({ back = false }: { back?: boolean }) {
  return (
    <g>
      <path d="M142 58 L143 79 L160 79 L160 58" fill="#cf9271" />
      <path d="M131 37 Q132 15 151 15 Q171 15 172 37 L169 52 Q166 66 151 67 Q136 66 133 52Z" fill="#eab395" />
      <path d={back ? "M130 42 Q126 14 150 12 Q175 13 173 43 Q166 55 151 54 Q136 55 130 42Z" : "M130 38 Q126 14 150 12 Q175 13 173 37 Q163 35 157 28 Q147 36 131 35Z"} fill="#263e53" />
      {!back && <><circle cx="143" cy="42" r="1.5" fill="#263e53" /><circle cx="160" cy="42" r="1.5" fill="#263e53" /><path d="M147 53 Q151 56 155 53" fill="none" stroke="#ad715d" strokeWidth="1.5" strokeLinecap="round" /></>}
    </g>
  );
}

function ShoulderIllustration({ blades }: { blades: boolean }) {
  return (
    <g>
      <Head back={blades} />
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L194 113 L181 122 L177 185 H126 L122 122 L108 113Z" fill="#4a8fcb" />
      <path d="M126 177 H177 V187 H126Z" fill="#3676b4" />
      <g className={blades ? undefined : "training-shoulder-lift"}>
        {!blades && <path d="M119 79 Q127 72 140 74 L140 88 L120 98Z" fill="#4a8fcb" />}
        <path d="M120 79 Q112 78 107 88 L100 121 L112 125 L123 103Z" fill="#397fbd" />
        <path d="M100 121 L96 168 Q96 177 102 178 Q108 179 110 171 L112 125Z" fill="#eab395" />
      </g>
      <g className={blades ? undefined : "training-shoulder-lift"}>
        {!blades && <path d="M183 79 Q175 72 163 74 L163 88 L183 98Z" fill="#4a8fcb" />}
        <path d="M183 79 Q191 78 196 88 L203 121 L191 125 L180 103Z" fill="#397fbd" />
        <path d="M203 121 L207 168 Q207 177 201 178 Q195 179 193 171 L191 125Z" fill="#eab395" />
      </g>
      {blades && (
        <g aria-hidden="true">
          <path className="training-shoulder-left-back" d="M126 94 Q132 91 137 97 L143 116 Q144 123 140 125 Q133 122 129 113Z" fill="#bce0f5" stroke="#d9effc" strokeWidth="2" />
          <path className="training-shoulder-right-back" d="M177 94 Q171 91 166 97 L160 116 Q159 123 163 125 Q170 122 174 113Z" fill="#bce0f5" stroke="#d9effc" strokeWidth="2" />
          <path d="M101 68 H132 M126 63 L132 68 L126 73 M202 68 H171 M177 63 L171 68 L177 73" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {!blades && (
        <g fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M77 82 V113 M72 87 L77 82 L82 87 M72 108 L77 113 L82 108" />
          <path d="M226 82 V113 M221 87 L226 82 L231 87 M221 108 L226 113 L231 108" />
        </g>
      )}
    </g>
  );
}

function NeckIllustration({ tuck }: { tuck: boolean }) {
  return (
    <g>
      {tuck ? (
        <>
          <path d="M116 185 Q118 145 124 105 Q128 80 143 75 L160 76 Q171 81 172 95 L166 185Z" fill="#4a8fcb" />
          <path className="training-neck-tuck-neck" d="M143 76 L147 59 L160 60 L160 79Z" fill="#cf9271" />
          <g className="training-neck-tuck">
            <path d="M144 40 Q146 24 160 24 Q176 24 177 40 L174 51 Q172 62 163 64 Q151 64 147 52Z" fill="#eab395" />
            <path d="M143 43 Q140 28 149 23 Q159 17 169 23 Q178 26 178 39 L173 40 Q170 34 166 33 Q157 39 145 38 L148 49Z" fill="#263e53" />
            <path d="M173 42 L178 46 L173 48" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="169" cy="41" r="1.5" fill="#263e53" />
            <path d="M157 61 Q162 64 168 61" fill="none" stroke="#cf9271" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <path d="M169 12 H127 M133 7 L127 12 L133 17" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <path d="M188 41 H225" fill="none" stroke="#91a8ba" strokeWidth="2" strokeDasharray="4 4" aria-hidden="true" />
        </>
      ) : (
        <>
          <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L194 113 L181 122 L177 185 H126 L122 122 L108 113Z" fill="#4a8fcb" />
          <path d="M142 58 L143 79 L160 79 L160 58" fill="#cf9271" />
          <g className="training-neck-tilt"><Head /></g>
          <path d="M95 35 Q102 18 118 16 M98 29 L95 35 L102 34 M184 16 Q200 18 207 35 M200 34 L207 35 L204 29" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        </>
      )}
    </g>
  );
}

function WristIllustration() {
  return (
    <g>
      <path d="M43 168 Q61 134 114 130 L128 146 Q111 160 92 174 L64 196Z" fill="#4a8fcb" />
      <path d="M257 168 Q239 134 186 130 L172 146 Q189 160 208 174 L236 196Z" fill="#4a8fcb" />
      <path d="M78 141 Q88 128 99 122 L123 124 L123 140 L102 155Z" fill="#eab395" />
      <path d="M222 141 Q212 128 201 122 L177 124 L177 140 L198 155Z" fill="#eab395" />
      <g transform="translate(-32 0)"><g className="training-wrist training-wrist-left">
        <path d="M131 122 Q126 112 129 103 L129 79 Q129 74 133 74 Q137 74 137 79 L137 97 L138 69 Q138 64 142 64 Q146 64 146 69 L146 96 L148 73 Q148 68 152 69 Q156 69 155 74 L155 99 L158 83 Q159 78 163 79 Q167 80 165 85 L163 112 Q162 120 155 126Z" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" />
      </g></g>
      <g transform="translate(32 0)"><g className="training-wrist training-wrist-right">
        <path d="M169 122 Q174 112 171 103 L171 79 Q171 74 167 74 Q163 74 163 79 L163 97 L162 69 Q162 64 158 64 Q154 64 154 69 L154 96 L152 73 Q152 68 148 69 Q144 69 145 74 L145 99 L142 83 Q141 78 137 79 Q133 80 135 85 L137 112 Q138 120 145 126Z" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" />
      </g></g>
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

function Chair() {
  return (
    <g>
      <path d="M48 75 L52 147 H127 M59 149 L55 225 M120 149 L124 225" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" />
      <path d="M46 69 H57 L62 137 H48Z M49 137 H127 Q133 137 133 145 V150 H49Z" fill="#758ca0" />
    </g>
  );
}

function Shoe({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return <path d={`M${x} ${y} q3 -8 12 -7 l16 5 q5 2 5 7 h-33Z`} fill="#263e53" stroke="#d6e5ef" strokeWidth="1.5" />;
}

function ElbowBendsIllustration() {
  return (
    <g>
      <Head />
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L180 185 H123Z" fill="#4a8fcb" />
      <path d="M120 79 Q111 77 107 88 L100 121 L112 125 L125 99Z M183 79 Q192 77 196 88 L203 121 L191 125 L178 99Z" fill="#397fbd" />
      <g className="training-elbow-bend training-elbow-bend-left">
        <path d="M100 121 Q106 118 112 125 L111 160 Q110 167 104 167 Q98 167 98 160Z" fill="#eab395" />
      </g>
      <g className="training-elbow-bend training-elbow-bend-right">
        <path d="M191 125 Q197 118 203 121 L205 160 Q205 167 199 167 Q193 167 192 160Z" fill="#eab395" />
      </g>
      <path d="M70 154 Q54 133 65 108 M61 113 L65 108 L70 113 M66 149 L70 154 L64 154 M232 154 Q248 133 237 108 M232 113 L237 108 L241 113 M236 149 L232 154 L238 154" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </g>
  );
}

function SeatedToeRaisesIllustration() {
  return (
    <g>
      <path d="M31 227 H271" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <Chair />
      <path d="M74 85 Q76 68 92 68 L114 70 Q125 72 126 86 L120 138 H72Z" fill="#4a8fcb" />
      <path d="M112 80 Q119 79 123 90 L132 116 L124 120 L110 96Z" fill="#eab395" />
      <path d="M75 132 Q67 140 76 151 L143 151 Q153 150 153 140 Q152 132 140 131Z" fill="#456ba4" />
      <path d="M85 136 Q79 143 88 154 L155 154 Q164 153 164 144 Q163 136 153 135Z" fill="#3c6097" />
      <path d="M132 145 Q132 137 141 137 Q150 137 150 147 L155 227 H137Z" fill="#304e80" />
      <path d="M145 149 Q145 141 154 141 Q163 141 163 151 L169 227 H150Z" fill="#456ba4" />
      <g className="training-toe-raise training-toe-raise-far"><Shoe x={135} y={227} /></g>
      <g className="training-toe-raise training-toe-raise-near"><Shoe x={149} y={227} /></g>
      <path d="M198 190 V216 M193 195 L198 190 L203 195 M193 211 L198 216 L203 211" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </g>
  );
}

function SeatedLegs({ extension }: { extension: boolean }) {
  return (
    <g>
      <path d="M31 227 H271" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <Chair />
      <path d="M74 85 Q76 68 92 68 L114 70 Q125 72 126 86 L120 138 H72Z" fill="#4a8fcb" />
      <path d="M112 80 Q119 79 123 90 L132 116 L124 120 L110 96Z" fill="#eab395" />
      <path d="M75 132 Q67 140 76 151 L143 151 Q153 150 153 140 Q152 132 140 131Z" fill="#456ba4" />
      <path d="M85 136 Q79 143 88 154 L155 154 Q164 153 164 144 Q163 136 153 135Z" fill="#3c6097" />
      {extension ? (
        <>
          <g className="training-knee-far">
            <path d="M132 145 Q132 137 141 137 Q150 137 150 147 L155 216 H137Z" fill="#304e80" />
            <Shoe x={135} y={225} />
          </g>
          <g className="training-knee-near">
            <path d="M145 149 Q145 141 154 141 Q163 141 163 151 L169 216 H150Z" fill="#456ba4" />
            <Shoe x={149} y={228} />
          </g>
          <path d="M190 210 Q221 196 225 160 M184 208 L190 210 L189 216 M219 164 L225 160 L229 166" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        </>
      ) : (
        <>
          <g className="training-seated-calf"><path d="M132 145 Q132 137 141 137 Q150 137 150 147 L155 227 H137Z" fill="#304e80" /><path d="M145 149 Q145 141 154 141 Q163 141 163 151 L169 227 H150Z" fill="#456ba4" /></g>
          <g className="training-seated-heel training-seated-heel-far"><Shoe x={135} y={227} /></g>
          <g className="training-seated-heel"><Shoe x={149} y={227} /></g>
          <path d="M198 190 V216 M193 195 L198 190 L203 195 M193 211 L198 216 L203 211" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        </>
      )}
    </g>
  );
}

function StandingIllustration() {
  return (
    <g>
      <path d="M30 228 H276" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <path d="M211 116 H265 M245 116 V225" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" />
      <g className="training-standing-shoe training-standing-shoe-far"><Shoe x={125} y={228} /></g>
      <g className="training-standing-shoe"><Shoe x={145} y={228} /></g>
      <g className="training-standing-lift">
        <path d="M132 141 Q141 134 148 143 L144 220 H128Z" fill="#304e80" />
        <path d="M149 141 Q158 134 165 143 L164 222 H148Z" fill="#456ba4" />
        <path d="M129 139 Q130 122 133 102 L137 79 Q140 70 150 70 L160 73 Q168 75 168 85 L165 117 L164 141Z" fill="#4a8fcb" />
        <path d="M129 135 H164 V143 H129Z" fill="#3676b4" />
        <path d="M145 73 L148 61 L160 63 L160 76Z" fill="#cf9271" />
        <path d="M144 40 Q146 24 160 24 Q176 24 177 40 L174 51 Q172 62 163 64 Q151 64 147 52Z" fill="#eab395" />
        <path d="M143 43 Q140 28 149 23 Q159 17 169 23 Q178 26 178 39 L173 40 Q170 34 166 33 Q157 39 145 38 L148 49Z" fill="#263e53" />
        <path d="M173 42 L178 46 L173 48" fill="#eab395" stroke="#cf9271" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="169" cy="41" r="1.5" fill="#263e53" />
      </g>
      <g className="training-standing-arm">
        <path d="M150 80 Q156 76 162 82 L179 104 L211 108 Q218 108 219 112 Q219 116 212 116 L175 114 L148 92 Q145 86 150 80Z" fill="#eab395" />
        <path d="M145 77 Q151 72 158 76 L166 87 L154 95 L145 87 Q142 82 145 77Z" fill="#397fbd" />
      </g>
      <path d="M102 183 V211 M97 188 L102 183 L107 188 M97 206 L102 211 L107 206" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </g>
  );
}

function StandingArmStretchIllustration() {
  return (
    <g>
      <path d="M37 228 H269" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      <path d="M131 139 H149 L145 222 H127Z" fill="#304e80" />
      <path d="M153 139 H171 L175 222 H157Z" fill="#456ba4" />
      <Shoe x={121} y={228} />
      <Shoe x={154} y={228} />
      <g className="training-stretch-arm training-stretch-arm-left">
        <path d="M124 84 Q116 79 111 89 L99 121 L96 150 Q96 157 102 158 Q108 158 109 151 L114 126 L130 94Z" fill="#eab395" />
        <path d="M124 78 Q115 75 110 87 L106 100 L119 106 L130 91Z" fill="#397fbd" />
      </g>
      <g className="training-stretch-arm training-stretch-arm-right">
        <path d="M178 84 Q186 79 191 89 L203 121 L206 150 Q206 157 200 158 Q194 158 193 151 L188 126 L172 94Z" fill="#eab395" />
        <path d="M178 78 Q187 75 192 87 L196 100 L183 106 L172 91Z" fill="#397fbd" />
      </g>
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L177 141 H126Z" fill="#4a8fcb" />
      <path d="M126 135 H177 V143 H126Z" fill="#3676b4" />
      <Head />
      <path d="M71 143 V92 M66 98 L71 92 L76 98 M66 137 L71 143 L76 137 M231 143 V92 M226 98 L231 92 L236 98 M226 137 L231 143 L236 137" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </g>
  );
}

function LateralRaiseIllustration({ weighted }: { weighted: boolean }) {
  return (
    <g>
      <Head />
      <g className="training-lateral-arm training-lateral-arm-left">
        <path d="M124 84 Q116 79 111 89 L99 121 L96 150 Q96 157 102 158 Q108 158 109 151 L114 126 L130 94Z" fill="#eab395" />
        {weighted && <rect x="94" y="146" width="17" height="27" rx="4" fill="#758ca0" stroke="#526778" strokeWidth="2" />}
      </g>
      <g className="training-lateral-arm training-lateral-arm-right">
        <path d="M178 84 Q186 79 191 89 L203 121 L206 150 Q206 157 200 158 Q194 158 193 151 L188 126 L172 94Z" fill="#eab395" />
        {weighted && <rect x="191" y="146" width="17" height="27" rx="4" fill="#758ca0" stroke="#526778" strokeWidth="2" />}
      </g>
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L177 185 H126Z" fill="#4a8fcb" />
      <path d="M72 154 Q54 120 79 91 M73 96 L79 91 L79 99 M226 154 Q244 120 220 91 M220 99 L220 91 L226 96" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </g>
  );
}

function SideMovementIllustration({ supported }: { supported: boolean }) {
  return (
    <g className={supported ? "training-side-supported" : undefined}>
      <path d="M30 228 H276" stroke="#91a8ba" strokeWidth="3" strokeLinecap="round" />
      {supported && <path d="M203 112 H270 M250 112 V225" fill="none" stroke="#526778" strokeWidth="8" strokeLinecap="round" />}
      <g className="training-side-leg training-side-leg-left">
        <path d="M131 139 H149 L145 222 H127Z" fill="#304e80" />
      </g>
      <g className="training-side-leg training-side-leg-right">
        <path d="M153 139 H171 L175 222 H157Z" fill="#456ba4" />
      </g>
      <g className="training-side-shoe training-side-shoe-left"><Shoe x={121} y={228} /></g>
      <g className="training-side-shoe training-side-shoe-right"><Shoe x={154} y={228} /></g>
      {supported ? (
        <path d="M174 87 L188 109 L210 108 L210 116 L183 117 L165 98Z" fill="#eab395" />
      ) : (
        <>
          <g className="training-side-arm training-side-arm-left"><path d="M124 84 Q116 79 111 89 L99 121 L96 150 Q96 157 102 158 Q108 158 109 151 L114 126 L130 94Z" fill="#eab395" /></g>
          <g className="training-side-arm training-side-arm-right"><path d="M178 84 Q186 79 191 89 L203 121 L206 150 Q206 157 200 158 Q194 158 193 151 L188 126 L172 94Z" fill="#eab395" /></g>
        </>
      )}
      <path d="M120 79 Q128 73 139 73 Q151 82 164 73 Q175 74 183 79 L177 141 H126Z" fill="#4a8fcb" />
      <path d="M126 135 H177 V143 H126Z" fill="#3676b4" />
      <Head />
      {!supported && (
        <g className="training-side-arm-cues" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path transform="translate(-16 0)" d="M72 154 Q54 120 79 91 M73 96 L79 91 L79 99 M72 146 L72 154 L64 152" />
          <path transform="translate(16 0)" d="M226 154 Q244 120 220 91 M220 99 L220 91 L226 96 M226 146 L226 154 L234 152" />
        </g>
      )}
      <path d="M62 205 H94 M68 200 L62 205 L68 210 M88 200 L94 205 L88 210 M205 205 H237 M211 200 L205 205 L211 210 M231 200 L237 205 L231 210" fill="none" stroke="#3676b4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </g>
  );
}

/** Select a purpose-drawn illustration for every supported exercise. */
export function ExerciseIllustration({ id, label }: Props) {
  if (id === "sit-to-stand") return <SitToStandIllustration label={label} />;
  if (id === "march-in-place") return <MarchIllustration label={label} />;
  const illustrations = {
    "shoulder-lifts": <ShoulderIllustration blades={false} />,
    "shoulder-blades": <ShoulderIllustration blades />,
    "neck-side-tilt": <NeckIllustration tuck={false} />,
    "chin-tuck": <NeckIllustration tuck />,
    "wrist-circles": <WristIllustration />,
    "elbow-bends": <ElbowBendsIllustration />,
    "seated-toe-raises": <SeatedToeRaisesIllustration />,
    "seated-heel-raises": <SeatedLegs extension={false} />,
    "seated-knee-extension": <SeatedLegs extension />,
    "standing-heel-raises": <StandingIllustration />,
    "standing-arm-stretch": <StandingArmStretchIllustration />,
    "shoulder-side-raise": <LateralRaiseIllustration weighted={false} />,
    "weighted-shoulder-raise": <LateralRaiseIllustration weighted />,
    "supported-side-leg-raise": <SideMovementIllustration supported />,
    "side-step-arms": <SideMovementIllustration supported={false} />,
  } satisfies Record<Exclude<ExerciseId, "sit-to-stand" | "march-in-place">, React.ReactNode>;
  return (
    <svg viewBox={id === "seated-heel-raises" || id === "seated-knee-extension" || id === "seated-toe-raises" ? "0 74 300 160" : "0 0 300 240"} role="img" aria-label={label} className="training-drawing" data-exercise={id}>
      {illustrations[id]}
    </svg>
  );
}
