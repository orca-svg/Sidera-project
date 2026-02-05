import * as THREE from 'three'

// Global reference to the Three.js state (set from Universe component)
let threeState = null

/**
 * Set the Three.js state reference from the Universe component
 * This allows external components to access the camera and renderer
 */
export function setThreeState(state) {
  threeState = state
  console.log('[SkeletonCapture] Three.js state registered')
}

/**
 * Get the current Three.js state
 */
export function getThreeState() {
  return threeState
}

/**
 * Capture the current 3D constellation view as a skeleton image for AI generation
 * Renders nodes as white glowing points and edges as white lines on black background
 * Uses the current camera view from the Three.js scene
 * 
 * @param {Array} nodes - Array of node objects with position
 * @param {Array} edges - Array of edge objects with source and target
 * @param {number} width - Output image width (default 1024)
 * @param {number} height - Output image height (default 1024)
 * @returns {string} Base64 encoded PNG image
 */
export function captureConstellationSkeleton(nodes, edges, width = 1024, height = 1024) {
  if (!threeState?.camera) {
    console.warn('[SkeletonCapture] Three.js state not available, using fallback 2D capture')
    return null
  }

  if (!nodes || nodes.length === 0) {
    console.warn('[SkeletonCapture] No nodes provided')
    return null
  }

  const { camera } = threeState

  // Create offscreen renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  })
  renderer.setSize(width, height)
  renderer.setClearColor(0x000000, 1) // Black background

  // Create a separate scene for skeleton rendering
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  // Clone the camera to avoid modifying the original
  // Update camera aspect ratio for the capture resolution
  const skeletonCamera = camera.clone()
  skeletonCamera.aspect = width / height
  skeletonCamera.updateProjectionMatrix()

  // Build node position map
  const nodeMap = new Map()
  nodes.forEach(node => {
    const id = node.id?.toString() || node._id?.toString()
    const pos = node.position
    const position = new THREE.Vector3(
      Array.isArray(pos) ? pos[0] : (pos?.x ?? 0),
      Array.isArray(pos) ? pos[1] : (pos?.y ?? 0),
      Array.isArray(pos) ? pos[2] : (pos?.z ?? 0)
    )
    nodeMap.set(id, position)
  })

  // Create edge lines (white)
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 2,
    transparent: false
  })

  edges.forEach(edge => {
    const sourceId = edge.source?.toString()
    const targetId = edge.target?.toString()
    const sourcePos = nodeMap.get(sourceId)
    const targetPos = nodeMap.get(targetId)

    if (sourcePos && targetPos) {
      const geometry = new THREE.BufferGeometry().setFromPoints([sourcePos, targetPos])
      const line = new THREE.Line(geometry, lineMaterial)
      scene.add(line)
    }
  })

  // Create node spheres (white with glow effect)
  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false
  })

  // Outer glow material (dimmer)
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.6
  })

  nodeMap.forEach((position, id) => {
    // Outer glow
    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16)
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
    glowMesh.position.copy(position)
    scene.add(glowMesh)

    // Inner bright core
    const coreGeometry = new THREE.SphereGeometry(0.2, 16, 16)
    const coreMesh = new THREE.Mesh(coreGeometry, nodeMaterial)
    coreMesh.position.copy(position)
    scene.add(coreMesh)
  })

  // Render the scene
  renderer.render(scene, skeletonCamera)

  // Capture as base64 PNG
  const dataUrl = renderer.domElement.toDataURL('image/png')

  // Cleanup
  renderer.dispose()
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose()
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose())
      } else {
        object.material.dispose()
      }
    }
  })

  console.log('[SkeletonCapture] Generated skeleton image from 3D camera view')
  return dataUrl
}
