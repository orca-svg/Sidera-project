import { useRef, useLayoutEffect } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

export function Constellation({ start, end, type }) {
    const lineRef = useRef()

    // Properties based on type
    const getLineProps = () => {
        switch (type) {
            case 'solid': return { color: '#FFFFFF', opacity: 0.6, dash: false }
            case 'dashed': return { color: '#8899AA', opacity: 0.3, dash: true } // Recall Link
            case 'warp': return { color: '#00FFFF', opacity: 0.8, dash: false } // Cyan warp
            default: return { color: '#FFFFFF', opacity: 0.5, dash: false }
        }
    }

    const { color, opacity, dash } = getLineProps()

    return (
        <Line
            points={[start, end]}
            color={color}
            lineWidth={1}
            opacity={opacity}
            transparent
            dashed={dash}
            dashScale={dash ? 2 : 1}
            dashSize={dash ? 1 : 0}
            gapSize={dash ? 0.5 : 0}
        />
    )
}
