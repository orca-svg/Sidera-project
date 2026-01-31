import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store'
import { replaceTurn } from '@/lib/api'

interface NodeDetailPanelProps {
  turns: any[]
  onReplyHere: (turn: any) => void
}

export function NodeDetailPanel({ turns, onReplyHere }: NodeDetailPanelProps) {
  const { activeTurnId, setActiveTurnId } = useAppStore()
  const [replaceReason, setReplaceReason] = useState('')

  if (!activeTurnId) return null

  const turn = turns.find(t => t.id === activeTurnId)
  if (!turn) return null

  const handleReplace = async () => {
    if (!confirm('Replace this node? It will be visually ghosted.')) return
    await replaceTurn(turn.id, replaceReason || 'User replaced')
    // In real app, we would re-fetch or update store
    alert('Node Replaced (Reload to see effect)')
  }

  return (
    <Card className="w-80 h-full bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col rounded-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-mono text-cyan-400">Node {turn.id.slice(0, 4)}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setActiveTurnId(null)}>X</Button>
        </div>
        <div className="flex gap-2 mt-2">
          {turn.starType === 'ALPHA' && <Badge className="bg-yellow-500 text-black">ALPHA</Badge>}
          {turn.isReplaced && <Badge variant="destructive">REPLACED</Badge>}
          <Badge variant="outline">{turn.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-6">
          <div className="mb-4">
            <h4 className="text-xs text-slate-500 mb-1">USER</h4>
            <p className="text-sm bg-slate-800 p-2 rounded">{turn.roleUserText}</p>
          </div>
          <div>
            <h4 className="text-xs text-slate-500 mb-1">AI</h4>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{turn.roleAiText}</p>
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 p-4 border-t border-slate-800">
        <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={() => onReplyHere(turn)}>
          Reply Here (Branch)
        </Button>
        <Button variant="outline" className="w-full border-red-900 text-red-500 hover:bg-red-950" onClick={handleReplace}>
          Delete / Replace
        </Button>
      </CardFooter>
    </Card>
  )
}
