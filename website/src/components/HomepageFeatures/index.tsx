import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

// see: https://www.npmjs.com/package/react-syntax-highlighter
import SyntaxHighlighter from "react-syntax-highlighter";
import { a11yDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<"svg">>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Familiar syntax and no boilerplate",
    Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
    description: (
      <>
        Adopt powerful cloud-native services without the boilerplate and
        complexity of domain specific languages.
      </>
    ),
  },
  {
    title: "Secure by default",
    Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
    description: (
      <>
        Functionless infers minimally permissive IAM Policies from your business
        logic, ensuring that your IAM Roles only have access to the resources
        and operations they absolutely need.
      </>
    ),
  },
  {
    title: "Type-safe databases and functions",
    Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
    description: (
      <>
        Use types to describe the data stored in databases and the interfaces of
        your cloud functions. Catch common errors at compile time instead of
        waiting until deployment.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Code(props: { code: string }) {
  return (
    <SyntaxHighlighter
      language="typescript"
      style={a11yDark}
      wrapLongLines={false}
      customStyle={{ width: "100%" }}
    >
      {props.code}
    </SyntaxHighlighter>
  );
}

function CodePreview(props: { title: string; code: string }) {
  return (
    <div>
      <div className="row">
        <h3
          style={{
            textAlign: "center",
            width: "100%",
          }}
        >
          {" "}
          {props.title}
        </h3>
      </div>
      <div className="row">
        <Code code={props.code} />
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
        <div className="row">
          <div className="col col--6 col--offset-3">
            <CodePreview
              title="Prevent errors with type-safe DynamoDB Tables"
              code={`const postTable = new Table<Post, "postId">(this, "PostTable", {
  partitionKey: {
    name: "postId",
    type: aws_dynamodb.AttributeType.String,
  },
  billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
});`}
            />
            <CodePreview
              title="Integrate a Lambda with Constructs"
              code={`const getItem = new Function(this, "GetItem", async (itemId: string) => {
  return postTable.getItem({
    Key: {
      itemId
    }
  });
});`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
