/* eslint-disable import/no-unresolved */
import Cloud from "@site/static/img/cloud.png";
import Friendly from "@site/static/img/friendly.png";
import Keys from "@site/static/img/keys.png";
import CodeBlock from "@theme/CodeBlock";
import clsx from "clsx";

import Highlighter from "../highlighter";

import styles from "./styles.module.css";

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
            {CodeSnippets.map(({ title, code }, i) => (
              <CodePreview key={i} title={title} code={code} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature({ title, Img, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <img className={styles.featureSvg} role="img" src={Img} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

type FeatureItem = {
  title: string;
  Img: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Familiar and friendly TypeScript syntax",
    Img: Friendly,
    description: (
      <>
        Adopt powerful cloud-native services without boilerplate configurations
        or the complexity of domain specific languages.
      </>
    ),
  },
  {
    title: "Secure by default",
    Img: Keys,
    description: (
      <>
        Minimally permissive IAM Policies are inferred from your business logic,
        ensuring that your IAM Roles only have access to the resources and
        operations they absolutely need.
      </>
    ),
  },
  {
    title: "Typesafe cloud resources",
    Img: Cloud,
    description: (
      <>
        Use types to describe the interfaces of your cloud functions and the
        structure of data in your databases. Catch common errors at compile time
        instead of waiting until deployment.
      </>
    ),
  },
];

function CodePreview(props: { title: string; code: string }) {
  console.log(props.code);
  return (
    <div className="row">
      <div className="col col--12 padding-top--lg padding-bottom--md">
        {props.title}
      </div>
      <div className="col col--12">
        <CodeBlock>{props.code}</CodeBlock>
        {/* <Highlighter>{props.code}</Highlighter> */}
      </div>
    </div>
  );
}

interface CodeSnippet {
  title: string;
  code: string;
}

const CodeSnippets: CodeSnippet[] = [
  {
    title: "Write your application logic and infrastructure in one place.",
    code: `const helloWorld = new Function(this, "HelloWorld", () => {
  console.log("hello world");
});`,
  },
  {
    title:
      "Safeguard the data in your Dynamo Tables using TypeScript's powerful type system.",
    code: `interface Task {
  taskId: string;
  description: string;
}

const tasks = Table.fromTable<Task, "taskId">(this, "Tasks", {
  billingMode: BillingMode.PAY_PER_REQUEST
});`,
  },
  {
    title:
      "Integrate services with simple function calls. Never worry about IAM Policies, environment variables or other boilerplate.",
    code: `const getTask = new Function(this, "GetTask", async (taskId: string) => {
  return tasks.getItem({
    taskId
  });
});`,
  },
  {
    title:
      'Upgrade from "serverless" to "functionless" by writing AWS Step Functions in pure TypeScript.',
    code: `new StepFunction(
  stack,
  "Validator",
  async (input: ValidateRequest) => {
    const status = validate({ commentText: input.commentText });
    if (status === "bad") {
      await $AWS.DynamoDB.DeleteItem({
        Table: posts,
        Key: {
          pk: {
            S: \`Post|\${input.postId}\`,
          },
          sk: {
            S: \`Comment|\${input.commentId}\`,
          },
        },
      });
    }
  });`,
  },
  {
    title:
      "Deploy a GraphQL API to AWS Appsync without ever touching a single line of Velocity Templates.",
    code: `const addTask = new AppsyncResolver<{text: string}, Task>(($context) => {
  return tasks.appsync.putItem({
    key: {
      taskId: {
        S: $util.autoUuid())
      }
    },
    attributeValues: {
      text: $util.dynamodb.toDynamoDB($context.arguments.text),
      createTime: {
        S: $util.time.nowISO8601()
      }
    }
  });
});`,
  },
  {
    title:
      "Filter, transform and send Events from AWS Event Bridge to your cloud resources using fluent APIs.",
    code: `const tasks = new EventBus<TaskCompleted | TaskDeleted>(this, "Tasks");

tasks
  .when(
    this,
    "OnTaskCompleted",
    (event) => event["detail-type"].kind === "TaskCompleted"
  )
  .map(event => ({
    ...event,
  }))
  .pipe(handleTaskCompletedWorkflow);`,
  },
];
