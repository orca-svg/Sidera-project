import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { List, ChevronRight, ChevronLeft, Target, Telescope } from 'lucide-react';
import clsx from 'clsx';

export function TopicList() {
  const { nodes, flyToNode, viewMode, setViewMode, projects, activeProjectId, setActiveNode } = useStore();
  const currentProject = projects.find(p => p.id === activeProjectId);
  const [isOpen, setIsOpen] = useState(true);

  // Show ALL turns in Topic Flow (not filtered by importance)
  // Sort by creation order (oldest first)
  const tocNodes = [...nodes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (nodes.length === 0) return null;

  return (
    <motion.div
      className={clsx(
        "absolute top-4 right-4 bottom-24 z-30 flex flex-col pointer-events-auto transition-all",
        isOpen ? "w-64" : "w-12 items-end"
      )}
      initial={false}
      animate={{ width: isOpen ? 256 : 48 }}
    >
      {/* Header / Toggle */}
      <div className="flex gap-2 mb-2 justify-end">
        {isOpen && (
          <button
            onClick={() => setViewMode(viewMode === 'chat' ? 'constellation' : 'chat')}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-lg backdrop-blur-md",
              viewMode === 'constellation'
                ? "bg-accent/20 border-accent text-accent hover:bg-accent/30"
                : "bg-black/40 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <Telescope size={14} />
            <span>{viewMode === 'constellation' ? 'Viewing' : 'View Stars'}</span>
          </button>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-full bg-black/40 border border-white/10 text-gray-400 hover:text-white transition-colors backdrop-blur-md"
        >
          {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* List Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-64 max-h-[60vh] overflow-y-auto custom-scrollbar bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4"
          >
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">
              Topic Flow
            </h3>

            <div className="space-y-3 relative">
              {/* Vertical Line */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />

              {tocNodes.length === 0 ? (
                <div className="text-sm text-gray-500 italic px-2">Waiting for key topics...</div>
              ) : (
                tocNodes.map((node, index) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      if (viewMode === 'chat') {
                        setActiveNode(node.id); // Triggers scroll in MainLayout
                      } else {
                        flyToNode(node.id); // Triggers camera flight & mode switch
                      }
                    }}
                    className="relative w-full text-left group pl-6"
                  >
                    {/* Dot on Line */}
                    <div className={clsx(
                      "absolute left-[5px] top-2 w-1.5 h-1.5 rounded-full border border-black transition-colors",
                      (node.importance === 'Alpha' || (nodes.indexOf(node) === 0 && !node.importance)) ? "bg-accent scale-125" : "bg-gray-500 group-hover:bg-white"
                    )} />

                    <div className={clsx(
                      "transition-all duration-200 truncate pr-2",
                      (node.importance === 'Alpha' || (index === 0 && !node.importance))
                        ? "text-white font-medium text-sm"
                        : "text-gray-400 text-xs hover:text-gray-200"
                    )}>
                      {node.topicSummary || node.shortTitle || (node.keywords && node.keywords[0]) || "New"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
