import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";
import Typist, { TypistProps } from "react-typist";

type Props = {
  code?: ReactNode;
  fileName?: string;
  typistProps?: TypistProps;
};

const SampleCode = (
  <code className="bg-functionless-code text-sm">
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token keyword" style={{ color: "#66d9ef" }}>
        new
      </span>
      <span className="token plain"> </span>
      <span className="token class-name" style={{ color: "#e6db74" }}>
        StepFunction
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        (
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"  "}stack</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"  "}</span>
      <span className="token string" style={{ color: "#a6e22e" }}>
        "Validator"
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"  "}</span>
      <span className="token keyword" style={{ color: "#66d9ef" }}>
        async
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        (
      </span>
      <span className="token plain">input</span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> ValidateRequest</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        )
      </span>
      <span className="token plain"> </span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        =&gt;
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"    "}</span>
      <span className="token keyword" style={{ color: "#66d9ef" }}>
        const
      </span>
      <span className="token plain"> status </span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        =
      </span>
      <span className="token plain"> </span>
      <span className="token function" style={{ color: "#e6db74" }}>
        validate
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        (
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain"> commentText</span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> input</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        .
      </span>
      <span className="token plain">commentText </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        )
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ;
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"    "}</span>
      <span className="token keyword" style={{ color: "#66d9ef" }}>
        if
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        (
      </span>
      <span className="token plain">status </span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        ===
      </span>
      <span className="token plain"> </span>
      <span className="token string" style={{ color: "#a6e22e" }}>
        "bad"
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        )
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"      "}</span>
      <span className="token keyword" style={{ color: "#66d9ef" }}>
        await
      </span>
      <span className="token plain"> $</span>
      <span className="token constant" style={{ color: "#e6db74" }}>
        AWS
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        .
      </span>
      <span className="token plain">DynamoDB</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        .
      </span>
      <span className="token function" style={{ color: "#e6db74" }}>
        DeleteItem
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        (
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"        "}Table</span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> posts</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"        "}Key</span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"          "}pk</span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"            "}</span>
      <span className="token constant" style={{ color: "#e6db74" }}>
        S
      </span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> </span>
      <span
        className="token template-string template-punctuation string"
        style={{ color: "#a6e22e" }}
      >
        `
      </span>
      <span
        className="token template-string string"
        style={{ color: "#a6e22e" }}
      >
        Post|
      </span>
      <span
        className="token template-string interpolation interpolation-punctuation punctuation"
        style={{ color: "#f8f8f2" }}
      >
        ${"{"}
      </span>
      <span className="token template-string interpolation">input</span>
      <span
        className="token template-string interpolation punctuation"
        style={{ color: "#f8f8f2" }}
      >
        .
      </span>
      <span className="token template-string interpolation">postId</span>
      <span
        className="token template-string interpolation interpolation-punctuation punctuation"
        style={{ color: "#f8f8f2" }}
      >
        {"}"}
      </span>
      <span
        className="token template-string template-punctuation string"
        style={{ color: "#a6e22e" }}
      >
        `
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"          "}</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"          "}sk</span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"{"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"            "}</span>
      <span className="token constant" style={{ color: "#e6db74" }}>
        S
      </span>
      <span className="token operator" style={{ color: "#66d9ef" }}>
        :
      </span>
      <span className="token plain"> </span>
      <span
        className="token template-string template-punctuation string"
        style={{ color: "#a6e22e" }}
      >
        `
      </span>
      <span
        className="token template-string string"
        style={{ color: "#a6e22e" }}
      >
        Comment|
      </span>
      <span
        className="token template-string interpolation interpolation-punctuation punctuation"
        style={{ color: "#f8f8f2" }}
      >
        ${"{"}
      </span>
      <span className="token template-string interpolation">input</span>
      <span
        className="token template-string interpolation punctuation"
        style={{ color: "#f8f8f2" }}
      >
        .
      </span>
      <span className="token template-string interpolation">commentId</span>
      <span
        className="token template-string interpolation interpolation-punctuation punctuation"
        style={{ color: "#f8f8f2" }}
      >
        {"}"}
      </span>
      <span
        className="token template-string template-punctuation string"
        style={{ color: "#a6e22e" }}
      >
        `
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"          "}</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"        "}</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ,
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"      "}</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        )
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ;
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"    "}</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token plain" />
    </div>
    <div className="token-line" style={{ color: "#f8f8f2" }}>
      <span className="token plain">{"  "}</span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        {"}"}
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        )
      </span>
      <span className="token punctuation" style={{ color: "#f8f8f2" }}>
        ;
      </span>
    </div>
  </code>
);

export const Code = ({
  code = SampleCode,
  fileName = "functionless.tsx",
  typistProps,
}: Props) => {
  return (
    <div className="round overflow-hidden p-0.5 code-gradient round shadow-3xl">
      <div className="flex items-center px-4 py-4 bg-functionless-code rounded-t-lg">
        <div className="flex space-x-1">
          <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
          <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
          <div className="h-2 w-2 bg-[#4B5563] rounded-full"></div>
        </div>
        <div className="text-[#B3BABF] flex-1 text-center font-display subtitle2">
          {fileName}
        </div>
        <DocumentDuplicateIcon className="icon" />
      </div>
      <div className="h-0.5 bg-functionless-dark-border"></div>
      <div className="overflow-y-hidden w-full">
        <Typist
          className="whitespace-pre-wrap px-4 py-4 bg-functionless-code rounded-b-lg w-full"
          avgTypingDelay={0}
          {...typistProps}
        >
          <code>{code}</code>
        </Typist>
      </div>
    </div>
  );
};
