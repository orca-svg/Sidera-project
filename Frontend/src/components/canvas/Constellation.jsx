import { useRef } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

export function Constellation({ start, end, type }) {
    // Cyberpunk Energy Line
    // High opacity but thin, with bloom it will glow.

    // Type mapping to color
    const getColor = () => {
        switch (type) {
            case 'solid': return '#00FFFF' // Cyan
            case 'dotted': return '#505050' // Dim grey
            case 'warp': return '#FF00FF' // Magenta (Active path)
            default: return '#FFFFFF'
        }
    }

    const color = getColor()
    const isSolid = type !== 'dotted'

    return (
        <Line
            points={[start, end]}
            color={color}
            lineWidth={isSolid ? 1.5 : 1}
            opacity={isSolid ? 0.4 : 0.2}
            transparent
            dashed={!isSolid}
            dashScale={2}
            dashSize={1}
            gapSize={1}
            toneMapped={false} // Crucial for Bloom! Allows colors > 1.0 to glow
        />
    )
}
