import Layout from "@theme/Layout";
import { Blogs } from "../components/blogs";
import { CTA } from "../components/cta";
import { Features } from "../components/features/features";
import { FeaturesCore } from "../components/featuresCore";
import { Hero } from "../components/hero";
import { Testimonials } from "../components/testimonials";

const Home = () => (
  <div className="snap-start">
    <Layout title="Home" description="Functionless">
      <Hero />
      <Features />
      <FeaturesCore />
      <Testimonials />
      <Blogs />
      <CTA />
    </Layout>
  </div>
);

export default Home;
