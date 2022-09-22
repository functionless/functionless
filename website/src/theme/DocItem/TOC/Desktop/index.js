import Desktop from "@theme-original/DocItem/TOC/Desktop";
import React from "react";

export default function DesktopWrapper(props) {
  return (
    <div className="[&_a]:text-functionless-dark-medium [&_a]:text-sm [&_a]:my-4 hover:[&_a]:text-functionless-blue [&_.table-of-contents]:border-none">
      <Desktop {...props} />
    </div>
  );
}
