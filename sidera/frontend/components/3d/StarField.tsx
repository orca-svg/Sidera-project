import React, { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Instance, Instances } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '@/store'

// Material for Stars
const starMaterial = new THREE.MeshBasicMaterial({ color: 'white' })

interface StarFieldProps {
  turns: any[]
  onNodeClick: (turn: any) => void
}

export function StarField({ turns, onNodeClick }: StarFieldProps) {
  const { activeTurnId } = useAppStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Filter Replaced Turns for Visualization?
  // User Requirement: "Replace" should show as "Ghost" or special.
  // Let's handle regular Render first.

  return (
    <group>
      <Instances range={turns.length} material={starMaterial}>
        <sphereGeometry args={[0.08, 16, 16]} />
        {turns.map((turn) => {
          const isRecall = turn.isReplaced
          const isAlpha = turn.starType === 'ALPHA' || turn.pinned
          const isHovered = hoveredId === turn.id
          const isActive = activeTurnId === turn.id

          // Color Logic
          let color = 'white'
          if (isRecall) color = '#444' // Dim ghost
          else if (isAlpha) color = '#FFD700' // Gold
          else if (isActive) color = '#00FFFF' // Cyan

          // Scale Logic
          let scale = 1
          if (isAlpha) scale = 2.0
          if (isHovered) scale = 1.5

          return (
            <StarInstance
              key={turn.id}
              turn={turn}
              color={color}
              scale={scale}
              onClick={() => onNodeClick(turn)}
              onPointerOver={() => setHoveredId(turn.id)}
              onPointerOut={() => setHoveredId(null)}
              hovered={isHovered}
            />
          )
        })}
      </Instances>
    </group>
  )
}

interface StarInstanceProps {
  turn: any
  color: string
  scale: any
  onClick: (e?: any) => void
  onPointerOver: (e?: any) => void
  onPointerOut: (e?: any) => void
  hovered: boolean
}

function StarInstance({ turn, color, scale, onClick, onPointerOver, onPointerOut, hovered }: StarInstanceProps) {
  return (
    <group position={[turn.x, turn.y, turn.z]}>
      <Instance
        scale={scale}
        color={color}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onPointerOver()
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onPointerOut()
        }}
      />
      {/* HOVER LABEL - Only visible when hovered */}
      {hovered && (
        <Html distanceFactor={10}>
          <div className="bg-black/80 text-white p-2 text-xs rounded border border-white/20 whitespace-nowrap backdrop-blur-md">
            <div className="font-bold">{turn.roleUserText.slice(0, 20)}...</div>
            {turn.summary && <div className="text-gray-400">{turn.summary}</div>}
          </div>
        </Html>
      )}
    </group>
  )
}
