import { BlogPost } from "@docusaurus/plugin-content-blog";
import { usePluginData } from "@docusaurus/useGlobalData";
import { subtitle, title } from "@site/src/content/home/blog";
import { Blog, ChipColor } from "./blog";
import { Subscribe } from "./subscribe";

export const Blogs = () => {
  const { blogPosts } = usePluginData("plugin-content-blog-global") as {
    blogPosts: BlogPost[];
  };
  return (
    <section className="pt-36 bg-functionless-bg dark:bg-functionless-dark-bg snap-start">
      <div className="container !max-w-screen-sm flex flex-col items-center">
        <span className="over">{title}</span>
        <h4 className="text-center mt-2">{subtitle}</h4>
      </div>
      <div className="mt-24 grid grid-cols-3 gap-7 container">
        {blogPosts.map((post: BlogPost) => (
          <Blog key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
};
