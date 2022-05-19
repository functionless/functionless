import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";
import HomepageFeatures from "../components/HomepageFeatures";

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
        <h1 className="hero__title">Simple and concise cloud programming</h1>
        <p className="hero__subtitle">
          Functionless simplifies your <b>Infrastructure as Code</b> by
          inferring boilerplate configurations and domain specific languages
          from TypeScript syntax.
        </p>
        <p className="hero__subtitle">
          More powerful cloud components are made possible by unifying business
          logic and infrastructure code into one environment.
        </p>
        <div className="row">
          <div className="col col--2 col--offset-4 margin-top--md">
            <HomeButton to="/docs/what-is-functionless" label="Learn More" />
          </div>
          <div className="col col--2 margin-top--md">
            <HomeButton to="/docs/getting-started" label="Get Started" />
          </div>
        </div>
      </div>
    </header>
  );
}

function HomeButton(props: { to: string; label: string }) {
  return (
    <div className={styles.buttons}>
      <Link className="button button--secondary button--lg" to={props.to}>
        {props.label}
      </Link>
    </div>
  );
}
