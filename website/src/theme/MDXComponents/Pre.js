import CodeBlock from "@theme/CodeBlock";
import React, { isValidElement } from "react";
export default function MDXPre(props) {
  return (
    <CodeBlock
      // If this pre is created by a ``` fenced codeblock, unwrap the children
      {...(isValidElement(props.children) &&
      props.children.props?.originalType === "code"
        ? props.children.props
        : { ...props })}
    />
  );
}
