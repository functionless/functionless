import { BlogPost } from "@docusaurus/plugin-content-blog";
import { usePluginData } from "@docusaurus/useGlobalData";
import { subtitle, title } from "@site/src/content/home/blog";
import { Blog } from "./blog";

export const Blogs = () => {
  const { blogPosts } = usePluginData("docusaurus-plugin-content-blog") as {
    blogPosts: BlogPost[];
  };
  return (
    <section className="pt-36 bg-functionless-bg dark:bg-functionless-dark-bg">
      <div className="max-w-screen-md px-4 mx-auto flex flex-col items-center">
        <span className="over">{title}</span>
        <h3 className="text-center mt-2">{subtitle}</h3>
      </div>
      <div className="mt-24 grid grid-cols-3 gap-7 tw-container">
        {blogPosts.map((post: BlogPost) => (
          <Blog key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
};
