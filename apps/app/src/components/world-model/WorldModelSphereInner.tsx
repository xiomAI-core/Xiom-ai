'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  width?: number
  height?: number
}

export default function WorldModelSphereInner({ width = 600, height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
    camera.position.z = 2.5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    // Create ~200 nodes scattered on sphere surface
    const NODE_COUNT = 200
    const SPHERE_RADIUS = 1.0
    const nodePositions: THREE.Vector3[] = []

    const nodeGeo = new THREE.BufferGeometry()
    const nodeVerts: number[] = []

    for (let i = 0; i < NODE_COUNT; i++) {
      const theta = Math.acos(2 * Math.random() - 1)
      const phi = 2 * Math.PI * Math.random()
      const x = SPHERE_RADIUS * Math.sin(theta) * Math.cos(phi)
      const y = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi)
      const z = SPHERE_RADIUS * Math.cos(theta)
      nodePositions.push(new THREE.Vector3(x, y, z))
      nodeVerts.push(x, y, z)
    }
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodeVerts, 3))
    const nodeMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.018,
      transparent: true,
      opacity: 0.7,
    })
    const nodes = new THREE.Points(nodeGeo, nodeMat)
    scene.add(nodes)

    // Connect nearby nodes with lines
    const linePositions: number[] = []
    const CONNECTION_DIST = 0.4

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const pi = nodePositions[i]
        const pj = nodePositions[j]
        if (pi && pj && pi.distanceTo(pj) < CONNECTION_DIST) {
          linePositions.push(pi.x, pi.y, pi.z, pj.x, pj.y, pj.z)
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
    })
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    scene.add(lines)

    // Wireframe sphere shell (very subtle)
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 24, 16)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(sphere)

    // Animation
    let frameId: number
    let tick = 0
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      tick += 0.002
      const group = [nodes, lines, sphere]
      group.forEach((obj) => {
        obj.rotation.y = tick
        obj.rotation.x = Math.sin(tick * 0.3) * 0.15
      })
      // Subtle pulse on node opacity
      nodeMat.opacity = 0.6 + 0.15 * Math.sin(tick * 2)
      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth || width
      const h = container.clientHeight || height
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [width, height])

  return (
    <div
      ref={containerRef}
      style={{ width, height }}
      className="relative"
    />
  )
}
