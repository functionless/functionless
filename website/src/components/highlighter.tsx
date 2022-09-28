/* eslint-disable import/no-extraneous-dependencies */
import { usePrismTheme } from "@docusaurus/theme-common";
import Highlight, { defaultProps } from "prism-react-renderer";

interface HighlighterProps {
  children: string;
  tokenReplacement?: (token: PrismToken) => PrismToken;
}

export interface PrismToken {
  types: string[];
  content: string;
  empty?: boolean;
}

const tokenReplacementMap: Record<string, string> = {
  Function: "class-name",
  " $": "constant",
};

export const functionlessTokenReplacement = (token: PrismToken) => {
  const replacement = tokenReplacementMap[token.content];
  return replacement ? { ...token, types: [replacement] } : token;
};

/**
 * A highlighter with built in overrides for Functionless.
 *
 * Function - Generally classified as a built in, this highlighter removes the built-in
 * to support Functionless {@link Function}.
 */
export function FunctionlessHighlighter({
  children,
  tokenReplacement = functionlessTokenReplacement,
}: HighlighterProps) {
  return (
    <Highlighter tokenReplacement={tokenReplacement}>{children}</Highlighter>
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
