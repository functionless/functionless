import Layout from "@theme/Layout";
import { Blogs } from "../components/home/blogs";
import { CTA } from "../components/home/cta";
import { Features } from "../components/home/features/features";
import { FeaturesCore } from "../components/home/featuresCore";
import { Hero } from "../components/home/hero";
import { Testimonials } from "../components/home/testimonials";

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
