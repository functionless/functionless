import { compose } from "@site/src/content/home/features/compose/compose";
import { useState } from "react";
import { FeatureSection } from "../featureSection";
import { ComposeCode } from "./composeCode";
import { Diagram } from "./diagram";

export const ComposeFeature = () => {
  const [codeVisible, setCodeVisible] = useState(false);
  return (
    <FeatureSection
      {...compose}
      aside={() => <ComposeCode onVisibilityChanged={setCodeVisible} />}
      footer={() => <Diagram visible={codeVisible} />}
    />
  );
};
