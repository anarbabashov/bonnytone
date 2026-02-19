// Factory for creating mock lucide-react icon components
const React = require('react')

function createIcon(name) {
  const Icon = React.forwardRef((props, ref) =>
    React.createElement('svg', { ref, 'data-testid': `icon-${name}`, ...props })
  )
  Icon.displayName = name
  return Icon
}

module.exports = { createIcon }
