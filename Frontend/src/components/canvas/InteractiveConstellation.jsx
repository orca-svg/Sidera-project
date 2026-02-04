import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Sphere, MeshDistortMaterial, Html } from '@react-three/drei'
import * as THREE from 'three'
import clsx from 'clsx'

// Image Background Plane for Observatory View
function Star({ position, importance }) {
  const size = 0.08 + (importance ?? 2) * 0.03

  // Config based on importance (Same as Universe.jsx)
  const config = importance >= 5 ? { color: '#FFD700', emissive: '#FFaa00', distort: 0.4, speed: 2 } :
    importance >= 4 ? { color: '#00FFFF', emissive: '#0088FF', distort: 0.3, speed: 1.5 } :
      { color: '#5566AA', emissive: '#223355', distort: 0, speed: 0 }

  return (
    <group position={position}>
      {config.distort > 0 ? (
        <Sphere args={[size, 16, 16]}>
          <MeshDistortMaterial
            color={config.color}
            emissive={config.emissive}
            emissiveIntensity={2}
            roughness={0.1}
            metalness={0.8}
            distort={config.distort}
            speed={config.speed}
            transparent
            opacity={0.8}
          />
        </Sphere>
      ) : (
        <mesh>
          <sphereGeometry args={[size, 8, 8]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.emissive}
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
    </group>
  )
}

function Edge({ start, end, type }) {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end])
  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])

  const color = type === 'explicit' ? '#336688' : '#223344'
  const opacity = type === 'explicit' ? 0.35 : 0.15

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

