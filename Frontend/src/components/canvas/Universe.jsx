import { useRef, useEffect, useMemo, useCallback, Suspense, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Stars, useTexture, Sphere, MeshDistortMaterial, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../../store/useStore'
import { useEventListener } from '../../hooks/useEventListener'
import { InteractiveConstellation } from './InteractiveConstellation'
import { Star } from './Star'
import { Constellation } from './Constellation'
import { WarpField } from './WarpField'
import * as THREE from 'three'

// --- Completed Constellation Backgrounds ---
// Hash function to deterministically place constellations in 3D space
function hashId(id) {
    let h = 0
    for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h) + id.charCodeAt(i)
        h |= 0
    }
    return Math.abs(h) / 2147483647
}

// Mini star for background constellation - smaller and dimmer
function BackgroundStar({ position, importance }) {
    // Smaller sizes for background
    const size = 0.08 + (importance ?? 2) * 0.03

    // Config based on importance
    const config = importance >= 5 ? { color: '#FFD700', emissive: '#FFaa00', distort: 0.4, speed: 2 } :
        importance >= 4 ? { color: '#00FFFF', emissive: '#0088FF', distort: 0.3, speed: 1.5 } :
            { color: '#5566AA', emissive: '#223355', distort: 0, speed: 0 }

    return (
        <group position={position}>
            {config.distort > 0 ? (
                <Sphere args={[size, 16, 16]}>
                    <MeshDistortMaterial
                        color={config.color}
                        emissive={config.emissive}
                        emissiveIntensity={2}
                        roughness={0.1}
                        metalness={0.8}
                        distort={config.distort}
                        speed={config.speed}
                        transparent
                        opacity={0.8}
                    />
                </Sphere>
            ) : (
                <mesh>
                    <sphereGeometry args={[size, 8, 8]} />
                    <meshStandardMaterial
                        color={config.color}
                        emissive={config.emissive}
                        emissiveIntensity={1}
                        transparent
                        opacity={0.6}
                    />
                </mesh>
            )}
        </group>
    )
}

// Mini edge for background constellation - very subtle
function BackgroundEdge({ start, end, type }) {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)]
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)

    // Explicit edges slightly more visible
    const color = type === 'explicit' ? '#336688' : '#223344'
    const opacity = type === 'explicit' ? 0.25 : 0.12

    return (
        <line geometry={lineGeometry}>
            <lineBasicMaterial color={color} transparent opacity={opacity} />
        </line>
    )
}

// Single background constellation (positioned and scaled)
function BackgroundConstellation({ constellation, position, scale }) {
    const { nodes, edges } = constellation
    const groupRef = useRef()

    // 1. Face the center (0,0,0)
    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.lookAt(0, 0, 0)
        }
    })

    // Create node map for edge lookup
    const nodeMap = new Map(nodes.map(n => [n.id.toString(), n]))

    // Convert position object {x,y,z} to local array [x,y,z] scaled
    const getLocalPosition = (pos) => {
        if (!pos) return [0, 0, 0]
        const x = Array.isArray(pos) ? pos[0] : (pos.x ?? 0)
        const y = Array.isArray(pos) ? pos[1] : (pos.y ?? 0)
        const z = Array.isArray(pos) ? pos[2] : (pos.z ?? 0)
        return [
            x * scale,
            y * scale,
            z * scale
        ]
    }

    return (
        <group ref={groupRef} position={position}>
            {/* Render edges first (behind stars) */}
            {edges.map((edge, i) => {
                const sourceNode = nodeMap.get(edge.source?.toString())
                const targetNode = nodeMap.get(edge.target?.toString())
                if (!sourceNode || !targetNode) return null
                return (
                    <BackgroundEdge
                        key={`e-${i}`}
                        start={getLocalPosition(sourceNode.position)}
                        end={getLocalPosition(targetNode.position)}
                        type={edge.type}
                    />
                )
            })}

            {/* Render stars */}
            {nodes.map((node, i) => (
                <BackgroundStar
                    key={`n-${i}`}
                    position={getLocalPosition(node.position)}
                    importance={node.importance}
                />
            ))}
        </group>
    )
}

