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
    name: "plugin-content-blog-global",
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
