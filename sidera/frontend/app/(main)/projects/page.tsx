'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

const API_BASE = 'http://localhost:3001'

export default function ProjectList() {
  const [projects, setProjects] = useState<any[]>([])
  const [title, setTitle] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/projects`)
      .then(res => res.json())
      .then(setProjects)
  }, [])

  const handleCreate = async () => {
    if (!title) return
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    const newProject = await res.json()
    setProjects([newProject, ...projects])
    setTitle('')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Sidera <span className="text-sm font-normal text-slate-400">Personal Universe</span></h1>
          <Link href="/atlas">
            <Button variant="outline">Open Atlas (Universe View)</Button>
          </Link>
        </div>

        <div className="flex gap-2 mb-8 p-4 bg-slate-900 rounded border border-slate-800">
          <input
            className="bg-transparent border-none text-white focus:ring-0 flex-1 outline-none"
            placeholder="New Project Title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Button onClick={handleCreate}>Create Star Map</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="bg-slate-900 border-slate-800 hover:border-cyan-500 transition-colors cursor-pointer group">
                <CardHeader>
                  <div className="flex justify-between">
                    <CardTitle className="text-xl group-hover:text-cyan-400">{p.title}</CardTitle>
                    <span className="text-xs text-slate-500">{format(new Date(p.updatedAt), 'MMM d, yyyy')}</span>
                  </div>
                  <CardDescription className="text-slate-400">
                    Stars: ?
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div >
  )
}
