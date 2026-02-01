import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../../store/useStore'
import { Star } from './Star'
import { Constellation } from './Constellation'
import { WarpField } from './WarpField'
import * as THREE from 'three'

function InteractiveBackground({ children }) {
    const ref = useRef()

    const mouseRef = useRef({ x: 0, y: 0 })

    useEffect(() => {
        const handleMouseMove = (event) => {
            // Normalize mouse position (-1 to 1)
            mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1
            mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

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
    const { nodes, edges, activeNode, setActiveNode, viewMode, setIsWarping } = useStore()
    const cameraControlsRef = useRef()

    // Cinematic Warp Transition
    useEffect(() => {
        if (!cameraControlsRef.current) return

        // 1. Trigger Warp State
        setIsWarping(true)

        // 2. Camera Movement
        if (viewMode === 'constellation') {
            // Warp INTO the universe (Detailed View)
            // Move closer to [0,0,5]
            cameraControlsRef.current.setLookAt(0, 0, 5, 0, 0, 0, true)
        } else {
            // Warp OUT to chat (Overview/Distant View)
            cameraControlsRef.current.setLookAt(0, 0, 15, 0, 0, 0, true)
        }

        // 3. End Warp (after animation duration)
        // CameraControls default transition is approx 1s unless configured. 
        // We set a slightly longer warp for effect.
        const timer = setTimeout(() => {
            setIsWarping(false)
        }, 1200)

        return () => clearTimeout(timer)
    }, [viewMode, setIsWarping])

    return (
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }} style={{ height: '100%', width: '100%', background: '#050510' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />

            {/* Effect: Warp Field (High Speed Particles) - Only visible during transition */}
            <WarpField count={2000} />

            <InteractiveBackground>
                {/* Layer 1: Persistent Background Stars (Always visible with Parallax) */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* Layer 2: Construct/Knowledge Graph (Visible only in Constellation Mode) */}
                <AnimatedUniverse>

                    {/* Render Nodes (Stars) */}
                    {nodes.map((node) => (
                        <Star
                            key={node.id}
                            position={node.position}
                            node={node}
                            isSelected={activeNode === node.id}
                            onClick={(e) => {
                                e.stopPropagation()
                                if (isInteractive) setActiveNode(node.id)
                            }}
                        />
                    ))}

                    {/* Render Edges (Constellations) */}
                    {edges.map((edge) => {
                        const sourceNode = nodes.find(n => n.id === edge.source)
                        const targetNode = nodes.find(n => n.id === edge.target)
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

            {/* Post Processing: Bloom for Cyberpunk Glow */}
            <EffectComposer>
                <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={2.0} />
            </EffectComposer>
        </Canvas>
    )
}
