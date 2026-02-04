import { useRef, useState, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, Sparkles, MeshDistortMaterial } from '@react-three/drei'
import { useStore } from '../../store/useStore'
import { Bookmark } from 'lucide-react'
import clsx from 'clsx'
import * as THREE from 'three'

// Helper component for dynamic label scaling
function LabelContent({
    topicSummary, starLabel, keywords,
    lineColor, lineShadow, borderColor, shadowColor, themeColor,
    groupPosition
}) {
    const labelRef = useRef()

    useFrame((state) => {
        if (!labelRef.current) return

        // Calculate distance from camera to star
        const currentPos = new THREE.Vector3(...groupPosition)
        const distance = state.camera.position.distanceTo(currentPos)

        // Dynamic Scale Logic:
        // Base scale factor (adjust 20 to change 'zoom' feeling)
        // Min scale 0.5 (readable), Max scale 1.2 (not too huge)
        const scale = Math.max(0.4, Math.min(1.2, 25 / distance))

        labelRef.current.style.transform = `scale(${scale})`
        labelRef.current.style.opacity = scale < 0.45 ? 0.5 : 1 // Fade out slightly if very far (optional polish)
    })

    return (
        <div ref={labelRef} className="flex flex-col-reverse items-center transform -translate-y-[50%] pb-2 transition-transform duration-75 ease-out origin-bottom">
            <div className={clsx("w-px h-10 transition-all duration-300", lineColor, lineShadow)} />
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
    )
}