export function InteractiveConstellation({
  constellation,
  offset,
  isHovered,
  isFocused,
  onHover,
  onClick
}) {
  const groupRef = useRef()
  const { nodes, edges, constellationName, projectId, title, constellationImageUrl } = constellation

  // Load mythical image texture for Observatory display
  const [imageTexture, setImageTexture] = useState(null)
  useEffect(() => {
    if (!constellationImageUrl) {
      setImageTexture(null)
      return
    }
    const loader = new THREE.TextureLoader()
    loader.load(constellationImageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      setImageTexture(tex)
    })
  }, [constellationImageUrl])

  // Calculate constellation bounding box for image sizing
  const imageSize = useMemo(() => {
    if (!nodes || nodes.length === 0) return 15
    const positions = nodes.map(n => n.position || [0, 0, 0])
    const xs = positions.map(p => Array.isArray(p) ? p[0] : (p.x ?? 0))
    const ys = positions.map(p => Array.isArray(p) ? p[1] : (p.y ?? 0))
    const rangeX = Math.max(...xs) - Math.min(...xs)
    const rangeY = Math.max(...ys) - Math.min(...ys)
    return Math.max(rangeX, rangeY, 10) * 1.2 // 1.2x for margin
  }, [nodes])

  // ... existing code below (line 73+)

  const [isNearby, setIsNearby] = useState(false)

  // Base scale
  const baseScale = 0.6
  const targetScale = isFocused ? 0.8 : (isHovered ? 0.7 : 0.6)

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Smooth scale transition
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 4)

      // Gentle rotation if not focused
      if (!isFocused) {
        groupRef.current.rotation.y += delta * 0.05
      }

      // Proximity Check for Auto-Label
      // Calculate distance to this constellation
      const currentPos = new THREE.Vector3(...offset)
      const dist = state.camera.position.distanceTo(currentPos)

      // Hysteresis to prevent flickering
      // Increased range significantly as requested (Show earlier)
      if (dist < 120 && !isNearby) setIsNearby(true)
      if (dist > 130 && isNearby) setIsNearby(false)

      // Dynamic Label Offset Logic (UX Improvement)
      // Anchor: Bottom of constellation (minY)
      // Offset: Pixel distance decreases as we get further (Counter-intuitive but correct for screen space)
      // Close (Zoomed In): Star is visually HUGE -> Need LARGE offset to clear it.
      // Far (Zoomed Out): Star is tiny -> Need SMALL offset to keep label connected.
      if (labelRef.current && (isNearby || isHovered || isFocused)) {
        // Calculate closeness (0 to 1, where 1 is "Very Close")
        // Dist 20 (Close) -> ratio 1.0
        // Dist 120 (Far) -> ratio 0.0
        const closeness = Math.max(0, Math.min(1, 1 - (dist - 20) / 100))

        // Base offset (Far): 30px
        // Extra offset (Close): +50px
        // Result: Far=30px, Close=80px
        const pixelOffset = 30 + (closeness * 50)

        labelRef.current.style.transform = `translateY(${pixelOffset}px)`
      }
    }
  })

  /* Restore missing rendering logic */
  const labelRef = useRef()
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id.toString(), n])), [nodes])

  // Find visual bottom of the constellation
  const minY = useMemo(() => {
    if (!nodes.length) return 0
    // Get min Y from all nodes
    return Math.min(...nodes.map(n => {
      const pos = n.position
      const y = Array.isArray(pos) ? pos[1] : (pos.y ?? 0)
      return y
    }))
  }, [nodes])

  // Local position helper (relative to group 0,0,0)
  const getPosition = (pos) => {
    if (!pos) return [0, 0, 0]
    const x = Array.isArray(pos) ? pos[0] : (pos.x ?? 0)
    const y = Array.isArray(pos) ? pos[1] : (pos.y ?? 0)
    const z = Array.isArray(pos) ? pos[2] : (pos.z ?? 0)
    return [x, y, z] // No offset applied here, offset is on the group
  }

  return (
    <group
      ref={groupRef}
      position={offset}
      onClick={(e) => {
        e.stopPropagation()
        onClick({ projectId, position: offset })
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(projectId)
      }}
      onPointerOut={(e) => {
        onHover(null)
      }}
    >
      {/* Hit Area Sphere (Invisible but captures events) */}
      <mesh visible={false}>
        <sphereGeometry args={[15, 16, 16]} />
        <meshBasicMaterial />
      </mesh>

      {/* Mythical Image Background (if available) */}
      {imageTexture && (
        <mesh position={[0, 0, -2]}>
          <planeGeometry args={[imageSize, imageSize]} />
          <meshBasicMaterial
            map={imageTexture}
            transparent
            opacity={0.25}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Render Edges */}
      {edges.map((edge, i) => {
        const sourceNode = nodeMap.get(edge.source?.toString())
        const targetNode = nodeMap.get(edge.target?.toString())
        if (!sourceNode || !targetNode) return null
        return (
          <Edge
            key={`e-${i}`}
            start={getPosition(sourceNode.position)}
            end={getPosition(targetNode.position)}
            type={edge.type}
          />
        )
      })}

      {/* Render Stars */}
      {nodes.map((node, i) => (
        <Star
          key={`n-${i}`}
          position={getPosition(node.position)}
          importance={node.importance}
        />
      ))}

      {/* Label (Hovered, Focused, or Proximity) */}
      {(isHovered || isFocused || isNearby) && (
        <Html position={[0, minY, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            ref={labelRef}
            className="transition-transform duration-75"
            style={{ transform: 'translateY(20px)' }} // Positive Y goes down in CSS flow naturally? No, standard CSS: Y increases downwards.
          // Wait, Html center prop centers the div on the 3D point.
          // Inside the div, translateY > 0 moves it DOWN.
          >
            <div className={clsx(
              "px-4 py-2 rounded-full border backdrop-blur-md text-sm font-medium whitespace-nowrap transition-all duration-300",
              isFocused
                ? "bg-purple-900/80 border-purple-400 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.5)] scale-110"
                : "bg-black/80 border-white/20 text-gray-200"
            )}>
              {title || constellationName || "Untitled Star Map"}
            </div>
          </div>
        </Html>
      )}
    </group>
  )

}
