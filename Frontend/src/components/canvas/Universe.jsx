import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { useStore } from '../../store/useStore'
import { Star } from './Star'
import { Constellation } from './Constellation'
import * as THREE from 'three'

function InteractiveBackground() {
    const ref = useRef()

    useFrame((state) => {
        if (ref.current) {
            // Gentle rotation based on mouse position (Parallax)
            // state.pointer.x/y are normalized (-1 to 1)
            const x = state.pointer.x * 0.2
            const y = state.pointer.y * 0.2

            ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, x, 0.05)
            ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -y, 0.05)
        }
    })

    return (
        <group ref={ref}>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        </group>
    )
}

export function Universe({ isInteractive = true }) {
    const { nodes, edges, activeNode, setActiveNode } = useStore()

    return (
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }} style={{ height: '100%', width: '100%', background: '#050510' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />

            <InteractiveBackground />

            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                enableZoom={isInteractive}
                enableRotate={isInteractive}
                enablePan={isInteractive}
                autoRotate={!isInteractive} // Slowly rotate if minified/background mode (optional)
                autoRotateSpeed={0.5}
            />

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
        </Canvas>
    )
}
