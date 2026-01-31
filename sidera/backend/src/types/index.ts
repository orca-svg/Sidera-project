
export interface CreateTurnBody {
  parentTurnId?: string
  userText: string
}

export interface UpdateTurnBody {
  pinned?: boolean
  summary?: string
  tags?: string[]
}

export interface CreateSnapshotBody {
  title: string
  graphJson: any
}

export interface DeterministicCoordInput {
  projectId: string
  parentTurnId: string | null
  childIndex: number
}
