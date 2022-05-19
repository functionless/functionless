import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
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
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className="hero__subtitle">
          More powerful cloud components are made possible by unifying business
          logic with infrastructure code.
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
