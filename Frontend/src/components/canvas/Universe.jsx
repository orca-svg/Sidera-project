import { useRef, useEffect, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, Stars, useTexture, Sphere, MeshDistortMaterial, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../../store/useStore'
import { useEventListener } from '../../hooks/useEventListener'
import { InteractiveConstellation } from './InteractiveConstellation'
import { Star } from './Star'
import { Constellation } from './Constellation'
import { WarpField } from './WarpField'
import * as THREE from 'three'

// --- Completed Constellation Backgrounds ---
// Hash function to deterministically place constellations in 3D space
function hashId(id) {
    let h = 0
    for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h) + id.charCodeAt(i)
        h |= 0
    }
    return Math.abs(h) / 2147483647
}

// Mini star for background constellation - smaller and dimmer
function BackgroundStar({ position, importance }) {
    // Smaller sizes for background
    const size = 0.08 + (importance ?? 2) * 0.03

    // Config based on importance
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

// Mini edge for background constellation - very subtle
function BackgroundEdge({ start, end, type }) {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)]
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)

    // Explicit edges slightly more visible
    const color = type === 'explicit' ? '#336688' : '#223344'
    const opacity = type === 'explicit' ? 0.25 : 0.12

    return (
        <line geometry={lineGeometry}>
            <lineBasicMaterial color={color} transparent opacity={opacity} />
        </line>
    )
}

// Single background constellation (positioned and scaled)
function BackgroundConstellation({ constellation, offset, scale }) {
    const { nodes, edges } = constellation

    // Create node map for edge lookup
    const nodeMap = new Map(nodes.map(n => [n.id.toString(), n]))

    // Convert position object {x,y,z} to array [x,y,z] and apply scale/offset
    const getPosition = (pos) => {
        if (!pos) return offset // Default to offset if no position
        const x = Array.isArray(pos) ? pos[0] : (pos.x ?? 0)
        const y = Array.isArray(pos) ? pos[1] : (pos.y ?? 0)
        const z = Array.isArray(pos) ? pos[2] : (pos.z ?? 0)
        return [
            x * scale + offset[0],
            y * scale + offset[1],
            z * scale + offset[2]
        ]
    }

    return (
        <group>
            {/* Render edges first (behind stars) */}
            {edges.map((edge, i) => {
                const sourceNode = nodeMap.get(edge.source?.toString())
                const targetNode = nodeMap.get(edge.target?.toString())
                if (!sourceNode || !targetNode) return null
                return (
                    <BackgroundEdge
                        key={`e-${i}`}
                        start={getPosition(sourceNode.position)}
                        end={getPosition(targetNode.position)}
                        type={edge.type}
                    />
                )
            })}

            {/* Render stars */}
            {nodes.map((node, i) => (
                <BackgroundStar
                    key={`n-${i}`}
                    position={getPosition(node.position)}
                    importance={node.importance}
                />
            ))}
        </group>
    )
}

// --- Observatory View Component ---
function ObservatoryView() {
    const { completedImages, viewMode, observatoryHoveredConstellation,
        observatoryFocusedConstellation, setObservatoryHoveredConstellation,
        setObservatoryFocusedConstellation } = useStore()

    if (viewMode !== 'observatory') return null

    const toShow = completedImages.filter(item => item.nodes?.length > 0)

    // Spiral Layout Logic
    const calculatePosition = (index, total) => {
        // Simple spiral
        const angle = index * 0.8
        const radius = 30 + index * 15

        return [
            Math.cos(angle) * radius,
            Math.sin(angle) * radius * 0.6, // Flattened Y
            -20 - (index * 5)               // Slight depth recession
        ]
    }

    if (toShow.length === 0) {
        return (
            <Html center>
                <div className="text-center text-gray-500 pointer-events-none select-none">
                    <p className="text-lg">No completed star maps found</p>
                    <p className="text-sm opacity-60">Complete a conversation to add it to the observatory</p>
                </div>
            </Html>
        )
    }

    return (
        <group>
            {toShow.map((item, index) => (
                <InteractiveConstellation
                    key={item.projectId}
                    constellation={item}
                    offset={calculatePosition(index, toShow.length)}
                    isHovered={observatoryHoveredConstellation === item.projectId}
                    isFocused={observatoryFocusedConstellation?.projectId === item.projectId}
                    onHover={setObservatoryHoveredConstellation}
                    onClick={setObservatoryFocusedConstellation}
                />
            ))}
        </group>
    )
}

