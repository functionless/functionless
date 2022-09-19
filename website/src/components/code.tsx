import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { MDXProvider } from "@mdx-js/react";
import clsx from "clsx";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import React, { ReactElement } from "react";
import { Timeline } from "../lib/useTimeline";
import { useVisibility } from "../lib/useVisibility";

export const VisibilityWindow = ({
  children,
  visibiltyThreshold,
  delayMs,
}: React.PropsWithChildren<{
  visibiltyThreshold: number;
  delayMs: number;
}>) => {
  const { ref, visible } = useVisibility(visibiltyThreshold);
  return (
    <div ref={ref}>
      <div
        className={clsx(
          "transition duration-300",
          visible
            ? "opacity-100 translate-x-0 scale-100"
            : "opacity-0 translate-y-10 scale-75"
        )}
        style={{
          transitionDelay: `${visible ? delayMs : 0}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const CodeWindow = ({
  fileName,
  code,
  children,
}: React.PropsWithChildren<{
  fileName: string;
  code: string;
}>) => (
  <div
    key="code"
    className="round overflow-hidden p-0.5 code-gradient round shadow-light dark:shadow-dark"
  >
    <Header fileName={fileName} code={code} />
    <div className="py-4 bg-functionless-code">{children}</div>
  </div>
);

export const Code = ({
  children,
  fileName,
  language,
  introDelayMs,
}: React.PropsWithChildren<{
  fileName: string;
  language: Language;
  introDelayMs: number;
}>) => (
  <MDXProvider
    components={{
      pre: ({ children }: { children: ReactElement }) => (
        <pre className="p-0 overflow-visible ">{children}</pre>
      ),
      code: ({ children: code }: { children: string }) => (
        <CodeWindow fileName={fileName} code={code}>
          <HighlightedCode
            code={code}
            language={language}
            introDelayMs={introDelayMs}
            animate={true}
          />
        </CodeWindow>
      ),
    }}
  >
    {children}
  </MDXProvider>
);

export function TimelineCode<K extends string>({
  children,
  fileName,
  language,
  timeline,
}: React.PropsWithChildren<{
  fileName: string;
  language: Language;
  timeline: Timeline<K>;
}>) {
  return (
    <MDXProvider
      components={{
        pre: ({ children }: { children: ReactElement }) => (
          <pre className="p-0 overflow-visible ">{children}</pre>
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
                  animate={true}
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
        className="icon"
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
  lineNumberStart: number;
}) => {
  return (
    <Highlight
      {...defaultProps}
      theme={{
        plain: { backgroundColor: "none" },
        styles: defaultProps.theme.styles,
      }}
      code={code}
      language={language}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div
          className={clsx(className, "text-xs bg-functionless-code px-4")}
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
                          token: { ...token, content: char },
                          key: k,
                          className: animate
                            ? "animate-fade-in-text opacity-0"
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
