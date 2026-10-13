const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const tools = path.resolve(__dirname, "../../tools");
const launcherUi = path.resolve(__dirname, "../web/src/launcher-ui");
const sharedRoots = [tools, launcherUi];

// src/shared.ts imports pure modules from ../../tools and the web launcher; Metro must watch them and, since they
// use NodeNext-style "./motion.js" specifiers for .ts files, retry those without the extension.
config.watchFolders = sharedRoots;
const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = resolveDefault ?? context.resolveRequest;
  const fromShared = sharedRoots.some((root) => context.originModulePath.startsWith(root + path.sep));
  if (fromShared && moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    return resolve(context, moduleName.slice(0, -3), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
