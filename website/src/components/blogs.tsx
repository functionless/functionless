import { Blog, ChipColor } from "./blog";
import { Subscribe } from "./subscribe";

type Props = {};

export const Blogs = (props: Props) => {
  return (
    <section className="py-36 bg-fusnctionless-bg dark:bg-functionless-dark-bg">
      <div className="container max-w-screen-sm flex flex-col items-center">
        <span className="over">BLOG</span>
        <h4 className="text-center mt-2">Read Our Latest Updates</h4>
      </div>
      <div className="mt-24 grid grid-cols-3 gap-7 container max-w-screen-xl">
        <Blog chipColor={ChipColor.purple} />
        <Blog chipColor={ChipColor.green} />
        <Blog chipColor={ChipColor.yellow} />
      </div>
      <div className="container max-w-screen-xl mt-36">
        <Subscribe />
      </div>
    </section>
  );
};
