import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BTRadio DJ — Mini Player',
  robots: { index: false, follow: false },
}

export default function MiniPlayerLayout({ children }: { children: React.ReactNode }) {
  return children
}
