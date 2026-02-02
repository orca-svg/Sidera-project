import { useState, useEffect, useRef } from 'react'
import { Universe } from '../canvas/Universe'
import { useStore } from '../../store/useStore'
import { useEventListener } from '../../hooks/useEventListener'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Menu, Plus, MessageSquare, X, Settings,
    HelpCircle, User, Mic, Send, Paperclip,
    Sparkles, PanelLeftClose, PanelLeftOpen, Telescope, Camera
} from 'lucide-react'
import clsx from 'clsx'
import { TopicList } from './TopicList'
import { HelpModal } from './HelpModal'
import { SettingsModal } from './SettingsModal'
import { useAuth } from '../../auth/AuthContext'


// Optimized: Hoist static data outside component to avoid recreation on every render
const SUGGESTION_CARDS = [
    { t: 'Structure of a black hole', i: '⚫' },
    { t: 'Nearest star system', i: '⭐' },
    { t: 'Explain dark matter', i: '🌌' }
]

export function MainLayout() {
    // Optimized: Use selective Zustand selectors to prevent unnecessary re-renders
    const nodes = useStore(state => state.nodes)
    const addNode = useStore(state => state.addNode)
    const setActiveNode = useStore(state => state.setActiveNode)
    const activeNode = useStore(state => state.activeNode)
    const projects = useStore(state => state.projects)
    const activeProjectId = useStore(state => state.activeProjectId)
    const createProject = useStore(state => state.createProject)
    const setActiveProject = useStore(state => state.setActiveProject)
    const initializeProject = useStore(state => state.initializeProject)
    const viewMode = useStore(state => state.viewMode)
    const setViewMode = useStore(state => state.setViewMode)
    const user = useStore(state => state.user) // Get synced user from store

    const { logout } = useAuth()

    const [inputValue, setInputValue] = useState('')
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isHelpOpen, setIsHelpOpen] = useState(false) // New Help State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)
    const isComposing = useRef(false) // IME State Ref

    // Mobile check - Optimized: Use custom hook for event listener
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false)
            } else {
                setIsSidebarOpen(true)
            }
        }
        handleResize() // Initial check
    }, [])

    useEventListener('resize', () => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false)
        } else {
            setIsSidebarOpen(true)
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!inputValue.trim()) return
        addNode(inputValue)
        setInputValue('')
    }

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [nodes])

    // Optimized: Init Project - Use ref to ensure it only runs once on mount
    const initialized = useRef(false)
    useEffect(() => {
        if (!initialized.current) {
            const init = async () => {
                await initializeProject();
            };
            init();
            initialized.current = true
        }
    }, [initializeProject]);

    // Optimized: Auto-resize textarea with requestAnimationFrame to batch DOM updates
    useEffect(() => {
        if (!inputRef.current) return

        const rafId = requestAnimationFrame(() => {
            if (inputRef.current) {
                inputRef.current.style.height = 'auto'
                inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
            }
        })

        return () => cancelAnimationFrame(rafId)
    }, [inputValue])

    // Scroll to Active Node (from Topic Click / Star Click) - [Local Feature]
    useEffect(() => {
        if (activeNode) {
            const el = document.getElementById(`node-${activeNode}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional highlight effect
                el.classList.add('bg-white/5', 'duration-500', 'transition-colors');
                setTimeout(() => el.classList.remove('bg-white/5'), 1500);
            }
        }
    }, [activeNode]);

    // ESC Key Listener for connection mode - Optimized: Use custom hook
    useEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewMode === 'constellation') {
            setViewMode('chat')
        }
    })

    const handleViewUniverse = () => {
        setViewMode('constellation')
        if (window.innerWidth < 768) setIsSidebarOpen(false)
    }

    const handleCapture = () => {
        // Find the canvas element
        const canvas = document.querySelector('canvas')
        if (!canvas) return

        try {
            // Create a temporary link
            const link = document.createElement('a')
            const date = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
            link.download = `Sidera_Capture_${date}.png`
            link.href = canvas.toDataURL('image/png')

            // Trigger download
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err) {
            console.error("Capture failed:", err)
        }
    }

    return (
        <div className="relative w-full h-dvh overflow-hidden bg-background text-white font-sans">

            {/* Help Modal */}
            <AnimatePresence>
                {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
            </AnimatePresence>

            <AnimatePresence>
                {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
            </AnimatePresence>

            {/* LAYER 0: Background Universe */}
            <div className="absolute inset-0 z-0 pointer-events-auto">
                <Universe isInteractive={true} />
            </div>

            {/* LAYER 0.5: Topic Flow Panel (Right) */}
            <TopicList />

            {/* LAYER 1: Sidebar (Left Panel) */}
            <motion.div
                className={clsx(
                    "absolute top-0 left-0 h-full z-30 flex flex-col glass-sidebar transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-lg",
                    isSidebarOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full opacity-0"
                )}
                initial={false}
                animate={{
                    width: isSidebarOpen ? 280 : 0,
                    opacity: isSidebarOpen ? 1 : 0,
                    x: isSidebarOpen ? 0 : -20
                }}
            >
                {/* Sidebar Header */}
                <div className="p-4 flex items-center justify-between sticky top-0 z-10">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <PanelLeftClose size={20} />
                    </button>
                    {/* <span className="text-gray-400 text-xs font-mono">HISTORY</span> Removed */}
                </div>

                {/* View Mode Section: New Chat */}
                <div className="px-4 pb-4">
                    <button
                        onClick={createProject}
                        className="w-full h-10 flex items-center gap-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-full transition-all duration-200 border border-transparent hover:border-accent/30 group shadow-lg"
                    >
                        <Plus size={18} className="text-gray-400 group-hover:text-accent transition-colors" />
                        <span className="text-sm font-medium">New chat</span>
                    </button>
                </div>

                {/* History Section */}
                <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
                    <div className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Recent
                    </div>
                    <div className="space-y-1">
                        {user?.isGuest ? (
                            <div className="px-3 py-4 text-center">
                                <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                                    History not saved
                                </span>
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500 italic">No history yet</div>
                        ) : (
                            projects.map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => setActiveProject(project.id)}
                                    className={clsx(
                                        "w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all group relative overflow-hidden",
                                        activeProjectId === project.id
                                            ? "bg-accent/10 text-accent font-medium"
                                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                    )}
                                >
                                    <MessageSquare size={16} className={activeProjectId === project.id ? "text-accent" : "text-gray-600 group-hover:text-gray-400"} />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{project.title}</div>
                                        <div className="text-[10px] text-gray-600 truncate">
                                            {new Date(project.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    {activeProjectId === project.id && (
                                        <div className="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Bottom Section: Profile/Settings */}
                <div className="p-3 mt-auto border-t border-white/5 bg-black/40">
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-left"
                    >
                        <HelpCircle size={18} />
                        <span>Help</span>
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-left"
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>

                    <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                        {user?.picture ? (
                            <img src={user.picture} alt="User" className="w-8 h-8 rounded-full border border-white/20" />
                        ) : (
                            <div className={clsx(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner border border-white/10",
                                user?.isGuest ? "bg-gradient-to-tr from-orange-500 to-red-500" : "bg-gradient-to-tr from-indigo-500 to-purple-500"
                            )}>
                                {user?.name?.[0] || "U"}
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{user?.name || "User"}</div>
                            <div className={clsx("text-xs truncate", user?.isGuest ? "text-orange-400" : "text-accent")}>
                                {user?.isGuest ? "Guest Mode" : "Pro Plan"}
                            </div>
                        </div>

                        {/* Logout Button (Hidden by default, shown on hover/group) */}
                        <button
                            onClick={logout}
                            title="Sign Out"
                            className="p-1.5 rounded-md hover:bg-white/20 text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <PanelLeftClose size={14} className="rotate-180" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Toggle Button (When sidebar closed) */}
            <AnimatePresence>
                {!isSidebarOpen && viewMode !== 'constellation' && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute top-4 left-4 z-20 p-2.5 rounded-lg bg-black/40 backdrop-blur-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10 shadow-lg"
                    >
                        <PanelLeftOpen size={20} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Intentionally removed floating 'Open Chat' button for immersive experience. Use ESC to return. */}

            {/* LAYER 2: Main Chat Area (Center) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{
                    opacity: viewMode === 'chat' ? 1 : 0,
                    pointerEvents: viewMode === 'chat' ? 'auto' : 'none'
                }}
                transition={{
                    duration: 0.5,
                    ease: "easeInOut",
                    // Delay appearance by 1.0s to match Warp Animation duration
                    delay: viewMode === 'chat' ? 1.0 : 0
                }}
                style={{ willChange: 'opacity' }}
                className={clsx(
                    "absolute inset-y-0 right-0 z-10 flex flex-col transition-all duration-300 pointer-events-none",
                    // Apply opacity-0 instantly via class when in constellation mode to ensure Warp visibility
                    viewMode === 'constellation' && "opacity-0",
                    isSidebarOpen ? "md:left-[280px] w-full md:w-[calc(100%-280px)]" : "left-0 w-full"
                )}
            >
                {/* Top Bar (Sticky) */}
                <div className={clsx("sticky top-0 w-full h-16 flex items-center justify-center z-20 transition-none", viewMode === 'chat' ? "pointer-events-auto" : "pointer-events-none")}>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-gray-300 hover:text-white group backdrop-blur-sm">
                        <span className="text-lg font-medium group-hover:text-accent transition-colors">Sidera</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/20">Alpha 1.0</span>
                    </button>
                </div>

                {/* Chat Content */}
                <div className={clsx("flex-1 overflow-y-auto w-full custom-scrollbar transition-none", viewMode === 'chat' ? "pointer-events-auto" : "pointer-events-none")}>
                    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 px-4 pb-48 pt-4">
                        {nodes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
                                <div className="relative w-20 h-20">
                                    <div className="absolute inset-0 bg-accent/30 rounded-full blur-xl animate-pulse-slow"></div>
                                    <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden glass-panel">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-accent/10 to-transparent"></div>
                                        <Sparkles className="w-10 h-10 text-accent relative z-10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">
                                        Hello, Traveller
                                    </h1>
                                    <p className="text-xl text-gray-400 font-light">How can I help you explore the universe today?</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl mt-4">
                                    {SUGGESTION_CARDS.map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setInputValue(item.t)}
                                            className="p-4 rounded-xl bg-gray-800/40 hover:bg-gray-700/60 border border-white/5 hover:border-accent/20 text-left transition-all group backdrop-blur-sm"
                                        >
                                            <div className="text-lg mb-2">{item.i}</div>
                                            <div className="text-sm text-gray-300 group-hover:text-white">{item.t}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            nodes.map((node) => (
                                <div key={node.id} id={`node-${node.id}`} className="w-full flex flex-col gap-6 animate-fade-in transition-colors rounded-xl p-2">
                                    <div className="flex justify-end">
                                        <div className="max-w-[85%] md:max-w-[75%] bg-gray-800 rounded-[20px] rounded-tr-sm px-6 py-4 text-gray-100 shadow-md border border-white/5 leading-relaxed">
                                            {node.question}
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg ring-1 ring-white/10">
                                            <Sparkles size={16} className="text-white" />
                                        </div>
                                        <div className="flex-1 space-y-2 py-1">
                                            <div className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
                                                <span>Sidera AI</span>
                                                {!node.isPending && node.importance && (
                                                    <span
                                                        className="text-xs px-2 py-0.5 rounded-full font-mono"
                                                        style={{
                                                            color: node.importance === 5 ? '#FFD700' :
                                                                   node.importance === 4 ? '#00FFFF' :
                                                                   node.importance === 3 ? '#88AAFF' :
                                                                   node.importance === 2 ? '#FFFFFF' : '#888888',
                                                            backgroundColor: `${node.importance === 5 ? '#FFD700' :
                                                                              node.importance === 4 ? '#00FFFF' :
                                                                              node.importance === 3 ? '#88AAFF' :
                                                                              node.importance === 2 ? '#FFFFFF' : '#888888'}15`,
                                                            border: `1px solid ${node.importance === 5 ? '#FFD700' :
                                                                                  node.importance === 4 ? '#00FFFF' :
                                                                                  node.importance === 3 ? '#88AAFF' :
                                                                                  node.importance === 2 ? '#FFFFFF' : '#888888'}40`
                                                        }}
                                                    >
                                                        {'★'.repeat(node.importance)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="prose prose-invert max-w-none text-gray-100 leading-7 text-[16px]">
                                                {node.isPending ? (
                                                    <div className="flex items-center gap-2 text-gray-400 italic">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-accent/80 animate-bounce"></span>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-accent/80 animate-bounce delay-100"></span>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-accent/80 animate-bounce delay-200"></span>
                                                        <span className="ml-2 text-sm text-accent">Observing the cosmos...</span>
                                                    </div>
                                                ) : (
                                                    node.answer
                                                )}
                                            </div>
                                            {node.keywords && node.keywords.length > 0 && (
                                                <div className="flex gap-2 mt-4 flex-wrap">
                                                    {node.keywords.map((k, idx) => (
                                                        <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors cursor-default">
                                                            #{k}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Input Area (Bottom Fixed) */}
                <div className={clsx("absolute bottom-0 left-0 right-0 p-4 pb-6 md:pb-8 z-40 transition-none", viewMode === 'chat' ? "pointer-events-auto" : "pointer-events-none")}>

                    <div className={clsx(
                        "relative w-full max-w-3xl mx-auto transition-all duration-300"
                    )}>
                        {/* Gradient Mask: Constrained to Center Column (User Request) */}
                        {/* Hides scrolling text BEHIND the input box, but keeps Left/Right sides transparent for stars */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none h-48 -bottom-8 z-[-1]"></div>
                        <form onSubmit={handleSubmit} className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-purple-500/5 to-accent/5 rounded-[28px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>

                            <div className="glass-input relative flex items-end gap-3 p-3 rounded-[28px] bg-gray-900/80 border border-white/10 shadow-2xl backdrop-blur-xl">
                                <button type="button" className="p-3 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 rounded-full transition-colors self-end mb-0.5">
                                    <Plus size={20} />
                                </button>

                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Message Sidera..."
                                    rows={1}
                                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-lg resize-none min-h-[48px] max-h-[200px] py-3 px-2 hide-scrollbar"
                                    onCompositionStart={() => isComposing.current = true}
                                    onCompositionEnd={() => isComposing.current = false}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            if (isComposing.current) return; // Prevent duplicate submit
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                />

                                <div className="flex items-center gap-2 self-end mb-0.5">
                                    <button type="button" className="p-3 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full">
                                        <Mic size={20} />
                                    </button>
                                    <button
                                        type="submit"
                                        className={clsx(
                                            "p-3 rounded-full transition-all duration-300 shadow-lg",
                                            inputValue.trim()
                                                ? "bg-white text-black hover:scale-105 hover:bg-accent hover:text-black"
                                                : "bg-gray-800 text-gray-600 cursor-not-allowed"
                                        )}
                                        disabled={!inputValue.trim()}
                                    >
                                        <Send size={18} className={inputValue.trim() ? "fill-current" : ""} />
                                    </button>
                                </div>
                            </div>
                        </form>
                        <div className="text-center mt-3 text-[11px] text-gray-500 font-medium tracking-wide">
                            Sidera employs generative AI. Verification of astronomical data is recommended.
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Hint for Constellation Mode - Repositioned: Fixed, Centered in Main Content */}
            <AnimatePresence>
                {viewMode === 'constellation' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className={clsx(
                            "fixed bottom-8 right-0 z-50 pointer-events-none flex justify-center transition-all duration-300 ease-in-out",
                            isSidebarOpen ? "md:left-[280px] w-full md:w-[calc(100%-280px)]" : "left-0 w-full"
                        )}
                    >
                        <div className="pointer-events-auto px-6 py-3 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 text-white text-sm flex items-center gap-3 shadow-2xl">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                            <span>Constellation Mode Active</span>
                            <span className="text-gray-400 border-l border-white/20 pl-3 ml-1 mr-2">Press <span className="font-bold text-white">ESC</span> to return</span>

                            <button
                                onClick={handleCapture}
                                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors border border-white/5 ml-2"
                                title="Capture View"
                            >
                                <Camera size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
