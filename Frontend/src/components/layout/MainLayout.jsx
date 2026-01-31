import { useState, useEffect, useRef } from 'react'
import { Universe } from '../canvas/Universe'
import { useStore } from '../../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'

export function MainLayout() {
    const { nodes, addNode, isUniverseExpanded, toggleUniverse, setActiveNode, activeNode } = useStore()
    const [inputValue, setInputValue] = useState('')
    const chatEndRef = useRef(null)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!inputValue.trim()) return
        addNode(inputValue)
        setInputValue('')
    }

    // Auto-scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [nodes])

    // Init Project on Mount
    useEffect(() => {
        const init = async () => {
            if (!useStore.getState().projectId) {
                console.log("[MainLayout] Pre-initializing project...");
                await useStore.getState().initializeProject();
            }
        };
        init();
    }, []);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

            {/* LAYER 0: Background Universe */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0
            }}>
                <Universe isInteractive={true} />
            </div>

            {/* LAYER 1: Centered Chat Interface */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none' // Allow clicking through to space where empty
            }}>
                <div className="glass-panel" style={{
                    width: '100%',
                    maxWidth: 'var(--max-chat-width)',
                    height: '90%',
                    marginTop: '2%', // Slight top margin
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    pointerEvents: 'auto', // Re-enable pointer events for chat
                    overflow: 'hidden'
                }}>

                    {/* Header */}
                    <div style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>Sidera</h2>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Constellation Mode</div>
                    </div>

                    {/* Messages List */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px'
                    }}>
                        {nodes.length === 0 && (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
                                <h3>Start your journey</h3>
                                <p>Ask about the cosmos, simple stars, or deep space mysteries.</p>
                            </div>
                        )}

                        {nodes.map(node => (
                            <div key={node.id} onClick={() => setActiveNode(node.id)}>
                                {/* User Question */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                    <div style={{
                                        background: 'var(--chat-bg-user)',
                                        padding: '12px 18px',
                                        borderRadius: '20px 20px 4px 20px',
                                        maxWidth: '80%',
                                        lineHeight: '1.5',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        {node.question}
                                    </div>
                                </div>

                                {/* AI Answer */}
                                <div style={{ display: 'flex', gap: '16px', paddingLeft: '4px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'var(--color-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.9rem'
                                    }}>✦</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Sidera AI</div>
                                        <div style={{ lineHeight: '1.6', fontSize: '1rem' }}>
                                            {node.isPending ? (
                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Analyzing starlight...</span>
                                            ) : node.answer}
                                        </div>
                                        {/* Keywords */}
                                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {node.keywords?.map((k, i) => (
                                                <span key={i} style={{
                                                    fontSize: '0.75rem',
                                                    background: 'rgba(124, 58, 237, 0.1)',
                                                    color: '#A78BFA',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(124, 58, 237, 0.2)'
                                                }}>
                                                    #{k}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{
                        padding: '24px',
                        background: 'linear-gradient(to top, var(--color-bg-deep), transparent)'
                    }}>
                        <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Message Sidera..."
                                style={{
                                    width: '100%',
                                    padding: '16px 20px',
                                    paddingRight: '48px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'var(--input-bg)',
                                    color: 'white',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim()}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: inputValue.trim() ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: inputValue.trim() ? 'pointer' : 'default',
                                    transition: 'background 0.2s',
                                    color: 'white'
                                }}
                            >
                                ↑
                            </button>
                        </form>
                        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            AI can make mistakes. Verify important astronomical data.
                        </div>
                    </div>

                </div>
            </div>

            {/* LAYER 2: Right Sidebar (Reduced Size) - Constellation List */}
            <div style={{
                position: 'absolute',
                right: '20px',
                top: '20px',
                bottom: '20px',
                width: '240px',
                zIndex: 2,
                pointerEvents: 'none', // Allow clicking through if we want, but let's make the panel interactive
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                {/* Toggle Visibility Control could go here, for now just the list */}
                <div className="glass-panel" style={{
                    padding: '16px',
                    borderRadius: '12px',
                    pointerEvents: 'auto',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Constellations
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {nodes.length > 0 ? (
                            nodes.map(node => (
                                <li key={node.id}
                                    onClick={() => setActiveNode(node.id)}
                                    style={{
                                        marginBottom: '6px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        color: activeNode === node.id ? 'var(--color-secondary)' : 'var(--text-muted)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: activeNode === node.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ marginRight: '6px' }}>•</span>
                                    {node.keywords?.[0] || 'Star ' + node.id.slice(-4)}
                                </li>
                            ))
                        ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No stars yet...
                            </div>
                        )}
                    </ul>
                </div>
            </div>

        </div>
    )
}
