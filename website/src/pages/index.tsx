import Layout from "@theme/Layout";
import { Blogs } from "../components/home/blogs";
import { CTA } from "../components/home/cta";
import { Features } from "../components/home/features/features";
import { FeaturesCore } from "../components/home/featuresCore";
import { Hero } from "../components/home/hero";
import { Subscribe } from "../components/home/subscribe";
import { Testimonials } from "../components/home/testimonials";

const Home = () => (
  <div className="snap-start">
    <Layout title="Home" description="Functionless">
      <Hero />
      <Features />
      <FeaturesCore />
      <Testimonials />
      <Blogs />
      <Subscribe />
      <CTA />
    </Layout>
  </div>
);

export default Home;
