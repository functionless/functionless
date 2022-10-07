import { Expression } from "./expression";

// @ts-ignore - imported for tsdoc
import type { Stack } from "./stack;";

/**
 * Output values from a {@link Stack}.
 *
 * The optional {@link Outputs} section declares output values that you can import into other {@link Stack}s (to create cross-stack references),
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html
 */
export interface Outputs {
  [outputId: string]: Expression;
}