// --- Observatory View Component ---
function ObservatoryView() {
    const { completedImages, viewMode, observatoryHoveredConstellation,
        observatoryFocusedConstellation, setObservatoryHoveredConstellation,
        setObservatoryFocusedConstellation } = useStore()

    if (viewMode !== 'observatory') return null

    const toShow = completedImages.filter(item => item.nodes?.length > 0)

    // Celestial Sphere Layout (Massive Telescope Scale)
    const calculatePosition = (index, total) => {
        // Fibonacci Sphere Distribution
        const phi = Math.acos(1 - 2 * (index + 0.5) / total)
        const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5)

        const radius = 80

        return [
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        ]
    }

    if (toShow.length === 0) {
        return (
            <Html center>
                <div className="text-center text-gray-500 pointer-events-none select-none">
                    <p className="text-lg">No completed star maps found</p>
                    <p className="text-sm opacity-60">Complete a conversation to add it to the observatory</p>
                </div>
            </Html>
        )
    }

    return (
        <group>
            {toShow.map((item, index) => (
                <InteractiveConstellation
                    key={item.projectId}
                    constellation={item}
                    offset={calculatePosition(index, toShow.length)}
                    isHovered={observatoryHoveredConstellation === item.projectId}
                    isFocused={observatoryFocusedConstellation?.projectId === item.projectId}
                    onHover={setObservatoryHoveredConstellation}
                    onClick={setObservatoryFocusedConstellation}
                />
            ))}
        </group>
    )
}

// Container for all completed constellation backgrounds
function CompletedConstellationBackgrounds() {
    const completedImages = useStore(state => state.completedImages)
    const activeProjectId = useStore(state => state.activeProjectId)
    const viewMode = useStore(state => state.viewMode)

    // Hide in chat mode AND observatory mode (Observatory has its own view)
    if (viewMode === 'chat' || viewMode === 'observatory') return null

    // Filter: has nodes AND not the current project
    const toShow = completedImages.filter(item =>
        item.nodes?.length > 0 &&
        item.projectId.toString() !== activeProjectId?.toString()
    )

    if (toShow.length === 0) return null

    return (
        <>
            {toShow.map((item, index) => {
                const h = hashId(item.projectId.toString())
                const h2 = (h * 7.3) % 1
                const h3 = (h * 13.7) % 1

                // Much wider distribution: X ±80, Y ±40, Z -60 ~ -120
                const offset = [
                    (h * 2 - 1) * 80,
                    (h2 * 2 - 1) * 40,
                    -60 - h3 * 60
                ]

                // Scale based on distance (farther = smaller for perspective)
                const distanceFactor = (Math.abs(offset[2]) - 60) / 60 + 1
                const scale = 0.35 / distanceFactor

                return (
                    <BackgroundConstellation
                        key={item.projectId}
                        constellation={item}
                        position={offset} // Changed prop name to position
                        scale={scale}
                    />
                )
            })}
        </>
    )
}

function InteractiveBackground({ children }) {
    const ref = useRef()

    const mouseRef = useRef({ x: 0, y: 0 })

    // Optimized: Use custom hook for event listener management
    useEventListener('mousemove', (event) => {
        // Normalize mouse position (-1 to 1)
        mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1
        mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    })

    const { viewMode } = useStore() // Get viewMode
    const observatoryFocusedConstellation = useStore(state => state.observatoryFocusedConstellation)
    const isFocused = !!observatoryFocusedConstellation

    useFrame((state) => {
        if (ref.current) {
            // Parallax Logic:
            // 1. In Telescope Mode (!isFocused): Enable Parallax (Mouse Rotation)
            // 2. In Inspection Mode (isFocused): Disable Parallax (Lerp to 0) -> Pure Orbit
            if (isFocused) {
                ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.05)
                ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, 0, 0.05)
            } else {
                const x = mouseRef.current.x * 0.2
                const y = mouseRef.current.y * 0.2

                ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, x, 0.05)
                ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -y, 0.05)
            }
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

