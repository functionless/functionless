import Layout from "@theme/Layout";
import { Blogs } from "../components/blogs";
import { CTA } from "../components/cta";
import { Features } from "../components/features";
import { FeaturesCore } from "../components/featuresCore";
import { Hero } from "../components/hero";
import { Testimonials } from "../components/testimonials";

const Home = () => (
  <Layout title="Home" description="Functionless">
    <Hero />
    <Features />
    <FeaturesCore />
    <Testimonials />
    <Blogs />
    <CTA />
  </Layout>
);

export default Home;
