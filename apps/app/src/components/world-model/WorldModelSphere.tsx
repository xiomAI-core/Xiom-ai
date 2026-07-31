'use client'

import dynamic from 'next/dynamic'

const WorldModelSphereInner = dynamic(
  () => import('./WorldModelSphereInner'),
  { ssr: false, loading: () => <div className="w-full h-full bg-transparent" /> }
)

interface Props {
  width?: number
  height?: number
}

export default function WorldModelSphere({ width = 600, height = 400 }: Props) {
  return <WorldModelSphereInner width={width} height={height} />
}
