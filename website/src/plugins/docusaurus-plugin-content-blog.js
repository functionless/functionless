const {
  default: pluginContentBlog,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require("@docusaurus/plugin-content-blog");
const {
  validateOptions,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require("@docusaurus/plugin-content-blog/lib");

async function pluginContentBlogGlobalExported(context, options) {
  const blogPluginInstance = await pluginContentBlog(context, options);

  return {
    ...blogPluginInstance,
    //Name needs to match the original plugins, or mdx loading will fail
    name: "docusaurus-plugin-content-blog",
    async contentLoaded(...contentLoadedArgs) {
      await blogPluginInstance.contentLoaded?.(...contentLoadedArgs);
      const { actions, content } = contentLoadedArgs[0];
      const { setGlobalData } = actions;
      const { blogPosts } = content;
      setGlobalData({ blogPosts });
    },
  };
}

exports.default = pluginContentBlogGlobalExported;
exports.validateOptions = validateOptions;
