const API_BASE = 'http://localhost:3001';

export async function fetchProject(id: string) {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Failed to fetch project');
  return res.json();
}

export async function createTurn(projectId: string, userText: string, parentTurnId?: string) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/turns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText, parentTurnId })
  });
  if (!res.ok) throw new Error('Failed to create turn');
  return res.json();
}

export async function saveSnapshot(projectId: string, title: string, graphJson: any) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, graphJson })
  })
  return res.json()
}

export async function replaceTurn(id: string, reason?: string) {
  const res = await fetch(`${API_BASE}/api/turns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isReplaced: true, replacedReason: reason })
  })
  return res.json()
}

export function getStreamUrl(turnId: string) {
  return `${API_BASE}/api/turns/${turnId}/stream`;
}
