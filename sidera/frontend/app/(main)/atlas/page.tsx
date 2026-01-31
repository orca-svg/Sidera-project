'use client'

import React, { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, Text, Billboard } from '@react-three/drei'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'

const API_BASE = 'http://localhost:3001'

// Basic type definition to traverse build
interface ProjectStarProps {
    project: any
    position: [number, number, number]
}

function ProjectStar({ project, position }: ProjectStarProps) {
    const router = useRouter()
    const [hovered, setHovered] = useState(false)

    return (
        <group position={position}>
            <mesh
                onClick={() => router.push(`/projects/${project.id}`)}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial
                    color={hovered ? "#00FFFF" : "white"}
                    emissive={hovered ? "#00FFFF" : "black"}
                    emissiveIntensity={hovered ? 1 : 0}
                />
            </mesh>
            <Billboard>
                <Text
                    position={[0, 0.8, 0]}
                    fontSize={0.5}
                    color="white"
                    anchorX="center"
                    anchorY="bottom"
                >
                    {project.title}
                </Text>
            </Billboard>
        </group >
    )
}

export default function AtlasPage() {
    const [projects, setProjects] = useState<any[]>([])

    useEffect(() => {
        fetch(`${API_BASE}/projects`)
            .then(res => res.json())
            .then(data => {
                const mapped = data.map((p: any, i: number) => {
                    const phi = Math.acos(-1 + (2 * i) / data.length);
                    const theta = Math.sqrt(data.length * Math.PI) * phi;
                    const r = 10;
                    return {
                        ...p,
                        pos: [
                            r * Math.cos(theta) * Math.sin(phi),
                            r * Math.sin(theta) * Math.sin(phi),
                            r * Math.cos(phi)
                        ]
                    }
                })
                setProjects(mapped)
            })
    }, [])

    return (
        <div className="h-screen w-screen bg-black">
            <div className="absolute top-4 left-4 z-10 text-white">
                <h1 className="text-2xl font-bold">The Atlas</h1>
                <p className="text-sm opacity-50">Explore different universes.</p>
            </div>

            <Canvas camera={{ position: [0, 0, 20] }}>
                <Stars />
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 10, 10]} />
                <OrbitControls autoRotate autoRotateSpeed={0.5} />

                {projects.map((p) => (
                    <ProjectStar key={p.id} project={p} position={p.pos} />
                ))}
            </Canvas>
        </div>
    )
}
