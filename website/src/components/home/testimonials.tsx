import { subtitle, testimonials, title } from "../../content/testimonials";
import { TestimonialBlock } from "./testimonial";

export const Testimonials = () => {
  return (
    <section className="bg-functionless-bg-alternate dark:bg-functionless-dark-bg-alternate py-36 snap-start">
      <div className="container !max-w-screen-md flex flex-col items-center">
        <span className="over">{title}</span>
        <h4 className="text-center mt-2">{subtitle}</h4>
      </div>
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-7 container !max-w-screen-lg">
        {testimonials.map((testimonial, i) => (
          <TestimonialBlock key={i} {...testimonial} />
        ))}
      </div>
    </section>
  );
};
