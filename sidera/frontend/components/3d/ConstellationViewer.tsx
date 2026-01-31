import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line } from '@react-three/drei'
import { StarField } from './StarField'
import * as THREE from 'three'
import { useAppStore } from '@/store'


interface ConnectionsProps {
  turns: any[]
  edges: any[]
}

function Connections({ turns, edges }: ConnectionsProps) {
  // Map turns for easy access
  const turnMap = useMemo(() => new Map(turns.map(t => [t.id, t])), [turns])

  return (
    <group>
      {edges.map(edge => {
        const from = turnMap.get(edge.fromTurnId)
        const to = turnMap.get(edge.toTurnId)
        if (!from || !to) return null

        return (
          <Line
            key={edge.id}
            points={[[from.x, from.y, from.z], [to.x, to.y, to.z]]}
            color={edge.type === 'WARP' ? 'cyan' : 'white'}
            opacity={0.2}
            transparent
            lineWidth={edge.type === 'WARP' ? 2 : 1}
          />
        )
      })}
    </group>
  )
}

function CameraController() {
  const { cameraTarget } = useAppStore()
  const { camera, controls } = useThree()
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (cameraTarget && controlsRef.current) {
      // Fly to target
      // Simple implementation: Just jump or lerp
      // controlsRef.current.target.set(...cameraTarget)
      // camera.position.set(cameraTarget[0], cameraTarget[1], cameraTarget[2] + 10)
    }
  }, [cameraTarget])

  return <OrbitControls ref={controlsRef} makeDefault />
}

interface ViewerProps {
  turns: any[]
  edges: any[]
  onNodeClick: (turn: any) => void
}

export default function ConstellationViewer({ turns, edges, onNodeClick }: ViewerProps) {
  return (
    <div className="w-full h-full bg-slate-950">
      <Canvas camera={{ position: [0, 0, 20], fov: 60 }}>
        <color attach="background" args={['#020617']} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <StarField turns={turns} onNodeClick={onNodeClick} />
        <Connections turns={turns} edges={edges} />

        <CameraController />
      </Canvas>
    </div>
  )
}
import { useMemo } from 'react'
