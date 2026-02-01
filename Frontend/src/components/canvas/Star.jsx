import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, Sparkles, MeshDistortMaterial } from '@react-three/drei'
import { useStore } from '../../store/useStore'
import * as THREE from 'three'

export function Star({ position, node, isSelected, onClick }) {
    const meshRef = useRef()
    const haloRef = useRef()
    const [hovered, setHover] = useState(false)
    const { viewMode } = useStore()

    // Destructure node properties
    const { importance, keywords, question, topicSummary } = node

    // --- Logic Merge: Use Current's Numeric Importance to drive Dev's Visual Categories ---

    // 1. Determine "Class" based on Importance (1-5)
    // Alpha: 5 (Crucial)
    // Beta: 3-4 (Standard)
    // Satellite: 1-2 (Trivial)
    const isAlpha = importance >= 5
    const isBeta = importance >= 3 && importance < 5

    // 2. Size Logic (Dev's sizing)
    let baseSize = 0.04 // Satellite
    if (isAlpha) baseSize = 0.15
    else if (isBeta) baseSize = 0.08

    // 3. Color Logic (Dev's Cyberpunk Palette adjusted for hierarchy)
    const getColor = () => {
        if (isAlpha) return { color: '#FFD700', emissive: '#FFaa00', intensity: 4.0 } // Gold (High Intensity)
        if (isBeta) return { color: '#00FFFF', emissive: '#0088FF', intensity: 2.5 } // Cyan
        return { color: '#ffffff', emissive: '#505050', intensity: 1.5 } // White (Dim)
    }

    const { color, emissive, intensity } = getColor()

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5
            // Pulse logic
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

    // Label: Show ONLY in Constellation Mode (Clean Chat Mode)
    // Logic: If constellation, allow hover/selected or default Alpha visibility
    const showLabel = viewMode === 'constellation' && (hovered || isSelected || isAlpha);

    return (
        <group position={position} onClick={onClick}>
            {/* Core Star */}
            <Sphere ref={meshRef} args={[baseSize, 32, 32]}
                onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
                onPointerOut={(e) => setHover(false)}
            >
                {/* Visual Style: Use Dev's Premium Materials */}
                {isAlpha ? (
                    <MeshDistortMaterial
                        color={color}
                        emissive={emissive}
                        emissiveIntensity={isSelected || hovered ? intensity * 2 : intensity}
                        roughness={0.1}
                        metalness={0.9}
                        distort={0.4}
                        speed={2}
                    />
                ) : (
                    <meshPhysicalMaterial
                        color={color}
                        emissive={emissive}
                        emissiveIntensity={intensity}
                        roughness={0.1}
                        metalness={0.1}
                        transmission={0.9} // Glassy look for smaller stars
                        thickness={0.5}
                    />
                )}
            </Sphere>

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

            {/* Particles for High Importance */}
            {isAlpha && (
                <Sparkles count={15} scale={baseSize * 8} size={2} speed={0.4} opacity={0.5} color={color} />
            )}

            {/* Label: Cyberpunk HUD Style */}
            {showLabel && (
                <Html distanceFactor={10} position={[0, baseSize + 0.2, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="flex flex-col items-center">
                        <div style={{
                            color: isAlpha ? '#FFD700' : '#00FFFF',
                            background: 'rgba(5, 5, 10, 0.7)',
                            padding: '4px 8px',
                            backdropFilter: 'blur(4px)',
                            border: `1px solid ${isAlpha ? 'rgba(255, 215, 0, 0.5)' : 'rgba(0, 255, 255, 0.3)'}`,
                            boxShadow: `0 0 15px ${isAlpha ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 255, 255, 0.1)'}`,
                            borderRadius: '2px',
                            textAlign: 'center',
                            minWidth: 'max-content',
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            letterSpacing: '0.05em'
                        }}>
                            <div style={{ fontWeight: 'bold' }}>
                                {topicSummary || (keywords && keywords[0]) || 'NODE'}
                            </div>
                        </div>
                        {/* Connecting Line */}
                        <div style={{ width: '1px', height: '20px', background: `linear-gradient(to top, ${emissive}, transparent)` }}></div>
                    </div>
                </Html>
            )}
        </group>
    )
}
