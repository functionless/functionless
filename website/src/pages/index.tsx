/* eslint-disable import/no-unresolved */
import Link from "@docusaurus/Link";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
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

        <Container component="main" maxWidth="xl">
          <Grid container>
            <Grid container>
              <Grid item lg={1} md={0} xs={0} />
              <Grid
                item
                lg={3}
                md={4}
                xs={12}
                sx={{ margin: { xs: 1, md: 0 } }}
              >
                <HomeButton
                  to="/docs/what-is-functionless"
                  label="Learn More"
                />
              </Grid>
              <Grid
                item
                lg={4}
                md={4}
                xs={12}
                sx={{ margin: { xs: 1, md: 0 } }}
              >
                <HomeButton to="./sign-up" label="Sign Up for Updates" />
              </Grid>
              <Grid
                item
                lg={3}
                md={4}
                xs={12}
                sx={{ margin: { xs: 1, md: 0 } }}
              >
                <HomeButton to="/docs/getting-started" label="Get Started" />
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </div>
    </header>
  );
}

function HomeButton(props: { to: string; label: string; variant?: string }) {
  return (
    <div className={styles.buttons}>
      <Link
        className={`button button--active button--${
          props.variant ?? "secondary"
        } button--lg`}
        to={props.to}
      >
        {props.label}
      </Link>
    </div>
  );
}
