import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export function WarpField({ count = 1000 }) {
  const mesh = useRef()
  const { isWarping } = useStore()

  // Initial particles logic
  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100
      const factor = 20 + Math.random() * 100
      const speed = 0.01 + Math.random() / 200
      const xFactor = -100 + Math.random() * 200
      const yFactor = -100 + Math.random() * 200
      const zFactor = -150 + Math.random() * 300
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 })
    }
    return temp
  }, [count])

  // Dummy object for matrix calculations
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, delta) => {
    if (!mesh.current) return

    // "Warp Speed" factor that increases when warping
    // We can use a simple state lerp here or rely on the camera movement speed visual
    // But stretching particles adds to the effect.

    // Iterate particles
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle

      // Update time/position
      // Move towards camera (assuming camera looks at -Z, or we move stars +Z?)
      // Let's make stars move +Z (towards camera at [0,0,15])
      // Standard flow: particles at negative Z moving to positive Z

      // Speed multiplier during warp
      const speedMult = isWarping ? 20 : 0.5

      t = particle.t += speed * speedMult

      const normalizedPos = (t % 1)

      // Basic position calculation (Pseudo-random noise flow)
      // We want simple straight lines for Warp
      // Reset Z when it passes camera

      // Let's create a tunnel effect
      // x, y are relatively stable. z moves fast.
      const z = (normalizedPos * 250) - 125 // -125 to 125 range for larger coverage

      // Stretch factor (Length of the star line)
      // When warping, stretch significantly in Z axis
      const stretch = isWarping ? 4.0 : 0.2

      dummy.position.set(
        xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        z
      )

      // For warp, we strictly override the chaotic movement to be a straight Z-tunnel?
      // User asked for "Streak". Straight lines are best.
      if (isWarping) {
        dummy.position.set(xFactor, yFactor, z)
      }

      dummy.scale.set(0.1, 0.1, stretch) // Z-stretch

      // Look at camera? Or just align with Z axis (default)
      dummy.rotation.x = 0
      dummy.rotation.y = 0
      dummy.rotation.z = 0

      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })

    mesh.current.instanceMatrix.needsUpdate = true
  })

  // Material: Basic white with additive blending for glow
  return (
    <instancedMesh ref={mesh} args={[null, null, count]} visible={isWarping}>
      <boxGeometry args={[0.2, 0.2, 2.0]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={isWarping ? 0.8 : 0}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}