// Container for all completed constellation backgrounds
function CompletedConstellationBackgrounds() {
    const completedImages = useStore(state => state.completedImages)
    const activeProjectId = useStore(state => state.activeProjectId)
    const viewMode = useStore(state => state.viewMode)

    // Hide in chat mode AND observatory mode (Observatory has its own view)
    if (viewMode === 'chat' || viewMode === 'observatory') return null

    // Filter: has nodes AND not the current project
    const toShow = completedImages.filter(item =>
        item.nodes?.length > 0 &&
        item.projectId.toString() !== activeProjectId?.toString()
    )

    if (toShow.length === 0) return null

    return (
        <>
            {toShow.map((item, index) => {
                const h = hashId(item.projectId.toString())
                const h2 = (h * 7.3) % 1
                const h3 = (h * 13.7) % 1

                // Much wider distribution: X ±80, Y ±40, Z -60 ~ -120
                const offset = [
                    (h * 2 - 1) * 80,
                    (h2 * 2 - 1) * 40,
                    -60 - h3 * 60
                ]

                // Scale based on distance (farther = smaller for perspective)
                const distanceFactor = (Math.abs(offset[2]) - 60) / 60 + 1
                const scale = 0.35 / distanceFactor

                return (
                    <BackgroundConstellation
                        key={item.projectId}
                        constellation={item}
                        offset={offset}
                        scale={scale}
                    />
                )
            })}
        </>
    )
}

function InteractiveBackground({ children }) {
    const ref = useRef()

    const mouseRef = useRef({ x: 0, y: 0 })

    // Optimized: Use custom hook for event listener management
    useEventListener('mousemove', (event) => {
        // Normalize mouse position (-1 to 1)
        mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1
        mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    })

    useFrame((state) => {
        if (ref.current) {
            // Gentle rotation based on mouse position (Parallax)
            const x = mouseRef.current.x * 0.2
            const y = mouseRef.current.y * 0.2

            ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, x, 0.05)
            ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -y, 0.05)
        }
    })

    return (
        <group ref={ref}>
            {children}
        </group>
    )
}

// internal helper for smooth visibility transition
function AnimatedUniverse({ children }) {
    const groupRef = useRef()
    const { viewMode } = useStore()

    useFrame((state, delta) => {
        if (!groupRef.current) return

        // Target: 1.0 (Show) in Constellation, 0.0 (Hide) in Chat
        const targetScale = viewMode === 'constellation' ? 1 : 0

        // Smooth Lerp (Frame independent-ish)
        // Using a simple lerp factor for "spring-like" feel
        const step = 0.1

        // Apply Scale
        groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), step)

        // Optimization: Disable rendering when effectively invisible
        // We trigger visibility off only when very small to prevent "pop"
        // But for smooth fade out, we keep it visible until almost 0
        groupRef.current.visible = groupRef.current.scale.x > 0.001
    })

    return <group ref={groupRef}>{children}</group>
}

