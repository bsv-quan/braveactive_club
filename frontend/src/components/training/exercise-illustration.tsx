import { ChinTuckIllustration } from "./illustrations/chin-tuck";
import { ElbowBendsIllustration } from "./illustrations/elbow-bends";
import { MarchIllustration } from "./illustrations/march-in-place";
import { NeckSideTiltIllustration } from "./illustrations/neck-side-tilt";
import { SeatedHeelRaisesIllustration } from "./illustrations/seated-heel-raises";
import { SeatedKneeExtensionIllustration } from "./illustrations/seated-knee-extension";
import { SeatedToeRaisesIllustration } from "./illustrations/seated-toe-raises";
import { ShoulderBladesIllustration } from "./illustrations/shoulder-blades";
import { ShoulderLiftsIllustration } from "./illustrations/shoulder-lifts";
import { ShoulderSideRaiseIllustration } from "./illustrations/shoulder-side-raise";
import { SideStepArmsIllustration } from "./illustrations/side-step-arms";
import { SitToStandIllustration } from "./illustrations/sit-to-stand";
import { StandingArmStretchIllustration } from "./illustrations/standing-arm-stretch";
import { StandingHeelRaisesIllustration } from "./illustrations/standing-heel-raises";
import { SupportedSideLegRaiseIllustration } from "./illustrations/supported-side-leg-raise";
import { WeightedShoulderRaiseIllustration } from "./illustrations/weighted-shoulder-raise";
import { WristCirclesIllustration } from "./illustrations/wrist-circles";
import type { ExerciseId } from "@/lib/training";

type Props = { id: ExerciseId; label: string };
type WrappedExerciseId = Exclude<ExerciseId, "sit-to-stand" | "march-in-place">;

const illustrations = {
  "shoulder-lifts": ShoulderLiftsIllustration,
  "shoulder-blades": ShoulderBladesIllustration,
  "neck-side-tilt": NeckSideTiltIllustration,
  "chin-tuck": ChinTuckIllustration,
  "wrist-circles": WristCirclesIllustration,
  "elbow-bends": ElbowBendsIllustration,
  "seated-toe-raises": SeatedToeRaisesIllustration,
  "seated-heel-raises": SeatedHeelRaisesIllustration,
  "seated-knee-extension": SeatedKneeExtensionIllustration,
  "standing-heel-raises": StandingHeelRaisesIllustration,
  "standing-arm-stretch": StandingArmStretchIllustration,
  "shoulder-side-raise": ShoulderSideRaiseIllustration,
  "weighted-shoulder-raise": WeightedShoulderRaiseIllustration,
  "supported-side-leg-raise": SupportedSideLegRaiseIllustration,
  "side-step-arms": SideStepArmsIllustration,
} satisfies Record<WrappedExerciseId, () => React.ReactNode>;

/** Select the illustration and preserve its exercise-specific SVG framing. */
export function ExerciseIllustration({ id, label }: Props) {
  if (id === "sit-to-stand") return <SitToStandIllustration label={label} />;
  if (id === "march-in-place") return <MarchIllustration label={label} />;

  const Illustration = illustrations[id];
  return (
    <svg viewBox={id === "seated-heel-raises" || id === "seated-knee-extension" || id === "seated-toe-raises" ? "0 74 300 160" : "0 0 300 240"} role="img" aria-label={label} className="training-drawing" data-exercise={id}>
      <Illustration />
    </svg>
  );
}
