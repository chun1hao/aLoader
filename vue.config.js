const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  chainWebpack: (config) => {
    config.module
      .rule("vue")
      .use("autoimport")
      .loader("./loaders/autoimport")
      .end()
      .use("vue-loader")
      .tap((options) => {
        return options;
      });
  },
});
