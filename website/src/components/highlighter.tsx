/* eslint-disable import/no-extraneous-dependencies */
import { usePrismTheme } from "@docusaurus/theme-common";
import Highlight, { defaultProps } from "prism-react-renderer";

interface HighlighterProps {
  children: string;
  tokenReplacement?: (token: PrismToken) => PrismToken;
}

export type PrismToken = {
  types: string[];
  content: string;
  empty?: boolean;
};

/**
 * A highlighter with built in overrides for Functionless.
 *
 * Function - Generally classified as a built in, this highlighter removes the built-in
 * to support Functionless {@link Function}.
 */
export function FunctionlessHighlighter({
  children,
  tokenReplacement,
}: HighlighterProps) {
  return (
    <Highlighter
      tokenReplacement={(token) => {
        const newToken = (() => {
          if (token.content === "Function" && token.types.includes("builtin")) {
            return {
              ...token,
              types: token.types.filter((x) => x !== "builtin"),
            };
          }
          return token;
        })();
        return tokenReplacement ? tokenReplacement(newToken) : newToken;
      }}
    >
      {children}
    </Highlighter>
  );
}

export default function Highlighter({
  children,
  tokenReplacement,
}: HighlighterProps) {
  const theme = usePrismTheme();

  return (
    <Highlight
      {...defaultProps}
      code={children}
      theme={theme}
      language="typescript"
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={style}>
          {tokens.map((line, i) => (
            <div {...getLineProps({ line, key: i })}>
              {line.map((token, key) => {
                return (
                  <span
                    {...getTokenProps({
                      token: tokenReplacement ? tokenReplacement(token) : token,
                      key,
                    })}
                  />
                );
              })}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
