import React from 'react';
import { CheckCircle2, Circle, Wallet, Users, Calculator, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface OnboardingChecklistProps {
  hasWallets: boolean;
  hasClients: boolean;
  hasLoans: boolean;
}

export function OnboardingChecklist({ hasWallets, hasClients, hasLoans }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  
  const steps = [
    {
      id: 'wallet',
      title: 'Definir Capital Inicial',
      description: 'Crie uma carteira e adicione o saldo que você tem disponível para emprestar.',
      icon: Wallet,
      completed: hasWallets,
      action: () => navigate('/financial'),
      btnLabel: 'Criar Carteira'
    },
    {
      id: 'client',
      title: 'Cadastrar seu Primeiro Cliente',
      description: 'Adicione as informações básicas de quem vai receber o crédito.',
      icon: Users,
      completed: hasClients,
      action: () => navigate('/clients'),
      btnLabel: 'Cadastrar Cliente'
    },
    {
      id: 'loan',
      title: 'Realizar sua Primeira Operação',
      description: 'Use o simulador para efetivar o empréstimo e gerar as parcelas.',
      icon: Calculator,
      completed: hasLoans,
      action: () => {
        const element = document.getElementById('issue-new-credit');
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      btnLabel: 'Simular Agora'
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  if (hasLoans && hasClients && hasWallets) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-emerald-100 rounded-[2.5rem] p-6 lg:p-10 shadow-xl shadow-emerald-50/50 space-y-8 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
        <CheckCircle2 className="size-48 text-emerald-600 rotate-12" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            <Zap className="size-3" />
            Guia de Início Rápido
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900">Prepare sua operação em 3 passos</h2>
          <p className="text-slate-500 font-medium max-w-lg">
            Finalize a configuração inicial para começar a gerenciar seus empréstimos com inteligência.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-sm font-bold text-slate-400">Progresso do Setup</span>
          <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-500"
            />
          </div>
          <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{completedCount} de {steps.length} concluídos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={cn(
              "group p-6 rounded-3xl border transition-all duration-300",
              step.completed 
                ? "bg-slate-50 border-transparent grayscale opacity-60" 
                : "bg-white border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/20"
            )}
          >
            <div className="flex items-start justify-between mb-6">
              <div className={cn(
                "p-3 rounded-2xl transition-colors",
                step.completed ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600"
              )}>
                <step.icon className="size-6" />
              </div>
              {step.completed ? (
                <CheckCircle2 className="size-6 text-emerald-500" />
              ) : (
                <Circle className="size-6 text-slate-200" />
              )}
            </div>

            <div className="space-y-2 mb-6">
              <h3 className="font-bold text-slate-900">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
            </div>

            {!step.completed && (
              <button 
                onClick={step.action}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-600 text-white py-3 rounded-xl text-xs font-bold transition-all transform active:scale-95 group/btn"
              >
                {step.btnLabel}
                <ArrowRight className="size-3 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Zap({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
