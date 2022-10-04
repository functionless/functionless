import Layout from "@theme/Layout";
import { CTA } from "../components/home/cta";
import { Features } from "../components/home/features";
import { Hero } from "../components/home/hero";
import { Subscribe } from "../components/home/subscribe";
import { Testimonials } from "../components/home/testimonials";

const Home = () => (
  <Layout title="Home" description="Functionless">
    <Hero />
    <Features />
    <Testimonials />
    <Subscribe />
    <CTA />
  </Layout>
);

export default Home;
