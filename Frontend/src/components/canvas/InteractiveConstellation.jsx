import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Sphere, MeshDistortMaterial, Html } from '@react-three/drei'
import * as THREE from 'three'
import clsx from 'clsx'
import { useStore } from '../../store/useStore'

// Image Background Plane for Observatory View
function Star({ position, importance }) {
  // Increased base size for better visibility
  const size = 0.15 + (importance ?? 2) * 0.05

  // Config based on importance (Same as Universe.jsx)
  const config = importance >= 5 ? { color: '#FFD700', emissive: '#FFaa00', distort: 0.4, speed: 2 } :
    importance >= 4 ? { color: '#00FFFF', emissive: '#0088FF', distort: 0.3, speed: 1.5 } :
      { color: '#5566AA', emissive: '#223355', distort: 0, speed: 0 }

  return (
    <group position={position}>
      {/* Real Light Source */}
      <pointLight color={config.emissive} intensity={2} distance={3} decay={2} />

      {/* Main Star Sphere */}
      {config.distort > 0 ? (
        <Sphere args={[size, 32, 32]}>
          <MeshDistortMaterial
            color={config.color}
            emissive={config.emissive}
            emissiveIntensity={5}
            roughness={0.1}
            metalness={0.8}
            distort={config.distort}
            speed={config.speed}
          />
        </Sphere>
      ) : (
        <mesh>
          <sphereGeometry args={[size, 16, 16]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.emissive}
            emissiveIntensity={3}
          />
        </mesh>
      )}

      {/* Outer Glow Halo (Billboarding effect or just a large sphere) */}
      <mesh>
        <sphereGeometry args={[size * 2.5, 16, 16]} />
        <meshBasicMaterial
          color={config.emissive}
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.BackSide} /* Prevent z-fighting with inner sphere */
        />
      </mesh>
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
  const { nodes, edges, constellationName, projectId, title, imageUrl: propImageUrl } = constellation

  // Support both property names (constellationImageUrl from backend, imageUrl from store)
  const imageUrl = propImageUrl || constellation.constellationImageUrl

  const regenerateProjectImage = useStore(state => state.regenerateProjectImage)
  const isLoading = useStore(state => state.isLoading)

  // Load mythical image texture for Observatory display
  const [imageTexture, setImageTexture] = useState(null)

  useEffect(() => {
    if (!imageUrl) {
      setImageTexture(null)
      return
    }
    const loader = new THREE.TextureLoader()
    loader.load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      setImageTexture(tex)
    })
  }, [imageUrl])

  // Handler for generation
  const handleGenerate = (e) => {
    e.stopPropagation()
    regenerateProjectImage(projectId)
  }

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

  const [isNearby, setIsNearby] = useState(false)

  // Base scale
  const baseScale = 0.6
  const targetScale = isFocused ? 0.8 : (isHovered ? 0.7 : 0.6)

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Smooth scale transition
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 4)

      // Constantly face the center (0,0,0) for Celestial Sphere effect
      groupRef.current.lookAt(0, 0, 0)

      // Proximity Check for Auto-Label
      // Calculate distance to this constellation
      const currentPos = new THREE.Vector3(...offset)
      const dist = state.camera.position.distanceTo(currentPos)

      // Hysteresis to prevent flickering
      // PURE OPTICAL ZOOM LOGIC (Fixed Distance)
      // Show labels when FOV is narrow (Zoomed In)
      const currentFov = state.camera.fov
      if (currentFov < 50 && !isNearby) setIsNearby(true)
      if (currentFov > 55 && isNearby) setIsNearby(false)

      // Dynamic Label Offset Logic (UX Improvement)
      if (labelRef.current && (isNearby || isHovered || isFocused)) {
        const closeness = Math.max(0, Math.min(1, 1 - (dist - 20) / 100))
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
    const z = Array.isArray(pos) ? pos[0] : (pos.z ?? 0)
    return [x, y, z] // Raw position
  }

  // Calculate Centroid to center the constellation visually around the group origin
  const localCentroid = useMemo(() => {
    if (nodes.length === 0) return [0, 0, 0]
    let sx = 0, sy = 0, sz = 0
    nodes.forEach(n => {
      const p = getPosition(n.position)
      sx += p[0]; sy += p[1]; sz += p[2]
    })
    return [sx / nodes.length, sy / nodes.length, sz / nodes.length]
  }, [nodes])

  // Helper to get Centered Local Position
  const getCenteredPosition = (pos) => {
    const raw = getPosition(pos)
    return [
      raw[0] - localCentroid[0],
      raw[1] - localCentroid[1],
      raw[2] - localCentroid[2]
    ]
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

      {/* Luma Key Shader Implementation for Transparent Background */}
      {imageTexture && (
        <mesh position={[0, 0, 0]} renderOrder={-1}>
          <planeGeometry args={[imageSize, imageSize]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            uniforms={{
              uTexture: { value: imageTexture },
              uThreshold: { value: 0.1 }, // Black threshold
              uSmoothness: { value: 0.2 }, // Smoothing edge
              uOpacity: { value: 0.4 }     // Reduced opacity for subtle blending
            }}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform sampler2D uTexture;
              uniform float uThreshold;
              uniform float uSmoothness;
              uniform float uOpacity;
              varying vec2 vUv;

              void main() {
                vec4 texColor = texture2D(uTexture, vUv);
                float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
                float alpha = smoothstep(uThreshold, uThreshold + uSmoothness, luminance);
                gl_FragColor = vec4(texColor.rgb, alpha * uOpacity);
              }
            `}
          />
        </mesh>
      )}

      {/* UI Overlay Removed per User Request */}

      {/* Render Edges */}
      {edges.map((edge, i) => {
        const sourceNode = nodeMap.get(edge.source?.toString())
        const targetNode = nodeMap.get(edge.target?.toString())
        if (!sourceNode || !targetNode) return null
        return (
          <Edge
            key={`e-${i}`}
            start={getCenteredPosition(sourceNode.position)}
            end={getCenteredPosition(targetNode.position)}
            type={edge.type}
          />
        )
      })}

      {/* Render Stars */}
      {nodes.map((node, i) => (
        <Star
          key={`n-${i}`}
          position={getCenteredPosition(node.position)}
          importance={node.importance}
        />
      ))}

      {/* Label (Hovered, Focused, or Proximity) */}
      {(isHovered || isFocused || isNearby) && (
        <Html position={[0, minY, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            ref={labelRef}
            className="transition-transform duration-75"
            style={{ transform: 'translateY(20px)' }}
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
