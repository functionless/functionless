import React from "react";
import Desktop from "@theme-original/DocSidebar/Desktop";

export default function DesktopWrapper(props) {
  return (
    <div className="mt-1 [&>div]:!block [&>div]:!max-h-full">
      <Desktop {...props} />
    </div>
  );
}
