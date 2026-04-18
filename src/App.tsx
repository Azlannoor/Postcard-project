/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import { 
  Camera as CameraIcon, 
  Settings, 
  Library, 
  Ghost, 
  Maximize2, 
  Minimize2, 
  X, 
  Check, 
  Sparkles,
  ChevronRight,
  History as HistoryIcon,
  Video,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { POSE_CATEGORIES, SAMPLE_POSES, PoseReference, PoseCategory } from './constants';
import { getPoseSuggestion } from './services/geminiService';

// --- Sub-Components ---

interface FloatingMenuProps {
  onToggleLibrary: () => void;
  onToggleSettings: () => void;
  onToggleOverlay: () => void;
  isOverlayActive: boolean;
  mode: 'photo' | 'video';
  onToggleMode: () => void;
}

const FloatingBubble = ({ onToggleLibrary, onToggleSettings, onToggleOverlay, isOverlayActive, mode, onToggleMode }: FloatingMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-10 right-10 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-20 right-0 flex flex-col gap-4 items-end"
          >
            <button
              onClick={() => { onToggleLibrary(); setIsOpen(false); }}
              className="flex items-center gap-3 bg-[#141416]/60 backdrop-blur-xl border border-[rgba(197,160,89,0.2)] px-4 py-2 rounded-full text-[#e2dfda] hover:bg-white/5 transition-all shadow-2xl"
            >
              <span className="text-xs uppercase tracking-widest font-medium">Library</span>
              <div className="w-10 h-10 rounded-full bg-[#c5a059]/80 flex items-center justify-center text-black">
                <Library size={18} />
              </div>
            </button>

            <button
              onClick={() => { onToggleOverlay(); setIsOpen(false); }}
              className={cn(
                "flex items-center gap-3 bg-[#141416]/60 backdrop-blur-xl border px-4 py-2 rounded-full text-[#e2dfda] hover:bg-white/5 transition-all shadow-2xl",
                isOverlayActive ? "border-[#c5a059]/50 bg-[#c5a059]/5" : "border-[rgba(197,160,89,0.2)]"
              )}
            >
              <span className="text-xs uppercase tracking-widest font-medium">{isOverlayActive ? 'Active' : 'Hidden'}</span>
              <div className="w-10 h-10 rounded-full bg-[#c5a059]/80 flex items-center justify-center text-black">
                <Sparkles size={18} />
              </div>
            </button>

            <button
              onClick={() => { onToggleMode(); setIsOpen(false); }}
              className="flex items-center gap-3 bg-[#141416]/60 backdrop-blur-xl border border-[rgba(197,160,89,0.2)] px-4 py-2 rounded-full text-[#e2dfda] hover:bg-white/5 transition-all shadow-2xl"
            >
              <span className="text-xs uppercase tracking-widest font-medium">{mode}</span>
              <div className="w-10 h-10 rounded-full bg-[#c5a059]/80 flex items-center justify-center text-black">
                {mode === 'photo' ? <CameraIcon size={18} /> : <Video size={18} />}
              </div>
            </button>

            <button
              onClick={() => { onToggleSettings(); setIsOpen(false); }}
              className="flex items-center gap-3 bg-[#141416]/60 backdrop-blur-xl border border-[rgba(197,160,89,0.2)] px-4 py-2 rounded-full text-[#e2dfda] hover:bg-white/5 transition-all shadow-2xl"
            >
              <span className="text-xs uppercase tracking-widest font-medium">Config</span>
              <div className="w-10 h-10 rounded-full bg-[#c5a059]/80 flex items-center justify-center text-black">
                <Settings size={18} />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all border-2",
          isOpen ? "bg-[#e2dfda] border-[#c5a059] text-black" : "bg-[#c5a059] border-[#e2dfda]/20 text-black"
        )}
      >
        {isOpen ? <X size={28} /> : <div className=""><Sparkles size={28} /></div>}
      </motion.button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOverlayEnabled, setIsOverlayEnabled] = useState(true);
  const [activePose, setActivePose] = useState<PoseReference | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGhostingActive, setIsGhostingActive] = useState(false);
  const [ghostingImage, setGhostingImage] = useState<string | null>(null);
  const [transparency, setTransparency] = useState(0.4);
  const [detectionConfidence, setDetectionConfidence] = useState(0.5);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [poseSuggestion, setPoseSuggestion] = useState<{ pose: string; mood: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Initialize MediaPipe Pose
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: detectionConfidence,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: Results) => {
      const canvasCtx = canvasRef.current!.getContext('2d')!;
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

      if (isOverlayEnabled && results.poseLandmarks) {
        // Draw the skeletal overlay with Gold color
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#c5a059', lineWidth: 2.5 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#e2dfda', lineWidth: 1, radius: 2 });
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current! });
      },
      width: 1280,
      height: 720,
    });

    camera.start();

    return () => {
      camera.stop();
    };
  }, [isOverlayEnabled, detectionConfidence]);

  const handleSuggest = async () => {
    setIsAnalyzing(true);
    const result = await getPoseSuggestion('Luxury Suit', 'Opulent Ballroom');
    setPoseSuggestion(result);
    setIsAnalyzing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setGhostingImage(url);
      setIsGhostingActive(true);
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0b] overflow-hidden font-sans text-[#e2dfda]">
      {/* Background Camera Layer */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[40%]"
        playsInline
      />

      {/* Ghosting Overlay Layer */}
      {isGhostingActive && ghostingImage && (
        <div 
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-500"
          style={{ opacity: transparency }}
        >
          <img 
            src={ghostingImage} 
            alt="Ghosting Reference" 
            className="w-full h-full object-contain mix-blend-screen brightness-125"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Active Pose Reference Silhouette */}
      {activePose && (
         <div 
         className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 flex items-center justify-center"
         style={{ opacity: transparency }}
       >
         <img 
           src={activePose.image} 
           alt={activePose.name} 
           className="h-[85%] object-contain opacity-40 blur-[1px] sepia-[0.3] brightness-110"
           referrerPolicy="no-referrer"
         />
       </div>
      )}

      {/* Canvas Logic Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20 w-full h-full pointer-events-none"
        width={1280}
        height={720}
      />

      {/* HUD Controls */}
      <div className="absolute top-0 left-0 right-0 p-8 z-30 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-serif font-light text-[#c5a059] tracking-[0.2em] flex items-center gap-4">
              <span className="w-8 h-[1px] bg-[#c5a059]/40" /> POSTCARD
            </h1>
            <div className="bg-[#141416]/70 backdrop-blur-xl border border-[rgba(197,160,89,0.2)] rounded-none p-4 max-w-xs transition-all shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-[#c5a059]/40" />
              <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-[#c5a059] mb-2">Neural Guidance</p>
              {poseSuggestion ? (
                <div>
                  <p className="font-serif text-[#e2dfda] text-lg leading-snug">{poseSuggestion.pose}</p>
                  <p className="text-[#94918c] text-[10px] uppercase mt-2 tracking-[0.1em] font-medium">— {poseSuggestion.mood} Perspective</p>
                </div>
              ) : (
                <button 
                  onClick={handleSuggest} 
                  disabled={isAnalyzing}
                  className="w-full py-3 bg-[#c5a059] hover:bg-[#b08d4a] text-black rounded-sm text-[10px] uppercase font-bold tracking-widest transition-all disabled:opacity-30"
                >
                  {isAnalyzing ? "Calibrating..." : "Initiate Suggestion"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-6 pointer-events-auto">
          <div className="bg-[#141416]/70 backdrop-blur-xl border border-[rgba(197,160,89,0.2)] p-4 flex flex-col items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#c5a059] animate-pulse" />
            <span className="text-[9px] font-mono text-[#94918c] uppercase tracking-tighter">Live v2.4</span>
          </div>
        </div>
      </div>

      {/* Floating UI Elements */}
      <FloatingBubble 
        onToggleLibrary={() => setIsLibraryOpen(true)}
        onToggleSettings={() => setIsSettingsOpen(true)}
        onToggleOverlay={() => setIsOverlayEnabled(!isOverlayEnabled)}
        isOverlayActive={isOverlayEnabled}
        mode={mode}
        onToggleMode={() => setMode(mode === 'photo' ? 'video' : 'photo')}
      />

      {/* Sidebar: Library */}
      <AnimatePresence>
        {isLibraryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLibraryOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0a0a0b] border-l border-[rgba(197,160,89,0.2)] z-[70] p-10 overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-16">
                <div>
                  <h2 className="text-4xl font-serif font-light text-[#e2dfda] tracking-tight">Pose Archive</h2>
                  <p className="text-[#94918c] text-sm mt-2 font-serif italic">Select archival silhouette for synchronization</p>
                </div>
                <button onClick={() => setIsLibraryOpen(false)} className="p-2 text-[#94918c] hover:text-[#c5a059] transition-colors">
                  <X size={28} />
                </button>
              </div>

              {POSE_CATEGORIES.map(category => (
                <div key={category} className="mb-14">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-[1px] w-4 bg-[#c5a059]/40" />
                    <h3 className="text-[#c5a059] text-[10px] uppercase font-bold tracking-[0.4em]">{category}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {SAMPLE_POSES.filter(p => p.category === category).map(pose => (
                      <button
                        key={pose.id}
                        onClick={() => { setActivePose(pose); setIsLibraryOpen(false); }}
                        className={cn(
                          "group relative aspect-[3/4] overflow-hidden border transition-all",
                          activePose?.id === pose.id ? "border-[#c5a059] scale-[0.98] shadow-[0_0_20px_rgba(197,160,89,0.1)]" : "border-white/5 hover:border-[#c5a059]/30"
                        )}
                      >
                        <img src={pose.image} alt={pose.name} className="w-full h-full object-cover grayscale opacity-60 transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          <p className="text-[#e2dfda] text-xs font-serif italic tracking-wide">{pose.name}</p>
                        </div>
                        {activePose?.id === pose.id && (
                          <div className="absolute top-0 right-0 p-2 bg-[#c5a059] text-black">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar: Settings */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-[#0a0a0b] border-l border-[rgba(197,160,89,0.2)] z-[70] p-10"
            >
              <div className="flex justify-between items-start mb-16">
                <h2 className="text-3xl font-serif font-light text-[#e2dfda] tracking-tight">System Controls</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-[#94918c] hover:text-[#c5a059] transition-colors">
                  <X size={28} />
                </button>
              </div>

              <div className="space-y-12">
                <div>
                  <label className="text-[#c5a059] text-[9px] uppercase font-bold tracking-[0.3em] block mb-6">Silhouette Density</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={transparency} 
                    onChange={(e) => setTransparency(parseFloat(e.target.value))}
                    className="w-full accent-[#c5a059] appearance-none bg-white/5 h-[1px] cursor-pointer"
                  />
                  <div className="flex justify-between mt-3 text-[9px] text-[#94918c] font-mono tracking-widest">
                    <span>NULL</span>
                    <span>{(transparency * 100).toFixed(0)}% UNIT</span>
                    <span>MAX</span>
                  </div>
                </div>

                <div>
                  <label className="text-[#c5a059] text-[9px] uppercase font-bold tracking-[0.3em] block mb-6">Neural Fidelity</label>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="0.9" 
                    step="0.1" 
                    value={detectionConfidence} 
                    onChange={(e) => setDetectionConfidence(parseFloat(e.target.value))}
                    className="w-full accent-[#c5a059] appearance-none bg-white/5 h-[1px] cursor-pointer"
                  />
                  <div className="flex justify-between mt-3 text-[9px] text-[#94918c] font-mono tracking-widest">
                    <span>COARSE</span>
                    <span>GRANULAR</span>
                  </div>
                </div>

                <div>
                  <label className="text-[#c5a059] text-[9px] uppercase font-bold tracking-[0.3em] block mb-6">Ghost Fragment</label>
                  <div className="flex gap-4 items-center">
                    <label className="flex-1 flex flex-col items-center justify-center gap-3 py-8 bg-[#141416] border border-[#c5a059]/20 rounded-none cursor-pointer hover:bg-[#1a1a1c] hover:border-[#c5a059]/50 transition-all text-[#94918c] group">
                      <Upload size={24} className="group-hover:text-[#c5a059] transition-colors" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">Import Custom Node</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>

                <div className="pt-16 border-t border-[rgba(197,160,89,0.1)]">
                   <div className="flex items-center gap-2 mb-2">
                     <div className="w-1 h-1 rounded-full bg-[#c5a059]" />
                     <p className="text-[9px] text-[#94918c] font-mono tracking-[0.1em]">POSTCARD OS v2.4.0</p>
                   </div>
                  <p className="text-[9px] text-[#94918c] font-mono leading-relaxed pl-3 opacity-50">
                    Neural Engine: MDPI_0.82hz<br/>
                    Status: Nominal
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Capture Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 z-40">
        <button 
          className={cn(
            "group relative w-24 h-24 rounded-full border border-[rgba(197,160,89,0.3)] flex items-center justify-center transition-all active:scale-95",
            mode === 'photo' ? "bg-transparent" : "bg-transparent"
          )}
          onClick={() => alert(`Sequence Initiated: ${mode}`)}
        >
          <div className={cn(
            "rounded-full transition-all duration-500",
            mode === 'photo' ? "w-16 h-16 bg-[#c5a059] group-hover:scale-90" : "w-12 h-12 bg-red-800 group-hover:scale-110"
          )} />
          <div className="absolute inset-0 rounded-full border border-[#c5a059] animate-[ping_3s_infinite] opacity-5 pointer-events-none" />
          <div className="absolute -inset-4 border border-[rgba(197,160,89,0.1)] rounded-full rotate-45 scale-75 group-hover:scale-100 transition-transform duration-700" />
        </button>
        <span className="text-[#94918c] text-[9px] font-bold tracking-[0.5em] uppercase pl-2">Sync Sequence</span>
      </div>

      {/* History Shortcut */}
      <div className="absolute left-12 bottom-12 z-40">
        <button className="w-14 h-14 rounded-full bg-[#141416]/70 backdrop-blur-xl border border-[rgba(197,160,89,0.2)] flex items-center justify-center text-[#c5a059] hover:bg-[#c5a059] hover:text-black transition-all">
          <HistoryIcon size={24} />
        </button>
      </div>

    </div>
  );
}
