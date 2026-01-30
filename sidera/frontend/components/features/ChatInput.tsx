import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createTurn, getStreamUrl } from '@/lib/api'
import { EventSourcePolyfill } from 'event-source-polyfill'
import { useAppStore } from '@/store'

interface ChatInputProps {
  projectId: string
  onTurnCreated: (turn: any) => void
  onStreamUpdate: (id: string, chunk: string) => void
  onStreamEnd: (id: string, fullText: string, type: any) => void
}

export function ChatInput({ projectId, onTurnCreated, onStreamUpdate, onStreamEnd }: ChatInputProps) {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { activeTurnId } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || isSending) return

    setIsSending(true)
    const currentText = text
    setText('')

    try {
      const turn = await createTurn(projectId, currentText, activeTurnId || undefined)
      onTurnCreated(turn)

      const url = getStreamUrl(turn.id)
      const evtSource = new EventSourcePolyfill(url, {}) as EventSource

      evtSource.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data)
        onStreamUpdate(turn.id, data.chunk)
      }

      evtSource.addEventListener('finalize', (e: any) => {
        const data = JSON.parse(e.data)
        onStreamEnd(turn.id, data.fullText, data.type)
        evtSource.close()
        setIsSending(false)
      })

      evtSource.onerror = (err: any) => {
        console.error('SSE Error:', err)
        evtSource.close()
        setIsSending(false)
      }

    } catch (error) {
      console.error(error)
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-slate-900 border-t border-slate-800">
      <Input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a message to the stars..."
        disabled={isSending}
        className="bg-slate-800 border-slate-700 text-white"
      />
      <Button type="submit" disabled={isSending}>
        {isSending ? 'Sending...' : 'Send'}
      </Button>
    </form>
  )
}
