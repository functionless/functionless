/* eslint-disable import/no-unresolved */
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import clsx from "clsx";
import HomepageFeatures from "../components/HomepageFeatures";
import styles from "./index.module.css";

export default function Home(): JSX.Element {
  return (
    <Layout>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}

function HomepageHeader() {
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">
          Unified Infrastructure and Application Code
        </h1>

        <p className="hero__subtitle">
          Integrates with the AWS CDK, translates TypeScript application code to
          cloud resources and domain specific languages, and infers optimal IAM
          policies from business logic.
        </p>

        <div className="row">
          <div className="col col--2 col--offset-3 margin-top--md">
            <HomeButton
              to="/docs/what-is-functionless"
              label="Learn More"
              variant="primary"
            />
          </div>
          <div className="col col--2 margin-top--md">
            <HomeButton
              to="./sign-up"
              label="Sign Up for Updates"
              variant="info"
            />
          </div>
          <div className="col col--2 margin-top--md">
            <HomeButton
              to="/docs/getting-started"
              label="Get Started"
              variant="primary"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function HomeButton(props: { to: string; label: string; variant?: string }) {
  return (
    <div className={styles.buttons}>
      <Link
        className={`button button--${props.variant ?? "secondary"} button--lg`}
        to={props.to}
      >
        {props.label}
      </Link>
    </div>
  );
}
