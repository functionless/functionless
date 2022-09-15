import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

export interface ScreenshotProps {
  src: string;
}

export function Screenshot({ src }: ScreenshotProps) {
  return (
    <div style={{ margin: "1.5em" }}>
      <Zoom>
        <img src={src} />
      </Zoom>
    </div>
  );
}
