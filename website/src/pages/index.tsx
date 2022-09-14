import { Blogs } from "../components/blogs";
import { CTA } from "../components/cta";
import { Features } from "../components/features";
import { FeaturesCore } from "../components/featuresCore";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { Testimonials } from "../components/testimonials";

const Home = () => {
  return (
    <>
      <Header />
      <Hero />
      <Features />
      <FeaturesCore />
      <Testimonials />
      <Blogs />
      <CTA />
      <Footer />
    </>
  );
};

export default Home;
