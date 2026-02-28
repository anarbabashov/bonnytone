// Mock lucide-react icons for Jest -- returns simple SVG stubs with data-testid
import React from 'react'

type IconProps = React.SVGProps<SVGSVGElement>

const createIcon = (name: string) => {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <svg ref={ref} data-testid={`icon-${name}`} {...props} />
  ))
  Icon.displayName = name
  return Icon
}

export const Play = createIcon('Play')
export const Pause = createIcon('Pause')
export const Loader2 = createIcon('Loader2')
export const Volume = createIcon('Volume')
export const Volume2 = createIcon('Volume2')
export const VolumeX = createIcon('VolumeX')
export const ArrowUpRight = createIcon('ArrowUpRight')
export const MoreHorizontal = createIcon('MoreHorizontal')
export const X = createIcon('X')
