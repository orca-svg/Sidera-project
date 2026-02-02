import { useRef, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../../store/useStore'
import { useEventListener } from '../../hooks/useEventListener'
import { Star } from './Star'
import { Constellation } from './Constellation'
import { WarpField } from './WarpField'
import * as THREE from 'three'

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

    // Camera Navigation (Fly to Node)
    useEffect(() => {
        if (viewMode === 'constellation' && focusTarget && cameraControlsRef.current) {
            const [x, y, z] = focusTarget.position
            // Fly to "Eye" position (z+8) and look at "Target" (star center)
            cameraControlsRef.current.setLookAt(
                x, y, z + 8, // Position
                x, y, z,     // Target
                true         // Smooth Transition
            )
        }
    }, [focusTarget, viewMode])

    // Cinematic Warp Transition
    useEffect(() => {
        if (!cameraControlsRef.current) return

        // 1. Trigger Warp State
        setIsWarping(true)

        // 2. Camera Movement
        if (viewMode === 'constellation') {
            // Warp INTO the universe (Detailed View)
            // Move to Overview Position (Forward motion: 120 -> 40)
            cameraControlsRef.current.setLookAt(0, 0, 40, 0, 0, 0, true)
        } else {
            // Warp OUT to chat (Deep Space View)
            // Move far back to create "Approach" feel when returning
            cameraControlsRef.current.setLookAt(0, 0, 120, 0, 0, 0, true)
        }

        // 3. End Warp (after animation duration)
        // CameraControls default transition is approx 1s unless configured. 
        // We set a slightly longer warp for effect.
        const timer = setTimeout(() => {
            setIsWarping(false)
        }, 1000)

        return () => clearTimeout(timer)
    }, [viewMode, setIsWarping])

    return (
        <>
            {/* Edge Legend Overlay - Only visible in constellation view */}
            {viewMode === 'constellation' && (
                <div className="absolute bottom-6 left-6 z-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-4 py-3 shadow-xl">
                    <div className="text-xs font-medium text-gray-300 mb-2">연결 타입</div>
                    <div className="space-y-2 text-xs text-gray-400">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <div className="w-8 h-px bg-gray-500 opacity-40" style={{ backgroundImage: 'linear-gradient(to right, #445566 50%, transparent 50%)', backgroundSize: '4px 1px' }} />
                            </div>
                            <span>시간순 연결</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-0.5 bg-cyan-400" style={{ boxShadow: '0 0 4px #00FFFF' }} />
                            <span>명시적 연결 (≥0.85)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <div className="w-8 h-px bg-blue-300 opacity-50" style={{ backgroundImage: 'linear-gradient(to right, #88AAFF 50%, transparent 50%)', backgroundSize: '4px 1px' }} />
                            </div>
                            <span>암묵적 연결 (≥0.65)</span>
                        </div>
                    </div>
                </div>
            )}

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
                    {edges.map((edge) => {
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
                minDistance={2}
                maxDistance={30}
                dollySpeed={0.5} // Smoother zoom
                smoothTime={0.8} // Smooth damping for transitions
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