export function Universe({ isInteractive = true }) {
    // Optimized: Use selective Zustand selectors to prevent unnecessary re-renders
    const nodes = useStore(state => state.nodes)
    const edges = useStore(state => state.edges)
    const activeNode = useStore(state => state.activeNode)
    const setActiveNode = useStore(state => state.setActiveNode)
    const viewMode = useStore(state => state.viewMode)
    const isWarping = useStore(state => state.isWarping)
    const setIsWarping = useStore(state => state.setIsWarping)
    const focusTarget = useStore(state => state.focusTarget)
    const settings = useStore(state => state.settings)
    const cameraControlsRef = useRef()

    console.log(`[Universe] Rendering ${nodes.length} stars and ${edges.length} edges`)

    // Optimized: Create node index map for O(1) lookups instead of O(n²)
    const nodeMap = useMemo(() =>
        new Map(nodes.map(n => [n.id, n])),
        [nodes]
    )

    // Optimized: Memoize visual settings to avoid recalculation on every render
    const visualConfig = useMemo(() => {
        const isHighQuality = settings?.visualDetail === 'high'
        return {
            starCount: isHighQuality ? 5000 : 1000,
            bloomIntensity: isHighQuality ? 2.0 : 0.8
        }
    }, [settings?.visualDetail])

    // Optimized: Memoize event handler to prevent recreation on every render
    const handleNodeClick = useCallback((nodeId) => (e) => {
        e.stopPropagation()
        if (isInteractive) setActiveNode(nodeId)
    }, [isInteractive, setActiveNode])

    const observatoryFocusedConstellation = useStore(state => state.observatoryFocusedConstellation)

    // ... existing code ...

    // Camera Navigation Logic Update
    useEffect(() => {
        if (!cameraControlsRef.current) return

        if (viewMode === 'observatory') {
            if (observatoryFocusedConstellation) {
                // Focus on specific constellation
                const [x, y, z] = observatoryFocusedConstellation.position
                cameraControlsRef.current.setLookAt(
                    x, y, z + 25, // Camera Position
                    x, y, z,      // Look Target
                    true
                )
            } else {
                // Overview Mode - Dynamic Fit using Bounding Box
                const validConstellations = useStore.getState().completedImages.filter(item => item.nodes?.length > 0)

                if (validConstellations.length > 0) {
                    let maxExtent = 0

                    // Calculate positions and find max distance from origin
                    validConstellations.forEach((_, index) => {
                        // Re-use the same spiral logic to predict position
                        // Spiral: Radius = 30 + index * 15
                        const radius = 30 + index * 15
                        const indexZ = 20 + (index * 5)
                        const dist = Math.max(radius, indexZ) // simplified max extent
                        if (dist > maxExtent) maxExtent = dist
                    })

                    // Fit to FOV (60 deg -> tan(30) = 0.577)
                    // Distance = Size / tan(30) approx Size * 1.73
                    // Adjusted: 1.5 multiplier (was 2.0) for tighter fit as requested
                    const targetZ = Math.max(80, maxExtent * 1.5)
                    cameraControlsRef.current.setLookAt(0, 0, targetZ, 0, 0, 0, true)
                } else {
                    cameraControlsRef.current.setLookAt(0, 0, 200, 0, 0, 0, true)
                }
            }
        } else if (viewMode === 'constellation' && focusTarget) {
            const [x, y, z] = focusTarget.position
            cameraControlsRef.current.setLookAt(
                x, y, z + 8, // Position
                x, y, z,     // Target
                true         // Smooth Transition
            )
        }
    }, [focusTarget, viewMode, observatoryFocusedConstellation])

    // Cinematic Warp Logic Update
    useEffect(() => {
        if (!cameraControlsRef.current) return

        // 1. Trigger Warp State
        setIsWarping(true)

        // 2. Camera Movement
        if (viewMode === 'constellation') {
            // Warp INTO the universe (Detailed View)
            cameraControlsRef.current.setLookAt(0, 0, 40, 0, 0, 0, true)
        } else if (viewMode === 'observatory') {
            // Warp into observatory (Overview)
            cameraControlsRef.current.setLookAt(0, 0, 200, 0, 0, 0, true)
        } else {
            // Warp OUT to chat (Deep Space View)
            cameraControlsRef.current.setLookAt(0, 0, 120, 0, 0, 0, true)
        }

        // 3. End Warp (after animation duration)
        // User Request: edges visible 0.7s earlier (1000 -> 300)
        const timer = setTimeout(() => {
            setIsWarping(false)
        }, 300)

        return () => clearTimeout(timer)
    }, [viewMode, setIsWarping])

    const saveViewState = useStore(state => state.saveViewState)
    const saveTimeoutRef = useRef(null)

    const handleCameraChange = () => {
        if (!cameraControlsRef.current) return

        // Debounce Save (1s)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        saveTimeoutRef.current = setTimeout(() => {
            if (!cameraControlsRef.current) return

            const pos = new THREE.Vector3()
            const target = new THREE.Vector3()
            cameraControlsRef.current.getPosition(pos)
            cameraControlsRef.current.getTarget(target)

            // Calculate distance as 'zoom' approximation
            const distance = pos.distanceTo(target)

            saveViewState({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                zoom: distance
            })
            // console.log("View State Saved", pos, distance)
        }, 1000)
    }

    return (
        <>

            <Canvas
                camera={{ position: [0, 0, 120], fov: 60 }}
                style={{ height: '100%', width: '100%', background: '#050510' }}
                gl={{ preserveDrawingBuffer: true }}
            >
                {/* Scene Background (Matches CSS for correct Capture) */}
                <color attach="background" args={['#050510']} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />

                {/* Effect: Warp Field (High Speed Particles) - Only visible during transition */}
                <WarpField count={2000} />

                <InteractiveBackground>
                    {/* Layer 1: Persistent Background Stars (Always visible with Parallax) */}
                    <Stars radius={300} depth={50} count={visualConfig.starCount} factor={4} saturation={0} fade speed={1} />


                    {/* Layer 1.5: Completed Constellation Background Images */}
                    <CompletedConstellationBackgrounds />

                    {/* Layer 1.6: Observatory Mode View */}
                    <ObservatoryView />


                    {/* Layer 2: Construct/Knowledge Graph (Visible only in Constellation Mode) */}
                    <AnimatedUniverse>

                        {/* Render Nodes (Stars) */}
                        {nodes.map((node) => (
                            <Star
                                key={node.id}
                                position={node.position}
                                node={node}
                                isSelected={activeNode === node.id}
                                onClick={handleNodeClick(node.id)}
                            />
                        ))}

                        {/* Render Edges (Constellations) */}
                        {/* Logic: Show edges if warping to 'chat' (so they scale down with stars) OR if not warping (stable) */}
                        {(viewMode === 'chat' || !isWarping) && edges.map((edge) => {
                            // Optimized: Use Map for O(1) lookup instead of Array.find O(n)
                            const sourceNode = nodeMap.get(edge.source)
                            const targetNode = nodeMap.get(edge.target)
                            if (!sourceNode || !targetNode) return null

                            return (
                                <Constellation
                                    key={edge.id}
                                    start={sourceNode.position}
                                    end={targetNode.position}
                                    type={edge.type}
                                />
                            )
                        })}
                    </AnimatedUniverse>
                </InteractiveBackground>

                <CameraControls
                    ref={cameraControlsRef}
                    minDistance={viewMode === 'observatory' && observatoryFocusedConstellation ? 24 : 2}
                    maxDistance={viewMode === 'observatory' && observatoryFocusedConstellation ? 26 : 300} // Lock zoom when focused
                    dollySpeed={viewMode === 'observatory' && observatoryFocusedConstellation ? 0 : 0.5} // Disable dolly when focused
                    smoothTime={0.8} // Smooth damping for transitions
                    onChange={handleCameraChange}
                />

                {/* Post Processing: Bloom for Cyberpunk Glow (Conditional) */}
                <EffectComposer>
                    {/* Provide children or correct props if Bloom needs to be conditional.
                     EffectComposer usually renders effects passed as children.
                     If intensity is 0, Bloom is effectively off, but we can also conditionally render it.
                  */}
                    <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={visualConfig.bloomIntensity} />
                </EffectComposer>
            </Canvas>
        </>
    )
}
