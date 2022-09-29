import { testimonials, title } from "@site/src/content/home/testimonials";
import { TestimonialBlock } from "./testimonial";

export const Testimonials = () => {
  return (
    <section className="bg-functionless-bg dark:bg-functionless-dark-bg py-12 md:py-36">
      <div className="tw-container flex flex-col items-center">
        <span className="over">{title}</span>
      </div>
      <div className="mt-12 md:mt-24 grid grid-cols-1 lg:grid-cols-3 gap-7 tw-container">
        {testimonials.map((testimonial, i) => (
          <TestimonialBlock key={i} {...testimonial} />
        ))}
      </div>
    </section>
  );
};
