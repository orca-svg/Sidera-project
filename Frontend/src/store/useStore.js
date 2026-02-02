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
  settings: {
    temperature: 0.7,
    maxTokens: 1000,
    visualDetail: 'high' // 'low' | 'high'
  },

  // --- UI Actions ---
  updateSettings: (newSettings) => set(state => ({ settings: { ...state.settings, ...newSettings } })),
  toggleUniverse: () => set(state => ({ isUniverseExpanded: !state.isUniverseExpanded })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setIsWarping: (isWarping) => set({ isWarping }),

  // --- Async Actions ---

  // --- User State ---
  user: null,
  setUser: (user) => {
    set({ user });
    // If user changes (e.g. login/logout), re-init
    if (user) {
      get().initializeProject();
      // If guest, ensure view mode is chat
      if (user.isGuest) {
        set({ viewMode: 'chat' });
      }
    } else {
      set({ projects: [], nodes: [], activeProjectId: null });
    }
  },

  // --- Async Actions ---

  // 1. Fetch Project List (Sidebar)
  fetchProjects: async () => {
    const { user } = get();
    if (user?.isGuest) return; // Guests have no persistent projects

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

  isCreating: false,

  // 2. Create New Project (New Chat)
  createProject: async () => {
    // 0. Prevents double-submission
    if (get().isCreating) return;

    const { projects, activeProjectId, nodes, user } = get();

    // Guest Mode Logic (From Remote)
    if (user?.isGuest) {
      set({
        activeProjectId: 'guest-session',
        nodes: [],
        edges: [],
        activeNode: null,
        projects: [{ id: 'guest-session', title: 'Guest Exploration', lastUpdated: new Date() }]
      });
      return;
    }

    // 1. Singleton Check: If the latest project is already a fresh empty conversation
    if (projects.length > 0 && projects[0].title === 'New Conversation') {
      // A. If we are already on this project and it is empty -> Do nothing
      if (activeProjectId === projects[0].id && nodes.length === 0) {
        console.log("[Store] Reusing existing empty project");
        return;
      }

      // B. If we are on a DIFFERENT project and the latest is empty -> Switch to it
      if (activeProjectId !== projects[0].id) {
        console.log("[Store] Switching to latest empty project");
        await get().setActiveProject(projects[0].id);
        return;
      }
    }

    set({ isLoading: true, error: null, isCreating: true });
    try {
      const res = await client.post('/projects', { name: "New Conversation" });
      const newProjectRaw = res.data;

      const newProject = {
        id: newProjectRaw._id,
        title: newProjectRaw.name,
        lastUpdated: newProjectRaw.createdAt
      };

      set(state => ({
        projects: [newProject, ...state.projects], // Prepend safely
        activeProjectId: newProject.id,
        nodes: [],   // Clear current view
        edges: [],
        activeNode: null,
        activeProjectTheme: null,
        isLoading: false
      }));
    } catch (err) {
      console.error("[Store] createProject Error:", err);
      set({ error: "Failed to create project", isLoading: false });
    } finally {
      set({ isCreating: false });
    }
  },

  // 3. Set Active Project & Load History (The "History Loading" Logic)
  setActiveProject: async (projectId) => {
    // Guest Handling
    if (get().user?.isGuest) return;

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
        importance: n.importance || 3,
        topicSummary: n.topicSummary || n.summary,
        summaryEmbedding: n.summaryEmbedding,
        // Safety check for position
        position: (n.position && typeof n.position.x === 'number')
          ? [n.position.x, n.position.y, n.position.z]
          : [0, 0, 0],
        createdAt: n.createdAt
      }));

      // 3.5. Fetch Edges for this Project
      const edgesRes = await client.get(`/edges/${projectId}`);
      const fetchedEdges = Array.isArray(edgesRes.data) ? edgesRes.data : [];
      const mappedEdges = fetchedEdges.map(e => ({
        id: e._id,
        source: e.source,
        target: e.target,
        type: e.type
      }));

      // 4. Update Store
      set({ nodes: mappedNodes, edges: mappedEdges, isLoading: false });

      console.log(`[Store] Loaded ${mappedNodes.length} nodes and ${mappedEdges.length} edges for project ${projectId}`);

    } catch (err) {
      console.error("[Store] setActiveProject Error:", err);
      set({ error: "Failed to load conversation history", isLoading: false });
    }
  },

  // 4. Send Message & Instant Title Update
  addNode: async (content) => {
    const { activeProjectId, nodes, activeNode, user } = get();

    // Auto-create project if missing
    if (!activeProjectId) {
      await get().createProject();
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
      // API Call Payload
      const payload = {
        projectId: currentProjectId,
        message: content,
        settings: get().settings, // Pass current settings
        parentNodeId: activeNode && !activeNode.startsWith('temp-') ? activeNode : null,
        isGuest: user?.isGuest,
        // For Guests: Pass History Context
        history: user?.isGuest ? nodes : undefined
      };

      const res = await client.post('/chat', payload);

      const { node: savedNode, edges: savedEdges, projectTitle } = res.data;

      // Map Real Node (safe position parsing)
      const pos = savedNode.position || { x: 0, y: 0, z: 0 };
      const realNode = {
        ...savedNode,
        id: savedNode._id || savedNode.id,
        position: Array.isArray(pos) ? pos : [pos.x || 0, pos.y || 0, pos.z || 0],
        topicSummary: savedNode.topicSummary || savedNode.summary,
        importance: savedNode.importance || 3
      };

      // 1. Replace Temp Node with Real Node
      const currentNodes = get().nodes;
      const finalNodes = currentNodes.map(n => n.id === tempId ? realNode : n);

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

      // 3. Handle Edges (Array)
      // Map edges to ensure ID consistency if needed (though backend provides _id)
      const newEdges = savedEdges ? savedEdges.map(e => ({ ...e, id: e.id || e._id })) : [];

      console.log(`[Store] Final nodes count: ${finalNodes.length}`, finalNodes);
      console.log(`[Store] New edges count: ${newEdges.length}`, newEdges);

      set({
        nodes: finalNodes,
        activeNode: realNode.id,
        edges: [...(get().edges || []), ...newEdges],
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
    const { user } = get();
    if (!user) return; // Wait for auth

    if (user.isGuest) {
      await get().createProject(); // Triggers guest init
      return;
    }

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
