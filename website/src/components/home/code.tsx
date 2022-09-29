import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { MDXProvider } from "@mdx-js/react";
import codeTheme from "@site/src/theme/code-theme";
import terminalTheme from "@site/src/theme/terminal-theme";
import clsx from "clsx";
import Highlight, {
  defaultProps,
  Language,
  PrismTheme,
} from "prism-react-renderer";
import React, { ReactElement, useMemo, useState } from "react";
import { Timeline } from "../../lib/useTimeline";
import { functionlessTokenReplacement } from "../highlighter";

/**
 * A component for displaying code loaded from mdx
 */
export const Terminal = ({
  children,
  animate,
  title,
  language,
  introDelayMs,
}: React.PropsWithChildren<{
  animate: boolean;
  title: string;
  language: Language;
  introDelayMs: number;
}>) =>
  //Needs to be memod otherwise the animation will reset when its re-rendered, even if props doesn't change
  useMemo(
    () => (
      <MDXProvider
        components={{
          pre: ({ children }: { children: ReactElement }) => (
            <pre
              className="p-0 overflow-unset animate-pop-up opacity-0"
              style={{ animationDelay: `${introDelayMs}ms` }}
            >
              {children}
            </pre>
          ),
          code: ({ children: code }: { children: string }) => (
            <TerminalWindow title={title} code={code}>
              <HighlightedCode
                theme={terminalTheme}
                code={code}
                language={language}
                introDelayMs={introDelayMs + 500}
                animate={animate ? "lines" : undefined}
                showLineNumbers={false}
              />
            </TerminalWindow>
          ),
        }}
      >
        {children}
      </MDXProvider>
    ),
    [animate, title, language, introDelayMs]
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
                theme={codeTheme}
                code={code}
                language={language}
                introDelayMs={introDelayMs}
                animate={animate ? "characters" : undefined}
                showLineNumbers={true}
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
  showLineNumbers,
}: React.PropsWithChildren<{
  animate: boolean;
  fileName: string;
  language: Language;
  timeline: Timeline<K>;
  showLineNumbers: boolean;
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
                    theme={codeTheme}
                    code={chunk.trimEnd()}
                    language={language}
                    introDelayMs={timeline[Object.keys(timeline)[i] as K]}
                    animate={animate ? "characters" : undefined}
                    lineNumberStart={splitCode
                      .slice(0, i)
                      .reduce((count, ch) => count + ch.split("\n").length, 1)}
                    showLineNumbers={showLineNumbers}
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

const CodeWindow = ({
  fileName,
  code,
  children,
}: React.PropsWithChildren<{
  fileName: string;
  code: string;
}>) => (
  <div className="window">
    <Header title={fileName} code={code} dark={false} copyButton />
    <div className="py-4 bg-functionless-code">{children}</div>
  </div>
);

const TerminalWindow = ({
  title,
  code,
  children,
}: React.PropsWithChildren<{
  title: string;
  code: string;
}>) => (
  <div className="window">
    <Header title={title} code={code} dark copyButton={false} />
    <div className="py-4 bg-functionless-black">{children}</div>
  </div>
);

const Header = ({
  title,
  code,
  copyButton,
  dark,
}: {
  title: string;
  code: string;
  copyButton: boolean;
  dark: boolean;
}) => {
  const [copiedTooltipVisible, setCopiedTooltipVisible] = useState(false);
  return (
    <div>
      <div
        className={clsx(
          "flex items-center px-4 py-4 rounded-t-lg",
          dark ? "bg-functionless-dark-bg" : "bg-functionless-code"
        )}
      >
        <div className="flex space-x-1">
          <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
          <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
          <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
        </div>
        <div className="text-[#B3BABF] flex-1 text-center font-display subtitle2">
          {title}
        </div>
        {copyButton && (
          <div>
            <DocumentDuplicateIcon
              className="icon [overflow:unset] hover:bg-blue-800 active:bg-functionless-blue rounded-full cursor-pointer p-0.5"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                setCopiedTooltipVisible(true);
                setTimeout(() => {
                  setCopiedTooltipVisible(false);
                }, 1000);
              }}
            />
            <div
              role="tooltip"
              className={clsx(
                "absolute -top-4 -right-0 z-10 py-2 px-3 text-sm font-display font-medium text-white bg-gray-900 rounded-lg shadow-sm transition duration-150 dark:bg-gray-700",
                copiedTooltipVisible
                  ? "opacity-1"
                  : "opacity-0 translate-y-2 scale-75"
              )}
            >
              Code copied!
            </div>
          </div>
        )}
      </div>
      <div className="h-0.5 bg-functionless-dark-border" />
    </div>
  );
};

const HighlightedCode = ({
  code,
  language,
  animate,
  introDelayMs,
  lineNumberStart = 1,
  showLineNumbers,
  theme,
}: {
  code: string;
  language: Language;
  animate?: "characters" | "lines";
  introDelayMs: number;
  lineNumberStart?: number;
  showLineNumbers: boolean;
  theme: PrismTheme;
}) => {
  return (
    <Highlight {...defaultProps} theme={theme} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div
          className={clsx(className, "text-xs px-4 font-semibold font-mono")}
          style={style}
        >
          {tokens
            //strip out final newlines
            .filter((t) => (t.length == 1 && !t[0].empty) || t.length > 1)
            .map((line, i) => {
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
                    className: clsx(
                      "py-0.5",
                      showLineNumbers && "grid grid-cols-[2em_auto]"
                    ),
                  })}
                >
                  {showLineNumbers && <div>{i + lineNumberStart}</div>}
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
                            className: "animate-fade-in opacity-0",
                            style: {
                              animationDelay: `${
                                animate === "lines"
                                  ? i * 50 + introDelayMs
                                  : animate === "characters"
                                  ? (lineIndexStart + lineIndex + k) * 10 +
                                    introDelayMs
                                  : introDelayMs
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
