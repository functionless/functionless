import GetUser from "@site/src/content/home/features/snippets/get-user.mdx";
import Policy from "@site/src/content/home/features/snippets/policy.mdx";
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
          fileName="src/user-service/get-user.ts"
          language="typescript"
          introDelayMs={250}
        >
          <GetUser />
        </Code>
      </div>
      <div
        className="-mt-2 -ml-2 -mr-8"
        style={{
          opacity: translateFactor,
          transform: `translate(0px, ${
            translateFactor * 10
          }px) scale(${scrollFactor}, ${scrollFactor})`,
        }}
      >
        <Terminal
          animate={visible}
          title="cat policy.json"
          language="bash"
          introDelayMs={1500}
        >
          <Policy />
        </Terminal>
      </div>
    </div>
  );
};
