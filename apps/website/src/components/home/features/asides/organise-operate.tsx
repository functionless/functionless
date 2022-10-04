import Hello from "@site/src/content/home/features/snippets/hello.mdx";
import InvokeHello from "@site/src/content/home/features/snippets/invoke-hello.mdx";
import { clamp } from "@site/src/lib/clamp";
import { useVisibility } from "@site/src/lib/useVisibility";
import { Code, Terminal } from "../../code";

export const Aside = ({ scrollFactor }: { scrollFactor: number }) => {
  const { ref, visible } = useVisibility<HTMLDivElement>(0, {
    singleShot: false,
  });
  const translateFactor = clamp(scrollFactor, 0.5);
  return (
    <div ref={ref} className="flex flex-col">
      <div
        style={{
          opacity: translateFactor,
          transform: `translate(${(1 - translateFactor) * 100}px, ${
            (1 - translateFactor) * 10
          }px) scale(${scrollFactor}, ${scrollFactor})`,
        }}
      >
        <Code
          animate={visible}
          fileName="src/my-stack/hello.ts"
          language="typescript"
          introDelayMs={250}
        >
          <Hello />
        </Code>
      </div>
      <div
        className="-mt-8 ml-28 mr-24"
        style={{
          opacity: translateFactor,
          transform: `translate(0px, ${
            translateFactor * 10
          }px) scale(${scrollFactor}, ${scrollFactor})`,
        }}
      >
        <Terminal
          animate={visible}
          title="zsh - functionless"
          language="bash"
          introDelayMs={1000}
        >
          <InvokeHello />
        </Terminal>
      </div>
    </div>
  );
};
