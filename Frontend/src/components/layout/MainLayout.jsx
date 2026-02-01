import { useState, useEffect, useRef } from 'react'
import { Universe } from '../canvas/Universe'
import { useStore } from '../../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Menu, Plus, MessageSquare, X, Settings,
    HelpCircle, User, Mic, Send, Paperclip,
    Sparkles, PanelLeftClose, PanelLeftOpen, Telescope
} from 'lucide-react'
import clsx from 'clsx'

export function MainLayout() {
    const { nodes, addNode, setActiveNode, activeNode, initializeProject, projectId, isUniverseExpanded, toggleUniverse } = useStore()
    const [inputValue, setInputValue] = useState('')
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)

    // Mobile check
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false)
            } else {
                setIsSidebarOpen(true)
            }
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!inputValue.trim()) return
        addNode(inputValue)
        setInputValue('')
    }

    const handleNewChat = async () => {
        if (confirm("Start a new conversation? Current stars will be cleared.")) {
            // Reset by re-initializing. For now we just reload page or clear nodes if store supports it.
            // Since useStore doesn't have explicit reset, we can just reload or rely on backend to give fresh state if we had a 'new project' endpoint.
            // For now, let's just clear the input. The store clear needs a method.
            // Assuming initializeProject fetches a new or existing one.
            await initializeProject() // Re-fetch
        }
    }

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [nodes])

    // Init Project
    useEffect(() => {
        const init = async () => {
            if (!projectId) {
                await initializeProject();
            }
        };
        init();
    }, [projectId, initializeProject]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
            inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
        }
    }, [inputValue])

    return (
        <div className="relative w-full h-dvh overflow-hidden bg-background text-white font-sans">

            {/* LAYER 0: Background Universe */}
            <div className="absolute inset-0 z-0 pointer-events-auto">
                <Universe isInteractive={true} />
            </div>

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
                </div>

                {/* View Mode Section */}
                <div className="px-4 pb-4">
                    <button
                        onClick={() => {
                            toggleUniverse()
                            if (window.innerWidth < 768) setIsSidebarOpen(false)
                        }}
                        className="w-full h-10 flex items-center gap-3 px-4 bg-gray-800/50 hover:bg-gray-700 text-gray-200 hover:text-white rounded-full transition-all duration-200 border border-transparent hover:border-accent/30 group mb-2"
                    >
                        <Telescope size={18} className="text-gray-400 group-hover:text-accent transition-colors" />
                        <span className="text-sm font-medium">View Universe</span>
                    </button>
                    <button
                        onClick={handleNewChat}
                        className="w-full h-10 flex items-center gap-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-full transition-all duration-200 border border-transparent hover:border-accent/30 group shadow-lg"
                    >
                        <Plus size={18} className="text-gray-400 group-hover:text-accent transition-colors" />
                        <span className="text-sm font-medium">New chat</span>
                    </button>
                </div>

                {/* History Section */}
                <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Recent
                    </div>
                    <div className="space-y-1">
                        {nodes.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500 italic">No history yet</div>
                        ) : (
                            nodes.map(node => (
                                <button
                                    key={node.id}
                                    onClick={() => setActiveNode(node.id)}
                                    className={clsx(
                                        "w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group relative overflow-hidden",
                                        activeNode === node.id
                                            ? "bg-accent/10 text-accent font-medium"
                                            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                    )}
                                >
                                    <MessageSquare size={16} className={activeNode === node.id ? "text-accent" : "text-gray-600 group-hover:text-gray-400"} />
                                    <span className="truncate flex-1 relative z-10">{node.question}</span>
                                    {activeNode === node.id && (
                                        <div className="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Bottom Section: Profile/Settings */}
                <div className="p-3 mt-auto border-t border-white/5 bg-black/40">
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-left">
                        <HelpCircle size={18} />
                        <span>Help</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-left">
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                    <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-inner border border-white/10">
                            U
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">User</div>
                            <div className="text-xs text-accent truncate">Pro Plan</div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Toggle Button (When sidebar closed) */}
            <AnimatePresence>
                {!isSidebarOpen && !isUniverseExpanded && (
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

            {/* Float Back Button (When Universe Expanded) */}
            <AnimatePresence>
                {isUniverseExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
                    >
                        <button
                            onClick={toggleUniverse}
                            className="flex items-center gap-2 px-6 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-accent hover:text-black transition-all shadow-2xl group"
                        >
                            <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                            <span className="font-medium">Open Chat</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* LAYER 2: Main Chat Area (Center) */}
            <div className={clsx(
                "absolute inset-y-0 right-0 z-10 flex flex-col transition-all duration-500 pointer-events-none",
                isSidebarOpen ? "md:left-[280px] w-full md:w-[calc(100%-280px)]" : "left-0 w-full",
                isUniverseExpanded ? "opacity-0 translate-y-10 pointer-events-none" : "opacity-100 translate-y-0"
            )}>
                {/* Top Bar (Sticky) */}
                <div className="sticky top-0 w-full h-16 flex items-center justify-center pointer-events-auto z-20">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-gray-300 hover:text-white group backdrop-blur-sm">
                        <span className="text-lg font-medium group-hover:text-accent transition-colors">Sidera</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/20">Alpha 1.0</span>
                    </button>
                </div>

                {/* Chat Content */}
                <div className="flex-1 overflow-y-auto w-full custom-scrollbar pointer-events-auto">
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
                                    {[
                                        { t: 'Structure of a black hole', i: '⚫' },
                                        { t: 'Nearest star system', i: '⭐' },
                                        { t: 'Explain dark matter', i: '🌌' }
                                    ].map((item, i) => (
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
                            nodes.map((node, index) => (
                                <div key={node.id} className="w-full flex flex-col gap-6 animate-fade-in">
                                    {/* User Message */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[85%] md:max-w-[75%] bg-gray-800 rounded-[20px] rounded-tr-sm px-6 py-4 text-gray-100 shadow-md border border-white/5 leading-relaxed">
                                            {node.question}
                                        </div>
                                    </div>

                                    {/* AI Message */}
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg ring-1 ring-white/10">
                                            <Sparkles size={16} className="text-white" />
                                        </div>
                                        <div className="flex-1 space-y-2 py-1">
                                            <div className="text-sm font-medium text-gray-400 mb-1">Sidera AI</div>
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
                                            {/* Keywords Badge */}
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
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 md:pb-8 pointer-events-auto z-40">
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none h-32 -top-16"></div>

                    <div className={clsx(
                        "relative w-full max-w-3xl mx-auto transition-all duration-300"
                    )}>
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
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
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

            </div>
        </div>
    )
}
