// Mock for Next.js RSC module reference proxy used by 'use client' directive in Jest
module.exports = {
  createProxy: (moduleId) => {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === '__esModule') return true
          if (prop === 'default') return undefined
          return prop
        },
      }
    )
  },
}
