import { create } from 'zustand'

interface AppState {
  currentProjectId: string | null
  setProjectId: (id: string | null) => void

  // Selection
  activeTurnId: string | null
  setActiveTurnId: (id: string | null) => void

  // Camera / View
  cameraTarget: [number, number, number] | null
  setCameraTarget: (target: [number, number, number] | null) => void

  // Data (Optional cache/optimistic)
  turns: any[]
  setTurns: (turns: any[]) => void
  addTurn: (turn: any) => void
  updateTurn: (id: string, updates: any) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentProjectId: null,
  setProjectId: (id) => set({ currentProjectId: id }),

  activeTurnId: null,
  setActiveTurnId: (id) => set({ activeTurnId: id }),

  cameraTarget: null,
  setCameraTarget: (target) => set({ cameraTarget: target }),

  turns: [],
  setTurns: (turns) => set({ turns }),
  addTurn: (turn) => set((state) => ({ turns: [...state.turns, turn] })),
  updateTurn: (id, updates) => set((state) => ({
    turns: state.turns.map(t => t.id === id ? { ...t, ...updates } : t)
  }))
}))
