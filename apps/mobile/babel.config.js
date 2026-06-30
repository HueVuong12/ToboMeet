module.exports = function (api) {
  api.cache(true);
  process.env.EXPO_ROUTER_APP_ROOT = "../../app";
  process.env.EXPO_ROUTER_IMPORT_MODE = "sync";
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }]
    ],
    plugins: [
      ["transform-inline-environment-variables", {
        "include": ["EXPO_ROUTER_APP_ROOT", "EXPO_ROUTER_IMPORT_MODE", "EXPO_PUBLIC_API_URL"]
      }]
    ]
  };
};
