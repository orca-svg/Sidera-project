import { create } from 'zustand'

export const useStore = create((set, get) => ({
  nodes: [],
  edges: [],
  mode: 'formation',
  activeNode: null,
  projectId: null,

  // UI State
  isUniverseExpanded: false,
  toggleUniverse: () => set(state => ({ isUniverseExpanded: !state.isUniverseExpanded })),

  // Actions
  initializeProject: async () => {
    try {
      console.log("[useStore] initializeProject: sending request...");
      const res = await fetch('http://localhost:5001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Constellation' })
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const project = await res.json();
      console.log("[useStore] initialized project:", project._id);
      set({ projectId: project._id });
      return project._id;
    } catch (err) {
      console.error("Failed to init project", err);
      return null;
    }
  },

  resetProject: async () => {
    // Create new project and clear local state
    const id = await get().initializeProject();
    if (id) {
      set({ nodes: [], edges: [], activeNode: null });
    }
  },

  addNode: async (content) => {
    const { nodes, activeNode, projectId, initializeProject } = get()
    console.log("[useStore] addNode called with:", content);

    // 1. Optimistic Update: Add "Pending" Node IMMEDIATELY
    const tempId = 'temp-' + Date.now();
    const tempNode = {
      id: tempId,
      question: content,
      answer: 'Thinking...', // Temporary state
      keywords: ['...'],
      importance: 2,
      position: [0, 0, 0], // Default pos until calculated
      isPending: true
    };

    set({
      nodes: [...nodes, tempNode],
      activeNode: tempId
    });

    // 2. Ensure Project ID exists
    let currentProjectId = projectId;
    if (!currentProjectId) {
      console.log("[useStore] No projectId, initializing...");
      currentProjectId = await initializeProject();
      console.log("[useStore] New projectId:", currentProjectId);
    }

    if (!currentProjectId) {
      console.error("[useStore] Project initialization failed.");
      // Mark node as error
      set(state => ({
        nodes: state.nodes.map(n =>
          n.id === tempId ? { ...n, answer: "Error: Could not start project. Check backend connection.", isPending: false } : n
        )
      }));
      return;
    }

    // 3. Call Chat API
    try {
      console.log("[useStore] Calling Chat API...");
      const res = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId,
          message: content,
          parentNodeId: activeNode && !activeNode.startsWith('temp-') ? activeNode : null
        })
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log("[useStore] Chat API Response:", data);

      const formatNode = (n) => ({
        ...n,
        id: n._id,
        position: [n.position.x, n.position.y, n.position.z]
      });

      const newNode = formatNode(data.node);

      // 4. Replace Temp Node with Real Node
      const updatedNodes = get().nodes.map(n =>
        n.id === tempId ? newNode : n
      );

      let newEdges = [...get().edges];
      if (data.edge) {
        newEdges.push({
          id: data.edge._id,
          source: data.edge.source,
          target: data.edge.target,
          type: data.edge.type
        });
      }

      set({
        nodes: updatedNodes,
        edges: newEdges,
        activeNode: newNode.id,
      });

    } catch (err) {
      console.error("Chat API Error", err);
      set(state => ({
        nodes: state.nodes.map(n =>
          n.id === tempId ? { ...n, answer: "Error connecting to the stars.", isPending: false } : n
        )
      }));
    }
  },

  setActiveNode: (id) => set({ activeNode: id }),
}))
