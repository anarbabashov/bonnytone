const path = require('path')

// Custom Jest resolver to handle Next.js SWC modularize-import-loader paths
// e.g. 'modularize-import-loader?name=Play&from=default&as=default&join=../esm/icons/play!lucide-react'
module.exports = (request, options) => {
  const match = request.match(/modularize-import-loader\?.*name=(\w+).*!lucide-react/)
  if (match) {
    const iconName = match[1]
    return path.resolve(options.rootDir, 'tests/__mocks__/lucide-icons', `${iconName}.js`)
  }

  return options.defaultResolver(request, options)
}
