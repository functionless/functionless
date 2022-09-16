import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { MDXProvider } from "@mdx-js/react";
import clsx from "clsx";
import Highlight, { defaultProps } from "prism-react-renderer";
import React, { ReactElement } from "react";
import { useVisibility } from "../lib/useVisibility";

export const Code = ({
  children,
  fileName,
}: React.PropsWithChildren<{ fileName?: string }>) => {
  return (
    <MDXProvider
      components={{
        pre: ({ children }: { children: ReactElement }) => (
          <pre className="p-0 overflow-visible">{children}</pre>
        ),
        code: ({ children: code }: { children: string }) => (
          <VisibleCode code={code} fileName={fileName} />
        ),
      }}
    >
      {children}
    </MDXProvider>
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
}: {
  code: string;
  fileName?: string;
}) => {
  const { ref, visible } = useVisibility(0.25);
  return (
    <div
      ref={ref}
      className="round overflow-hidden p-0.5 code-gradient round shadow-light dark:shadow-dark"
    >
      {fileName && <Header fileName={fileName} code={code} />}
      <Highlight
        {...defaultProps}
        theme={{
          plain: { backgroundColor: "none" },
          styles: defaultProps.theme.styles,
        }}
        code={code}
        language="typescript"
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
                            className: clsx(
                              "transition-opacity",
                              visible ? "duration-75" : "duration-[0ms]"
                            ),
                            style: {
                              opacity: visible ? 1 : 0,
                              transitionDelay: visible
                                ? `${
                                    (lineIndexStart + lineIndex + k) * 10 + 250
                                  }ms`
                                : "0ms",
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