// Background layer for the active project's Mythical Image
function MythicalBackgroundLayer() {
    const { activeProjectId, projects, viewMode, nodes } = useStore()
    const meshRef = useRef()

    // 1. Get current project image
    const currentProject = projects.find(p => p.id === activeProjectId)
    const imageUrl = currentProject?.constellationImageUrl

    // 2. Calculate constellation bounding box
    const { center, size } = useMemo(() => {
        if (!nodes || nodes.length === 0) return { center: [0, 0, 0], size: 20 }

        const positions = nodes.map(n => n.position || [0, 0, 0])
        const xs = positions.map(p => p[0])
        const ys = positions.map(p => p[1])
        const zs = positions.map(p => p[2])

        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        const minZ = Math.min(...zs), maxZ = Math.max(...zs)

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const centerZ = (minZ + maxZ) / 2

        // Max dimension determines size
        const rangeX = maxX - minX
        const rangeY = maxY - minY
        const maxRange = Math.max(rangeX, rangeY, 10) // Minimum 10 units

        return {
            center: [centerX, centerY, centerZ], // Centered exactly
            size: maxRange * 1.5
        }
    }, [nodes])

    // 3. Texture loading
    const [texture, setTexture] = useState(null)
    useEffect(() => {
        if (!imageUrl) {
            setTexture(null)
            return
        }
        const loader = new THREE.TextureLoader()
        loader.load(imageUrl, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace
            setTexture(tex)
        })
    }, [imageUrl])

    // Only show in constellation mode for completed projects
    if (!texture || viewMode !== 'constellation' || currentProject?.status !== 'completed') return null

    return (
        <mesh ref={meshRef} position={center} renderOrder={-1}>
            <planeGeometry args={[size, size]} />
            <shaderMaterial
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
                uniforms={{
                    uTexture: { value: texture },
                    uThreshold: { value: 0.1 },
                    uSmoothness: { value: 0.2 },
                    uOpacity: { value: 0.4 }
                }}
                vertexShader={`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    uniform sampler2D uTexture;
                    uniform float uThreshold;
                    uniform float uSmoothness;
                    uniform float uOpacity;
                    varying vec2 vUv;

                    void main() {
                        vec4 texColor = texture2D(uTexture, vUv);
                        float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
                        float alpha = smoothstep(uThreshold, uThreshold + uSmoothness, luminance);
                        gl_FragColor = vec4(texColor.rgb, alpha * uOpacity);
                    }
                `}
            />
        </mesh>
    )
}

