import { create } from 'zustand'
import client from '../api/client'

export const useStore = create((set, get) => ({
  // --- State ---
  projects: [],        // Sidebar Project List
  activeProjectId: null,

  nodes: [],           // Current Conversation Nodes (Stars)
  edges: [],           // Connections (optional visual)
  activeNode: null,    // Currently focused node (for camera comparison etc)

  isUniverseExpanded: false,
  viewMode: 'chat', // 'chat' | 'constellation'
  isLoading: false,
  isWarping: false, // Transition effect state
  error: null,

  // --- UI Actions ---
  toggleUniverse: () => set(state => ({ isUniverseExpanded: !state.isUniverseExpanded })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setIsWarping: (isWarping) => set({ isWarping }),

  // --- Async Actions ---

  // 1. Fetch Project List (Sidebar)
  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await client.get('/projects');
      // Map API response to UI format
      const projects = res.data.map(p => ({
        id: p._id,
        title: p.name,
        lastUpdated: p.updatedAt || p.createdAt
      }));
      // Sort by latest msg? typically backend does this, or we sort here
      projects.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

      set({ projects, isLoading: false });
    } catch (err) {
      console.error("[Store] fetchProjects Error:", err);
      set({ error: "Failed to load projects", isLoading: false });
    }
  },

  // 2. Create New Project (New Chat)
  createProject: async () => {
    const { projects, activeProjectId, nodes } = get();

    // Check if the latest project is already a fresh empty conversation
    // We strictly check if it's the *active* one and has no nodes to avoid assuming state of inactive projects
    if (projects.length > 0 && projects[0].title === 'New Conversation') {
      if (activeProjectId === projects[0].id && nodes.length === 0) {
        console.log("[Store] Reusing existing empty project");
        return; // Already in a new empty chat
      }
      // Optional: If we want to switch to the existing empty one instead of creating ANOTHER empty one?
      // Let's do that for better UX. Switch to it.
      get().setActiveProject(projects[0].id);
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await client.post('/projects', { name: "New Conversation" });
      const newProjectRaw = res.data;

      const newProject = {
        id: newProjectRaw._id,
        title: newProjectRaw.name,
        lastUpdated: newProjectRaw.createdAt
      };

      set(state => ({
        projects: [newProject, ...state.projects],
        activeProjectId: newProject.id,
        nodes: [],   // Clear current view
        edges: [],
        activeNode: null,
        isLoading: false
      }));
    } catch (err) {
      console.error("[Store] createProject Error:", err);
      set({ error: "Failed to create project", isLoading: false });
    }
  },

  // 3. Set Active Project & Load History (The "History Loading" Logic)
  setActiveProject: async (projectId) => {
    // 1. Immediate State Update (Clear current view)
    set({ activeProjectId: projectId, isLoading: true, error: null, activeNode: null, nodes: [] });

    try {
      // 2. Fetch Nodes for this Project
      const res = await client.get(`/nodes/${projectId}`);
      const fetchedNodes = res.data;

      // 3. Map DB format to Frontend format
      if (!Array.isArray(fetchedNodes)) {
        console.error("fetchedNodes is not an array:", fetchedNodes);
        throw new Error("Invalid response format");
      }

      const mappedNodes = fetchedNodes.map(n => ({
        id: n._id,
        projectId: n.projectId,
        question: n.question,
        answer: n.answer,
        keywords: n.keywords || [],
        importance: n.importance || 'Beta',
        topicSummary: n.topicSummary,
        // Safety check for position
        position: (n.position && typeof n.position.x === 'number')
          ? [n.position.x, n.position.y, n.position.z]
          : [0, 0, 0],
        createdAt: n.createdAt
      }));

      // 4. Update Store
      set({ nodes: mappedNodes, isLoading: false });

      console.log(`[Store] Loaded ${mappedNodes.length} nodes for project ${projectId}`);

    } catch (err) {
      console.error("[Store] setActiveProject Error:", err);
      set({ error: "Failed to load conversation history", isLoading: false });
    }
  },

  // 4. Send Message & Instant Title Update
  addNode: async (content) => {
    const { activeProjectId, nodes, activeNode } = get();

    // Auto-create project if missing
    if (!activeProjectId) {
      await get().createProject();
      // Retry after creation? createProject sets activeProjectId
      // We can continue with get().activeProjectId
    }
    const currentProjectId = get().activeProjectId;

    // Optimistic Update (Temp UI)
    const tempId = 'temp-' + Date.now();
    const tempNode = {
      id: tempId,
      question: content,
      answer: 'Thinking...',
      keywords: ['...'],
      position: [0, 0, 0], // Temp
      isPending: true
    };
    set({ nodes: [...nodes, tempNode], activeNode: tempId });

    try {
      // API Call
      const res = await client.post('/chat', {
        projectId: currentProjectId,
        message: content,
        parentNodeId: activeNode && !activeNode.startsWith('temp-') ? activeNode : null
      });

      const { node: savedNode, edge: savedEdge, projectTitle } = res.data;

      // Map Real Node
      const realNode = {
        ...savedNode,
        id: savedNode._id,
        position: [savedNode.position.x, savedNode.position.y, savedNode.position.z]
      };

      // 1. Replace Temp Node with Real Node
      const finalNodes = get().nodes.map(n => n.id === tempId ? realNode : n);

      // 2. Instant Title Update (Sidebar Sync) -- Robust Local Update
      let updatedProjects = get().projects;
      if (projectTitle) {
        console.log("🎨 [Store] Instant Title Update to:", projectTitle);
        // Map to a NEW array to ensure React re-render
        updatedProjects = updatedProjects.map(p => {
          if (p.id === currentProjectId) {
            return { ...p, title: projectTitle };
          }
          return p;
        });
      }

      set({
        nodes: finalNodes,
        activeNode: realNode.id,
        edges: savedEdge ? [...(get().edges || []), { ...savedEdge, id: savedEdge._id }] : get().edges,
        projects: updatedProjects
      });

    } catch (err) {
      console.error("[Store] addNode Error:", err);
      set(state => ({
        nodes: state.nodes.map(n =>
          n.id === tempId ? { ...n, answer: "Failed to get response.", isPending: false } : n
        )
      }));
    }
  },

  focusTarget: null, // { position: [x,y,z], id: string }

  // --- UI Actions ---
  toggleUniverse: () => set(state => ({ isUniverseExpanded: !state.isUniverseExpanded })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setIsWarping: (isWarping) => set({ isWarping }),

  // Camera Navigation
  flyToNode: (nodeId) => {
    const { nodes } = get();
    const target = nodes.find(n => n.id === nodeId);
    if (target) {
      // 1. Set Active Node (Highlight)
      set({ activeNode: nodeId });
      // 2. Set Focus Target (Trigger Camera Move)
      set({ focusTarget: { position: target.position, id: target.id } });
    }
  },

  setActiveNode: (id) => set({ activeNode: id }),

  // Initial App Load
  initializeProject: async () => {
    await get().fetchProjects();
    const { projects } = get();
    if (projects.length === 0) {
      await get().createProject();
    } else {
      // Load latest
      await get().setActiveProject(projects[0].id);
    }
  }
}))
