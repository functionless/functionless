import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { MDXProvider } from "@mdx-js/react";
import { style } from "@mui/system";
import clsx from "clsx";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import React, { ReactElement } from "react";
import { useVisibility } from "../lib/useVisibility";

export const Code = ({
  children,
  fileName,
  language,
  introDelayMs,
  triggerVisibility,
}: React.PropsWithChildren<{
  fileName: string;
  language: Language;
  introDelayMs: number;
  triggerVisibility: number;
}>) => {
  const { ref, visible } = useVisibility(triggerVisibility);
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
          transitionDelay: `${visible ? introDelayMs : 0}ms`,
        }}
      >
        <MDXProvider
          components={{
            pre: ({ children }: { children: ReactElement }) => (
              <pre className="p-0 overflow-visible ">{children}</pre>
            ),
            code: ({ children: code }: { children: string }) => (
              <VisibleCode
                code={code}
                fileName={fileName}
                language={language}
                introDelayMs={introDelayMs}
              />
            ),
          }}
        >
          {children}
        </MDXProvider>
      </div>
    </div>
  );
};

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
    <div className="h-0.5 bg-functionless-dark-border"></div>
  </div>
);

const VisibleCode = ({
  code,
  fileName,
  language,
  introDelayMs,
}: {
  code: string;
  fileName: string;
  language: Language;
  introDelayMs: number;
}) => {
  return (
    <div
      key="code"
      className="round overflow-hidden p-0.5 code-gradient round shadow-light dark:shadow-dark"
    >
      <Header fileName={fileName} code={code} />
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
            className={clsx(className, "text-xs bg-functionless-code p-4")}
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
                  <div>{i + 1}</div>
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
                            className: "animate-fade-in-text opacity-0",
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
    </div>
  );
};
