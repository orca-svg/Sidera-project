import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, Sparkles, MeshDistortMaterial } from '@react-three/drei'
import { useStore } from '../../store/useStore'
import { Bookmark } from 'lucide-react'
import clsx from 'clsx'

export function Star({ position, node, isSelected, onClick }) {
    const meshRef = useRef()
    const haloRef = useRef()
    const [hovered, setHover] = useState(false)
    const { viewMode } = useStore()

    // Destructure node properties
    const { importance, keywords, topicSummary, starLabel } = node

    // 1. Determine "Class" based on Importance
    // 1. Granular Sidera-IS Visual Mapping (1-5)
    // 5: Critical (Gold/Large) - Supernova
    // 4: High (Cyan/Med-Large) - Giant
    // 3: Medium (Blue/Med) - Main Seq
    // 2: Low (White/Small) - Dwarf
    // 1: Trivial (Grey/Tiny) - Dust

    const isAlpha = importance >= 5

    const getSize = () => {
        switch (importance) {
            case 5: return 0.18
            case 4: return 0.12
            case 3: return 0.08
            case 2: return 0.05
            default: return 0.03
        }
    }
    const baseSize = getSize()

    const getColor = () => {
        switch (importance) {
            case 5: return { color: '#FFD700', emissive: '#FFaa00', intensity: 4.0 } // Gold
            case 4: return { color: '#00FFFF', emissive: '#0088FF', intensity: 3.0 } // Cyan
            case 3: return { color: '#88AAFF', emissive: '#5588EE', intensity: 2.0 } // Blue
            case 2: return { color: '#FFFFFF', emissive: '#888888', intensity: 1.2 } // White
            default: return { color: '#888888', emissive: '#444444', intensity: 0.5 } // Grey
        }
    }

    const { color, emissive, intensity } = getColor()
    const themeColor = isAlpha ? 'text-yellow-400' : 'text-cyan-400'
    const borderColor = isAlpha ? 'border-yellow-500/50' : 'border-cyan-500/50'
    const shadowColor = isAlpha ? 'shadow-yellow-500/20' : 'shadow-cyan-500/20'
    const lineColor = isAlpha ? 'bg-yellow-400' : 'bg-cyan-400'
    const lineShadow = isAlpha ? 'shadow-[0_0_10px_#fbbf24]' : 'shadow-[0_0_10px_cyan]'

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5
            const t = state.clock.elapsedTime
            const pulse = Math.sin(t * (isSelected ? 3 : 1)) * 0.1
            const scale = (isSelected || hovered) ? 1.5 + pulse : 1 + pulse
            meshRef.current.scale.set(scale, scale, scale)
        }
        if (haloRef.current) {
            haloRef.current.rotation.x += delta * 0.2
            haloRef.current.rotation.z += delta * 0.2
        }
    })

    // Label: Show in Constellation Mode for (Hovered / Selected / Alpha)
    // "Alpha" nodes are landmarks, so they should always be visible in this mode.
    const showLabel = viewMode === 'constellation' && (hovered || isSelected || isAlpha);

    return (
        <group position={position} onClick={onClick}>
            {/* Core Star Mesh */}
            <Sphere ref={meshRef} args={[baseSize, 32, 32]}
                onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
                onPointerOut={(e) => setHover(false)}
            >
                {/* Material */}
                {isAlpha ? (
                    <MeshDistortMaterial
                        color={color}
                        emissive={emissive}
                        emissiveIntensity={isSelected || hovered ? intensity * 2 : intensity}
                        roughness={0.1}
                        metalness={0.9}
                        distort={0.4}
                        speed={2}
                        toneMapped={false}
                    />
                ) : (
                    <meshPhysicalMaterial
                        color={color}
                        emissive={emissive}
                        emissiveIntensity={intensity}
                        roughness={0.1}
                        metalness={0.1}
                        transmission={0.9}
                        thickness={0.5}
                        toneMapped={false}
                    />
                )}
            </Sphere>

            {/* HUD Pin UI (Moved outside Sphere to prevent self-occlusion) */}
            {showLabel && (
                <Html
                    position={[0, baseSize, 0]} // Start at top of the sphere
                    center // Centers the div on the coordinate
                    distanceFactor={15} // Adjusted to 1.5x (User request)
                    zIndexRange={[100, 0]}
                    // occlude="blending" // Optional: smoother occlusion
                    style={{ pointerEvents: 'none' }}
                >
                    {/* 
                        Layout: Flex Column Reverse 
                        - Card (Top)
                        - Line (Bottom)
                        We offset translateY to make the bottom of the line touch the anchor point.
                        Since 'center' centers the whole block, we shift UP by 50% of height.
                    */}
                    <div className="flex flex-col-reverse items-center transform -translate-y-[50%] pb-2">

                        {/* 1. Connection Line (Grows Upwards) */}
                        <div className={clsx("w-px h-10 transition-all duration-300", lineColor, lineShadow)} />

                        {/* 2. Info Card (Glass Panel) */}
                        <div className={clsx(
                            "mb-1 px-3 py-1.5 rounded-lg border backdrop-blur-md shadow-xl transition-all duration-300 pointer-events-auto flex items-center gap-2",
                            "bg-black/80 text-sm whitespace-nowrap",
                            borderColor, shadowColor
                        )}>
                            <span className={clsx("font-bold animate-pulse", themeColor)}>●</span>
                            <span className="text-gray-100 font-mono tracking-wide text-center leading-tight">
                                {topicSummary || starLabel || (keywords && keywords[0]) || "NODE"}
                            </span>
                        </div>

                    </div>
                </Html>
            )}

            {/* Bookmark Visual Indicator (Orbiting Ring) */}
            {node.isBookmarked && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseSize * 1.5, baseSize * 1.6, 32]} />
                    <meshBasicMaterial color="#FFD700" side={2} transparent opacity={0.6} />
                </mesh>
            )}

            {/* Halo for Alpha Stars */}
            {isAlpha && (
                <Sphere ref={haloRef} args={[baseSize * 3, 16, 16]}>
                    <meshBasicMaterial
                        color={emissive}
                        transparent
                        opacity={0.1}
                        wireframe
                    />
                </Sphere>
            )}

            {/* Particles */}
            {isAlpha && (
                <Sparkles count={15} scale={baseSize * 8} size={2} speed={0.4} opacity={0.5} color={color} />
            )}
        </group>
    )
}
