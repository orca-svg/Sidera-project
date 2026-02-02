import { useRef } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

export function Constellation({ start, end, type }) {
    // Cyberpunk Energy Line
    // High opacity but thin, with bloom it will glow.

    // Type mapping to color & style
    const getStyle = () => {
        switch (type) {
            case 'temporal': return { color: '#445566', opacity: 0.2, dash: true, lineWidth: 1 }      // Subtle Backbone
            case 'explicit': return { color: '#00FFFF', opacity: 0.8, dash: false, lineWidth: 2 }     // Strong Thread (Cyan Glow)
            case 'implicit': return { color: '#88AAFF', opacity: 0.3, dash: true, lineWidth: 1 }     // Contextual Link (Pale Blue)
            case 'solid': return { color: '#00FFFF', opacity: 0.6, dash: false, lineWidth: 1.5 }      // Legacy
            case 'dashed': return { color: '#8899AA', opacity: 0.3, dash: true, lineWidth: 1 }        // Legacy
            default: return { color: '#FFFFFF', opacity: 0.2, dash: false, lineWidth: 1 }
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