export function Star({ position, node, isSelected, onClick }) {
    const meshRef = useRef()
    const haloRef = useRef()
    const labelRef = useRef() // Ref for HTML Label
    const [hovered, setHover] = useState(false)
    const { viewMode } = useStore()

    // Destructure node properties
    const { importance, keywords, topicSummary, starLabel } = node

    const sparklesRef = useRef()

    // 2. Visual Config based on Importance
    const getConfig = () => {
        switch (importance) {
            case 5: return {
                distort: 0.4, speed: 2, roughness: 0.1,
                haloOpacity: 0.1, haloScale: 3,
                sparkles: 12, sparkleScale: 8 // Restored but slightly reduced
            }
            case 4: return {
                distort: 0.3, speed: 1.5, roughness: 0.2,
                haloOpacity: 0.05, haloScale: 2.5,
                sparkles: 6, sparkleScale: 6 // Restored
            }
            case 3: return {
                distort: 0.2, speed: 1.0, roughness: 0.3,
                haloOpacity: 0, haloScale: 0,
                sparkles: 0, sparkleScale: 0
            }
            case 2: return {
                distort: 0.1, speed: 0.5, roughness: 0.4,
                haloOpacity: 0, haloScale: 0,
                sparkles: 0, sparkleScale: 0
            }
            default: return {
                distort: 0, speed: 0, roughness: 0.6, // Static
                haloOpacity: 0, haloScale: 0,
                sparkles: 0, sparkleScale: 0
            }
        }
    }
    const config = getConfig()
    const useDistort = importance >= 2

    const getSize = () => {
        switch (importance) {
            case 5: return 0.18
            case 4: return 0.14 // Slightly larger for visibility
            case 3: return 0.10
            case 2: return 0.06
            default: return 0.03
        }
    }
    const baseSize = getSize()

    const getColor = () => {
        switch (importance) {
            case 5: return { color: '#FFD700', emissive: '#FFaa00', intensity: 4.0 }
            case 4: return { color: '#00FFFF', emissive: '#0088FF', intensity: 3.0 }
            case 3: return { color: '#88AAFF', emissive: '#5588EE', intensity: 2.0 }
            case 2: return { color: '#FFFFFF', emissive: '#888888', intensity: 1.2 }
            default: return { color: '#888888', emissive: '#444444', intensity: 0.5 }
        }
    }

    const { color, emissive, intensity } = getColor()
    const themeColor = importance >= 5 ? 'text-yellow-400' : 'text-cyan-400'
    const borderColor = importance >= 5 ? 'border-yellow-500/50' : 'border-cyan-500/50'
    const shadowColor = importance >= 5 ? 'shadow-yellow-500/20' : 'shadow-cyan-500/20'
    const lineColor = importance >= 5 ? 'bg-yellow-400' : 'bg-cyan-400'
    const lineShadow = importance >= 5 ? 'shadow-[0_0_10px_#fbbf24]' : 'shadow-[0_0_10px_cyan]'

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
        if (sparklesRef.current) {
            sparklesRef.current.rotation.y -= delta * 0.1 // Much slower orbit
            sparklesRef.current.rotation.x += delta * 0.05 // Gentle tilt
        }

        // Dynamic Pin Scaling (Manual Clamp)
        if (showLabel && labelRef.current && meshRef.current) {
            const distance = state.camera.position.distanceTo(meshRef.current.position) // Approximate (Mesh is at 0 local)
            // But mesh position is local 0,0,0 relative to parent group which is at 'position'
            // Distance from camera to group position
            const groupPos = new THREE.Vector3(...position)
            const camDist = state.camera.position.distanceTo(groupPos)

            // Scale Logic
            // Adjusted: Min 0.7 (was 0.4) to keep readability at distance
            // Factor 30 (was 25) to decay slower
            const labelScale = Math.max(0.7, Math.min(1.2, 30 / camDist))

            labelRef.current.style.transform = `scale(${labelScale})`
            // Keep opacity 1 unless extremely far (though clamped scale prevents this now)
            labelRef.current.style.opacity = 1
            labelRef.current.style.transformOrigin = 'bottom center'
        }
    })

    // Label Logic - STRICT: Only show if hovered or selected
    const showLabel = viewMode === 'constellation' && (hovered || isSelected);

    return (
        <group position={position} onClick={onClick}>
            {/* Core Star Mesh */}
            <Sphere ref={meshRef} args={[baseSize, 32, 32]}
                onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
                onPointerOut={(e) => setHover(false)}
            >
                {useDistort ? (
                    <MeshDistortMaterial
                        color={color}
                        emissive={emissive}
                        emissiveIntensity={isSelected || hovered ? intensity * 2 : intensity}
                        roughness={config.roughness}
                        metalness={0.9}
                        distort={config.distort}
                        speed={config.speed}
                        toneMapped={false}
                    />
                ) : (
                    <meshPhysicalMaterial
                        color={color}
                        emissive={emissive}
                        emissiveIntensity={intensity}
                        roughness={config.roughness}
                        metalness={0.1}
                        transmission={0.9}
                        thickness={0.5}
                        toneMapped={false}
                    />
                )}
            </Sphere>

            {/* HUD Pin UI */}
            {showLabel && (
                <Html
                    position={[0, baseSize, 0]}
                    center
                    zIndexRange={[100, 0]}
                    style={{ pointerEvents: 'none' }}
                >
                    <div
                        ref={labelRef}
                        className="flex flex-col-reverse items-center transform -translate-y-[50%] pb-2 transition-transform duration-75 ease-out"
                    >
                        <div className={clsx("w-px h-10 transition-all duration-300", lineColor, lineShadow)} />
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

            {/* Bookmark Ring */}
            {node.isBookmarked && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseSize * 1.5, baseSize * 1.6, 32]} />
                    <meshBasicMaterial color="#FFD700" side={2} transparent opacity={0.6} />
                </mesh>
            )}

            {/* Scalable Halo */}
            {config.haloOpacity > 0 && (
                <Sphere ref={haloRef} args={[baseSize * config.haloScale, 16, 16]}>
                    <meshBasicMaterial
                        color={emissive}
                        transparent
                        opacity={config.haloOpacity}
                        wireframe
                    />
                </Sphere>
            )}

            {/* Scalable Sparkles - Orbiting */}
            {config.sparkles > 0 && (
                <group ref={sparklesRef}>
                    <Sparkles
                        count={config.sparkles}
                        scale={baseSize * config.sparkleScale}
                        size={2}
                        speed={0.1}
                        opacity={0.3}
                        color={color}
                    />
                </group>
            )}
        </group>
    )
}

