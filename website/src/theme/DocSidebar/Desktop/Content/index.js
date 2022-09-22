import Content from "@theme-original/DocSidebar/Desktop/Content";
import React from "react";

export default function ContentWrapper(props) {
  return (
    <div className="mt-1">
      <Content {...props} />
    </div>
  );
}
