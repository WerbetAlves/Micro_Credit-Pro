import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, Zap, Shield, Rocket, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface WelcomeAnimationProps {
  onComplete: () => void;
}

export function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const features = [
    {
      title: t.feature1Title,
      desc: t.feature1Desc,
      icon: <Zap className="size-8 text-emerald-500" />,
      color: "emerald"
    },
    {
      title: t.feature2Title,
      desc: t.feature2Desc,
      icon: <Landmark className="size-8 text-blue-500" />,
      color: "blue"
    },
    {
      title: t.feature3Title,
      desc: t.feature3Desc,
      icon: <Shield className="size-8 text-purple-500" />,
      color: "purple"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      if (step < features.length - 1) {
        setStep(s => s + 1);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [step, features.length]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-lg text-center">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -20 }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="space-y-8"
            >
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-12">
                  <Landmark className="size-12 text-white" />
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter">
                  {t.welcomeToEmerald}
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed max-w-md mx-auto">
                  {t.emeraldIntro}
                </p>
              </div>
            </motion.div>
          )}

          {step > 0 && step <= features.length && (
            <motion.div
              key={`feature-${step}`}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.6, ease: "anticipate" }}
              className="space-y-12"
            >
              <div className="flex justify-center">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center bg-white shadow-2xl relative overflow-hidden group`}>
                   <div className={`absolute inset-0 bg-${features[step-1].color}-500 opacity-10`} />
                   {features[step-1].icon}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {features[step-1].title}
                </h2>
                <p className="text-slate-400 text-lg">
                  {features[step-1].desc}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress indicators */}
        <div className="mt-16 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                step === i ? "w-12 bg-emerald-500" : "w-3 bg-slate-700"
              }`}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-6">
           {step < 3 ? (
             <button
               onClick={() => setStep(s => s + 1)}
               className="group flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
             >
               Próximo
               <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
             </button>
           ) : (
             <motion.button
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={onComplete}
               className="flex items-center gap-3 px-10 py-5 bg-emerald-500 text-white rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/40"
             >
               <Rocket className="size-5" />
               {t.getStarted}
             </motion.button>
           )}
           
           <button 
             onClick={onComplete}
             className="text-slate-500 hover:text-slate-400 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
           >
             <X className="size-3" />
             Pular Introdução
           </button>
        </div>
      </div>
    </div>
  );
}
