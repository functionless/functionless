import { MDXProvider } from "@mdx-js/react";
import MDXComponents from "@theme/MDXComponents";
import React from "react";
export default function MDXContent({ children }) {
  return <MDXProvider components={MDXComponents}>{children}</MDXProvider>;
}