// --- Observatory Camera Controller ---
// 반드시 Universe 외부에 정의해야 함.
// 내부 정의 시 Universe 매 re-render마다 컴포넌트 타입이 바뀌어
// React가 unmount/remount를 반복하여 useRef 상태가 초기화됨.
function ObservatoryCameraController({ controlsRef }) {
    const { viewMode, telescopeZoom, setTelescopeZoom, setObservatoryFocusedConstellation } = useStore()
    const observatoryFocusedConstellation = useStore(state => state.observatoryFocusedConstellation)
    const isFocused = !!observatoryFocusedConstellation
    const wasFocused = useRef(false)
    const lastFocusedId = useRef(null)

    const cameraAnimationRef = useRef({
        isAnimating: false,
        startPos: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
        startLook: new THREE.Vector3(),
        targetLook: new THREE.Vector3(),
        progress: 0
    })

    // Wheel: FOV Zoom은 망원경 모드에서만
    useEventListener('wheel', (e) => {
        if (viewMode === 'observatory' && !isFocused) {
            const zoomSpeed = 0.05
            let newZoom = useStore.getState().telescopeZoom + e.deltaY * zoomSpeed
            newZoom = Math.max(25, Math.min(75, newZoom))
            setTelescopeZoom(newZoom)
        }
    })

    // ESC: 포커스 모드 해제
    useEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewMode === 'observatory' && isFocused) {
            setObservatoryFocusedConstellation(null)
        }
    })

    // 전이 로직
    useEffect(() => {
        if (viewMode !== 'observatory' || !controlsRef.current) return

        if (isFocused) {
            // 같은 별자리에 대한 중복 트리거 방지
            if (observatoryFocusedConstellation?.projectId === lastFocusedId.current) return
            lastFocusedId.current = observatoryFocusedConstellation?.projectId

            const [tx, ty, tz] = observatoryFocusedConstellation.position
            // 별자리 방향 단위 벡터 × approachRadius → 구 내부 카메라 위치
            const dir = new THREE.Vector3(tx, ty, tz).normalize()
            const approachRadius = 60 // 원점에서의 거리 (구 반지름 80 내)

            // 현재 카메라 상태 캡처
            controlsRef.current.getPosition(cameraAnimationRef.current.startPos)
            controlsRef.current.getTarget(cameraAnimationRef.current.startLook)

            // 카메라: 별자리 방향으로 10유니트 안쪽에 배치 → 별자리(타겟)를 바라봄
            const closeRadius = 70 // 구 반지름 80 - 10 (안쪽)
            cameraAnimationRef.current.targetPos.set(dir.x * closeRadius, dir.y * closeRadius, dir.z * closeRadius)
            cameraAnimationRef.current.targetLook.set(tx, ty, tz)
            cameraAnimationRef.current.progress = 0
            cameraAnimationRef.current.isAnimating = true

            wasFocused.current = true
        } else {
            lastFocusedId.current = null

            if (wasFocused.current) {
                // 현재 카메라 상태에서 복귀 타겟까지 부드럽게 이동
                controlsRef.current.getPosition(cameraAnimationRef.current.startPos)
                controlsRef.current.getTarget(cameraAnimationRef.current.startLook)

                cameraAnimationRef.current.targetPos.set(0, 0, 0)
                cameraAnimationRef.current.targetLook.set(0, 0, 50)
                cameraAnimationRef.current.progress = 0
                cameraAnimationRef.current.isAnimating = true

                setTelescopeZoom(60)
                wasFocused.current = false
            }
        }
    }, [isFocused, observatoryFocusedConstellation, viewMode, controlsRef])

    useFrame((state, delta) => {
        // 1. FOV 로직
        if (viewMode === 'observatory') {
            if (isFocused) {
                state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 60, 0.1)
            } else {
                state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, telescopeZoom, 0.1)
                if (controlsRef.current) {
                    const sensitivityRatio = state.camera.fov / 75
                    controlsRef.current.azimuthRotateSpeed = -0.5 * sensitivityRatio
                    controlsRef.current.polarRotateSpeed = -0.5 * sensitivityRatio
                }
            }
            state.camera.updateProjectionMatrix()
        } else if (Math.abs(state.camera.fov - 60) > 0.1) {
            state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 60, 0.1)
            state.camera.updateProjectionMatrix()
        }

        // 2. Linear Camera Interpolation
        const anim = cameraAnimationRef.current
        if (anim.isAnimating && controlsRef.current) {
            anim.progress += delta / 0.8

            if (anim.progress >= 1) {
                anim.isAnimating = false
                controlsRef.current.setLookAt(
                    anim.targetPos.x, anim.targetPos.y, anim.targetPos.z,
                    anim.targetLook.x, anim.targetLook.y, anim.targetLook.z,
                    false
                )
                return
            }

            const t = THREE.MathUtils.smoothstep(anim.progress, 0, 1)
            const pos = new THREE.Vector3().lerpVectors(anim.startPos, anim.targetPos, t)
            const look = new THREE.Vector3().lerpVectors(anim.startLook, anim.targetLook, t)

            controlsRef.current.setLookAt(
                pos.x, pos.y, pos.z,
                look.x, look.y, look.z,
                false
            )
        }
    })

    return null
}

