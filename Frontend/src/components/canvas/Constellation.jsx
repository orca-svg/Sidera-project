import { useRef } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

export function Constellation({ start, end, type }) {
    // Cyberpunk Energy Line
    // High opacity but thin, with bloom it will glow.

    // Type mapping to color & style
    const getStyle = () => {
        switch (type) {
            case 'solid': return { color: '#00FFFF', opacity: 0.6, dash: false, lineWidth: 1.5 } // Cyan Flow (Dev Pulse)
            case 'dashed': return { color: '#8899AA', opacity: 0.3, dash: true, lineWidth: 1 }   // Recall (Current Logic)
            case 'warp': return { color: '#FF00FF', opacity: 0.8, dash: false, lineWidth: 2 }    // Magenta Active (Dev)
            default: return { color: '#FFFFFF', opacity: 0.4, dash: false, lineWidth: 1 }
        }
    }

    const { color, opacity, dash, lineWidth } = getStyle()

    return (
        <Line
            points={[start, end]}
            color={color}
            lineWidth={lineWidth}
            opacity={opacity}
            transparent
            dashed={dash}
            dashScale={2}
            dashSize={1}
            gapSize={1}
            toneMapped={false} // Crucial for Bloom! Allows colors > 1.0 to glow
        />
    )
}
