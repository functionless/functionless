import CodeBlock from "@theme-original/CodeBlock";

export default function CodeBlockWrapper(props: any) {
  return (
    <div className="text-sm my-6 font-semibold">
      <CodeBlock {...props} />
    </div>
  );
}
