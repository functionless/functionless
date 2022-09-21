import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { MDXProvider } from "@mdx-js/react";
import theme from "@site/src/lib/code-theme";
import clsx from "clsx";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import React, { ReactElement, useMemo } from "react";
import { Timeline } from "../../lib/useTimeline";
import { functionlessTokenReplacement } from "../highlighter";

const CodeWindow = ({
  fileName,
  code,
  children,
}: React.PropsWithChildren<{
  fileName: string;
  code: string;
}>) => (
  <div className="window">
    <Header fileName={fileName} code={code} />
    <div className="py-4 bg-functionless-code">{children}</div>
  </div>
);

/**
 * A component for displaying code loaded from mdx
 */
export const Code = ({
  children,
  animate,
  fileName,
  language,
  introDelayMs,
}: React.PropsWithChildren<{
  animate: boolean;
  fileName: string;
  language: Language;
  introDelayMs: number;
}>) =>
  //Needs to be memod otherwise the animation will reset when its re-rendered, even if props doesn't change
  useMemo(
    () => (
      <MDXProvider
        components={{
          pre: ({ children }: { children: ReactElement }) => (
            <pre className="p-0 overflow-unset">{children}</pre>
          ),
          code: ({ children: code }: { children: string }) => (
            <CodeWindow fileName={fileName} code={code}>
              <HighlightedCode
                code={code}
                language={language}
                introDelayMs={introDelayMs}
                animate={animate}
              />
            </CodeWindow>
          ),
        }}
      >
        {children}
      </MDXProvider>
    ),
    [animate, fileName, language, introDelayMs]
  );

/**
 * A component for displaying code loaded from mdx, animated according to a given timeline. Source code is split into timeline segments by '$$' symbol
 */
export function TimelineCode<K extends string>({
  children,
  animate,
  fileName,
  language,
  timeline,
}: React.PropsWithChildren<{
  animate: boolean;
  fileName: string;
  language: Language;
  timeline: Timeline<K>;
}>) {
  return useMemo(
    () => (
      <MDXProvider
        components={{
          pre: ({ children }: { children: ReactElement }) => (
            <pre className="p-0 overflow-unset">{children}</pre>
          ),
          code: ({ children: code }: { children: string }) => {
            const splitCode = code.split("$$;");
            return (
              <CodeWindow fileName={fileName} code={code}>
                {splitCode.map((chunk, i) => (
                  <HighlightedCode
                    key={i}
                    code={chunk.trimEnd()}
                    language={language}
                    introDelayMs={timeline[Object.keys(timeline)[i] as K]}
                    animate={animate}
                    lineNumberStart={splitCode
                      .slice(0, i)
                      .reduce((count, ch) => count + ch.split("\n").length, 1)}
                  />
                ))}
              </CodeWindow>
            );
          },
        }}
      >
        {children}
      </MDXProvider>
    ),
    [children, animate, fileName, language, timeline]
  );
}

const Header = ({ fileName, code }: { fileName: string; code: string }) => (
  <div>
    <div className="flex items-center px-4 py-4 bg-functionless-code rounded-t-lg">
      <div className="flex space-x-1">
        <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
        <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
        <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
      </div>
      <div className="text-[#B3BABF] flex-1 text-center font-display subtitle2">
        {fileName}
      </div>
      <DocumentDuplicateIcon
        className="icon [overflow:unset]"
        onClick={() => {
          void navigator.clipboard.writeText(code);
        }}
      />
    </div>
    <div className="h-0.5 bg-functionless-dark-border" />
  </div>
);

const HighlightedCode = ({
  code,
  language,
  animate,
  introDelayMs,
  lineNumberStart = 1,
}: {
  code: string;
  language: Language;
  animate: boolean;
  introDelayMs: number;
  lineNumberStart?: number;
}) => {
  return (
    <Highlight {...defaultProps} theme={theme} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div
          className={clsx(className, "text-xs px-4 font-semibold font-mono")}
          style={style}
        >
          {tokens.map((line, i) => {
            const lineIndexStart = tokens
              .slice(0, i)
              .flatMap((t) => t)
              .reduce((n, l) => n + l.content.length, 0);
            return (
              <div
                key={i}
                {...getLineProps({
                  line,
                  key: i,
                  className: "grid grid-cols-[2em_auto] py-0.5",
                })}
              >
                <div>{i + lineNumberStart}</div>
                <div className="flex flex-wrap">
                  {line.map((token, j) => {
                    const lineIndex = line
                      .slice(0, j)
                      .reduce((n, t) => n + t.content.length, 0);
                    return token.content.split("").map((char, k) => (
                      <span
                        key={k}
                        {...getTokenProps({
                          token: {
                            ...functionlessTokenReplacement(token),
                            content: char,
                          },
                          key: k,
                          className: animate
                            ? "animate-fade-in opacity-0"
                            : undefined,
                          style: {
                            animationDelay: `${
                              (lineIndexStart + lineIndex + k) * 10 +
                              introDelayMs
                            }ms`,
                          },
                        })}
                      />
                    ));
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Highlight>
  );
};
