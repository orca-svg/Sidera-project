import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'

/**
 * EndConversationModal - Modal for completing a constellation
 * 3-stage flow: input → generating → success
 */
export function EndConversationModal({ isOpen, onClose, projectId, nodes, edges, onComplete }) {
  const [name, setName] = useState('')
  const [stage, setStage] = useState('input') // 'input' | 'generating' | 'success'
  const [resultImage, setResultImage] = useState(null)
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)

  // Draw constellation preview
  useEffect(() => {
    if (!canvasRef.current || !nodes || nodes.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    if (nodes.length === 0) return

    // Find bounds
    const positions = nodes.map(n => n.position || [0, 0])
    const xs = positions.map(p => p[0])
    const ys = positions.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const padding = 30

    // Normalize function (Y축 반전: 3D Y+ = 위, Canvas Y+ = 아래)
    const normalize = (pos) => [
      padding + ((pos[0] - minX) / rangeX) * (width - 2 * padding),
      padding + (1 - (pos[1] - minY) / rangeY) * (height - 2 * padding)
    ]

    // Draw edges first (타입별 색상: Constellation.jsx와 동일)
    const edgeStyles = {
      temporal:  { color: 'rgba(68, 85, 102, 0.5)',  dash: [4, 3] },
      explicit:  { color: 'rgba(0, 255, 255, 0.7)',  dash: []     },
      implicit:  { color: 'rgba(136, 170, 255, 0.45)', dash: [4, 3] }
    }
    ctx.lineWidth = 1
    edges?.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      if (sourceNode && targetNode) {
        const style = edgeStyles[edge.type] || edgeStyles.implicit
        ctx.strokeStyle = style.color
        ctx.setLineDash(style.dash)
        const [sx, sy] = normalize(sourceNode.position || [0, 0])
        const [tx, ty] = normalize(targetNode.position || [0, 0])
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(tx, ty)
        ctx.stroke()
      }
    })
    ctx.setLineDash([])

    // Draw nodes (stars)
    const importanceColors = {
      5: '#FFD700',
      4: '#00FFFF',
      3: '#88AAFF',
      2: '#FFFFFF',
      1: '#888888'
    }

    nodes.forEach(node => {
      const [x, y] = normalize(node.position || [0, 0])
      const importance = node.importance || 3
      const color = importanceColors[importance] || '#FFFFFF'
      const radius = 2 + importance

      // Glow effect
      ctx.beginPath()
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2)
      ctx.fill()

      // Core
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [nodes, edges, isOpen])

  const handleComplete = async () => {
    if (!name.trim()) return
    setStage('generating')
    setError(null)

    try {
      const result = await onComplete(name.trim())
      if (result.success) {
        setResultImage(result.imageUrl)
        setStage('success')
      } else {
        setError(result.error || 'Failed to complete constellation')
        setStage('input')
      }
    } catch (err) {
      setError(err.message)
      setStage('input')
    }
  }

  const handleClose = () => {
    setName('')
    setStage('input')
    setResultImage(null)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && stage !== 'generating' && handleClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-amber-400">✦</span>
            {stage === 'success' ? '별자리 완성!' : '이 별자리에 이름을 붙여주세요'}
          </h2>
          {stage !== 'generating' && (
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === 'input' && (
            <>
              {/* Constellation Preview */}
              <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={200}
                  className="w-full h-auto bg-black"
                />
              </div>

              {/* Name Input */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 우주의 여정"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleComplete()}
              />

              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleComplete}
                  disabled={!name.trim()}
                  className="flex-1 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <span>완성하기</span>
                  <span className="text-amber-400">✦</span>
                </button>
              </div>
            </>
          )}

          {stage === 'generating' && (
            <div className="py-12 text-center">
              <Loader2 size={48} className="mx-auto text-amber-400 animate-spin mb-4" />
              <p className="text-gray-300">별자리를 완성하고 있습니다...</p>
              <p className="text-sm text-gray-500 mt-2">이미지 생성에 시간이 걸릴 수 있습니다</p>
            </div>
          )}

          {stage === 'success' && (
            <div className="text-center">
              {resultImage ? (
                <img
                  src={resultImage}
                  alt={name}
                  className="w-full rounded-xl mb-4 border border-white/10"
                />
              ) : (
                <div className="py-8 mb-4 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-6xl mb-4">✦</p>
                  <p className="text-sm text-gray-400">
                    이미지 생성에 실패했지만<br />별자리는 완성되었습니다
                  </p>
                </div>
              )}

              <p className="text-xl font-semibold text-amber-300 mb-2">"{name}"</p>
              <p className="text-sm text-gray-400 mb-6">
                이 별자리는 이제 읽기 전용으로 보존됩니다
              </p>

              <button
                onClick={handleClose}
                className="px-8 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl transition-all"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
