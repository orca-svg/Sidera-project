'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { fetchProject, saveSnapshot } from '@/lib/api'
import { useAppStore } from '@/store'
import { ChatInput } from '@/components/features/ChatInput'
import { NodeDetailPanel } from '@/components/features/NodeDetailPanel'
import { Button } from '@/components/ui/button'

const ConstellationViewer = dynamic(() => import('@/components/3d/ConstellationViewer'), { ssr: false })

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string

  const { turns, setTurns, addTurn, updateTurn, setProjectId, setActiveTurnId } = useAppStore()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    setProjectId(projectId)

    fetchProject(projectId).then(data => {
      setProject(data)
      setTurns(data.turns)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [projectId])

  const handleReplyHere = (turn: any) => {
    setActiveTurnId(turn.id)
  }

  const handleSaveSnapshot = async () => {
    const title = prompt("Snapshot Title:")
    if (!title) return

    const graphJson = {
      nodes: turns,
      edges: project?.edges,
      view: {
        cameraTarget: [0, 0, 0],
      }
    }

    await saveSnapshot(projectId, title, graphJson)
    alert('Snapshot Saved')
  }

  const handleExport = () => {
    window.open(`http://localhost:3001/projects/${projectId}/export`, '_blank')
  }

  if (loading) return <div className="text-white flex items-center justify-center h-screen bg-slate-950">Loading Project...</div>
  if (!project) return <div className="text-white">Project not found</div>

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      <div className="flex-1 relative flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/50 backdrop-blur z-10 flex items-center px-4 justify-between border-b border-white/10">
          <h1 className="text-white font-bold">{project.title}</h1>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleSaveSnapshot}>Save Snapshot</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>Export JSON</Button>
          </div>
        </div>

        <div className="flex-1">
          <ConstellationViewer
            turns={turns}
            edges={project.edges}
            onNodeClick={(t: any) => setActiveTurnId(t.id)}
          />
        </div>

        <div className="z-10">
          <ChatInput
            projectId={projectId}
            onTurnCreated={(turn: any) => {
              addTurn(turn)
            }}
            onStreamUpdate={(id: string, chunk: string) => {
              const t = turns.find(x => x.id === id)
              if (t) {
                updateTurn(id, { roleAiText: (t.roleAiText || '') + chunk })
              }
            }}
            onStreamEnd={(id: string, fullText: string, type: any) => {
              updateTurn(id, { status: 'DONE', roleAiText: fullText, starType: type })
            }}
          />
        </div>
      </div>

      <div className="z-20 h-full border-l border-slate-800 bg-slate-950">
        <NodeDetailPanel turns={turns} onReplyHere={handleReplyHere} />
      </div>
    </div>
  )
}
