const path = require("path");

function resolveSQLiteUrl(url) {
  if (!url || !url.startsWith("file:")) {
    return url;
  }

  const filePath = url.slice("file:".length);
  if (!filePath.startsWith("./") && !filePath.startsWith("../")) {
    return url;
  }

  const schemaDirectory = path.join(process.cwd(), "prisma");
  const absolutePath = path.resolve(schemaDirectory, filePath);
  return `file:${absolutePath.replace(/\\/g, "/")}`;
}

module.exports = {
  resolveSQLiteUrl,
};
