import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BrainCircuit, 
  Send, 
  Bot, 
  User as UserIcon, 
  Sparkles, 
  X,
  MessageSquareText,
  Zap
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistantDashboard() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: t.aiWelcome }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const tools = [
        {
          functionDeclarations: [
            {
              name: "update_client_status",
              parameters: {
                type: "OBJECT",
                description: "Updates the status of a client (active, inactive, blocked).",
                properties: {
                  clientName: { type: "STRING", description: "The name of the client to update." },
                  newStatus: { type: "STRING", description: "The new status for the client (active, inactive, blocked)." }
                },
                required: ["clientName", "newStatus"]
              }
            },
            {
              name: "update_loan_status",
              parameters: {
                type: "OBJECT",
                description: "Updates the status of a loan (pending, active, repaid, default).",
                properties: {
                  clientName: { type: "STRING", description: "The name of the client associated with the loan." },
                  newStatus: { type: "STRING", description: "The new status for the loan (pending, active, repaid, default)." }
                },
                required: ["clientName", "newStatus"]
              }
            },
            {
              name: "adjust_wallet_balance",
              parameters: {
                type: "OBJECT",
                description: "Adjusts the balance of a specific wallet (Main Portfolio, Cash, etc.).",
                properties: {
                  walletName: { type: "STRING", description: "The name of the wallet to adjust." },
                  newBalance: { type: "NUMBER", description: "The new total balance for the wallet." }
                },
                required: ["walletName", "newBalance"]
              }
            }
          ]
        }
      ];

      // Fetch some context from DB to make it "Deep Analysis"
      const { data: loans } = await supabase.from('loans').select('principal_amount, status');
      const { data: installments } = await supabase.from('installments').select('amount, status');
      const { data: wallets } = await supabase.from('wallets').select('name, balance, type');

      const statsContext = {
        totalLoans: loans?.length || 0,
        totalCapital: loans?.reduce((acc, l) => acc + Number(l.principal_amount), 0) || 0,
        lateAmount: installments?.filter(i => i.status === 'late').reduce((acc, i) => acc + Number(i.amount), 0) || 0,
        wallets: wallets || []
      };

      const systemInstruction = `
        Você é o Consultor Emerald, um especialista em microcrédito e gestão financeira. 
        Você está conversando com o dono de uma empresa de empréstimos.
        
        Sua missão é:
        1. Analisar dados e dar conselhos estratégicos sobre inadimplência e capital.
        2. EXECUTAR AÇÕES (bloquear clientes, atualizar status ou JUSTAR SALDOS) se o usuário pedir.
        
        Contexto do negócio:
        - Total de empréstimos: ${statsContext.totalLoans}
        - Capital investido: R$${statsContext.totalCapital}
        - Valor em atraso: R$${statsContext.lateAmount}
        - Carteiras Atuais: ${JSON.stringify(statsContext.wallets)}
        
        IMPORTANTE: Quando o usuário pedir para alterar saldo (ex: "Lance 5000 reais na carteira principal"), use adjust_wallet_balance.
        Sempre fale em Português-BR.
      `;

      const chatMessages = [
        ...messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: chatMessages as any,
        config: {
          systemInstruction,
          tools: tools as any
        }
      });
      
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        let executionResult = "";
        
        if (call.name === 'update_client_status') {
          const { clientName, newStatus } = call.args as any;
          
          const { data: clients } = await supabase
            .from('clients')
            .select('id')
            .ilike('full_name', `%${clientName}%`)
            .limit(1);

          if (clients?.[0]) {
            const { error } = await supabase
              .from('clients')
              .update({ status: newStatus })
              .eq('id', clients[0].id);
            
            executionResult = error 
              ? `Erro ao atualizar cliente: ${error.message}` 
              : `Status do cliente ${clientName} atualizado para ${newStatus} com sucesso.`;
          } else {
            executionResult = `Cliente "${clientName}" não encontrado no sistema.`;
          }
        }

        if (call.name === 'update_loan_status') {
          const { clientName, newStatus } = call.args as any;
          
          const { data: clients } = await supabase
            .from('clients')
            .select('id')
            .ilike('full_name', `%${clientName}%`)
            .limit(1);

          if (clients?.[0]) {
            const { data: loanData } = await supabase
              .from('loans')
              .select('id')
              .eq('client_id', clients[0].id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (loanData?.[0]) {
              const { error } = await supabase
                .from('loans')
                .update({ status: newStatus })
                .eq('id', loanData[0].id);
              
              executionResult = error 
                ? `Erro ao atualizar empréstimo: ${error.message}` 
                : `Status do empréstimo de ${clientName} atualizado para ${newStatus}.`;
            } else {
              executionResult = `Nenhum empréstimo encontrado para ${clientName}.`;
            }
          } else {
            executionResult = `Cliente "${clientName}" não encontrado.`;
          }
        }

        if (call.name === 'adjust_wallet_balance') {
          const { walletName, newBalance } = call.args as any;
          
          const { data: wallets } = await supabase
            .from('wallets')
            .select('id')
            .ilike('name', `%${walletName}%`)
            .limit(1);

          if (wallets?.[0]) {
            const { error } = await supabase
              .from('wallets')
              .update({ balance: newBalance })
              .eq('id', wallets[0].id);
            
            executionResult = error 
              ? `Erro ao ajustar carteira: ${error.message}` 
              : `Saldo da carteira "${walletName}" ajustado para ${newBalance} com sucesso.`;
          } else {
            executionResult = `Carteira "${walletName}" não encontrada.`;
          }
        }

        // Get final response after execution
        const finalResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            ...chatMessages,
            { role: 'model', parts: [{ functionCall: call }] },
            { role: 'user', parts: [{ functionResponse: { name: call.name, response: { content: executionResult } } }] }
          ] as any,
          config: { systemInstruction }
        });
        
        setMessages(prev => [...prev, { role: 'assistant', content: finalResponse.text || "Operação concluída." }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text || "Desculpe, tive um problema ao processar sua solicitação." }]);
      }

    } catch (err: any) {
      console.error('Gemini Error:', err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: "Houve um erro técnico ao consultar a inteligência. Verifique sua conexão ou chave de API." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Promotion Card */}
      <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl shadow-slate-200 group">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/20 rounded-xl">
                <BrainCircuit className="size-5 text-emerald-400" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Deep AI Strategy</span>
          </div>
          <h3 className="text-lg lg:text-xl font-bold tracking-tight">{t.smartAssistant}</h3>
          <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-[280px]">
            {t.talkToAi}
          </p>
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <MessageSquareText className="size-4" />
            {t.deepAnalysis}
          </button>
        </div>
        <Sparkles className="absolute -bottom-10 -right-10 size-48 opacity-5 group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
      </div>

      {/* Chat Interface (Slide-over/Floating) */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              className="fixed right-0 bottom-0 top-0 sm:right-4 sm:bottom-4 sm:top-4 w-full sm:max-w-[450px] bg-white sm:rounded-[2.5rem] shadow-2xl z-[101] flex flex-col overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-slate-900 flex items-center justify-center">
                    <BrainCircuit className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{t.smartAssistant}</h4>
                    <div className="flex items-center gap-1.5">
                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IA Consultora Ativa</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Chat Body */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
              >
                {messages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0",
                      msg.role === 'assistant' ? "bg-slate-900 text-emerald-400" : "bg-emerald-500 text-white"
                    )}>
                      {msg.role === 'assistant' ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
                    </div>
                    <div className={cn(
                      "p-4 rounded-[1.5rem] text-sm leading-relaxed",
                      msg.role === 'assistant' 
                        ? "bg-slate-50 text-slate-700 font-medium" 
                        : "bg-emerald-500 text-white font-bold"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="size-8 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center">
                       <Bot className="size-4" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-[1.5rem] flex items-center gap-2">
                      <div className="size-1 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="size-1 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="size-1 bg-slate-300 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-white border-t border-slate-100">
                 <form onSubmit={handleSendMessage} className="relative">
                    <input 
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t.askQuestion}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-6 pr-14 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                    />
                    <button 
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Zap className="size-4 text-emerald-400" />
                    </button>
                 </form>
                 <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-4">
                    Powered by Google Gemini 3 Flash
                 </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