export function Universe({ isInteractive = true }) {
    // Optimized: Use selective Zustand selectors to prevent unnecessary re-renders
    const nodes = useStore(state => state.nodes)
    const edges = useStore(state => state.edges)
    const activeNode = useStore(state => state.activeNode)
    const setActiveNode = useStore(state => state.setActiveNode)
    const viewMode = useStore(state => state.viewMode)
    const isWarping = useStore(state => state.isWarping)
    const setIsWarping = useStore(state => state.setIsWarping)
    const focusTarget = useStore(state => state.focusTarget)
    const settings = useStore(state => state.settings)
    const cameraControlsRef = useRef()
    const wasFocused = useRef(false) // Track if we were previously focused to allow smooth return

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

    const observatoryFocusedConstellation = useStore(state => state.observatoryFocusedConstellation)
    const isFocused = !!observatoryFocusedConstellation

    // Camera Navigation Logic Update
    useEffect(() => {
        if (!cameraControlsRef.current) return

        if (viewMode === 'constellation' && focusTarget) {
            cameraControlsRef.current.minDistance = 2
            cameraControlsRef.current.maxDistance = 300

            const [x, y, z] = focusTarget.position
            cameraControlsRef.current.setLookAt(
                x, y, z + 8, // Position
                x, y, z,     // Target
                true         // Smooth Transition
            )
        }
    }, [focusTarget, viewMode])

    // Cinematic Warp Logic Update
    useEffect(() => {
        if (!cameraControlsRef.current) return

        // 1. Trigger Warp State
        setIsWarping(true)

        // 2. Camera Movement
        if (viewMode === 'constellation') {
            // Warp INTO the universe (Detailed View)
            cameraControlsRef.current.setLookAt(0, 0, 40, 0, 0, 0, true)
        } else if (viewMode === 'observatory') {
            // Warp into observatory center (0,0,0)
            // INSTANT WARP (User Request): Transition = false
            cameraControlsRef.current.setLookAt(0, 0, 0, 0, 0, 50, false)
        } else {
            // Warp OUT to chat (Deep Space View)
            cameraControlsRef.current.setLookAt(0, 0, 120, 0, 0, 0, true)
        }

        // 3. End Warp (after animation duration)
        const timer = setTimeout(() => {
            setIsWarping(false)
        }, 300)

        return () => clearTimeout(timer)
    }, [viewMode, setIsWarping])

    const saveViewState = useStore(state => state.saveViewState)
    const saveTimeoutRef = useRef(null)

    const handleCameraChange = () => {
        if (!cameraControlsRef.current) return

        // Debounce Save (1s)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        saveTimeoutRef.current = setTimeout(() => {
            if (!cameraControlsRef.current) return

            const pos = new THREE.Vector3()
            const target = new THREE.Vector3()
            cameraControlsRef.current.getPosition(pos)
            cameraControlsRef.current.getTarget(target)

            // Calculate distance as 'zoom' approximation
            const distance = pos.distanceTo(target)

            saveViewState({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                zoom: distance
            })
            // console.log("View State Saved", pos, distance)
        }, 1000)
    }

    return (
        <>
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
                    <Stars radius={150} depth={50} count={visualConfig.starCount} factor={4} saturation={0} fade speed={1} />

                    {/* Layer 1.2: Active Mythical Background (Parallax ControlNet Image) */}
                    <MythicalBackgroundLayer />

                    {/* Layer 1.5: Completed Constellation Background Images */}
                    <CompletedConstellationBackgrounds />

                    {/* Layer 1.6: Observatory Mode View */}
                    <ObservatoryView />

                    {/* Logic Controller for Telescope Zoom (Inside Canvas) */}
                    {/* Logic Controller for Telescope Zoom & Camera Transitions (Inside Canvas) */}
                    <ObservatoryCameraController controlsRef={cameraControlsRef} />


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
                        {/* Logic: Show edges if warping to 'chat' (so they scale down with stars) OR if not warping (stable) */}
                        {(viewMode === 'chat' || !isWarping) && edges.map((edge) => {
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
                    // DYNAMIC CAMERA CONFIG (Dual State: Telescope vs Inspection)

                    // Telescope: 카메라 고정(0.001) / Focus: 원점 기준 구 내부 제한(10~75)
                    minDistance={viewMode === 'observatory' ? (isFocused ? 5 : 0.001) : 2}
                    maxDistance={viewMode === 'observatory' ? (isFocused ? 20 : 400) : 300}

                    // Telescope Mode: Inverted Rotation / Inspection: Standard Orbit
                    azimuthRotateSpeed={viewMode === 'observatory' ? (isFocused ? 1.0 : -0.5) : 1.0}
                    polarRotateSpeed={viewMode === 'observatory' ? (isFocused ? 1.0 : -0.5) : 1.0}

                    // Telescope Mode: Disable Dolly (use FOV) / Inspection: Enable Dolly
                    dollySpeed={viewMode === 'observatory' ? (isFocused ? 1.0 : 0) : 0.5}
                    truckSpeed={viewMode === 'observatory' ? (isFocused ? 1.0 : 0) : 0.5}
                    zoomSpeed={viewMode === 'observatory' ? (isFocused ? 1.0 : 0) : 1.0}

                    smoothTime={0.8}
                    onChange={handleCameraChange}
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
