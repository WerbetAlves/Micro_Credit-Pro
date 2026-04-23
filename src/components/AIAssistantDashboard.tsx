import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BrainCircuit,
  Bot,
  User as UserIcon,
  Sparkles,
  X,
  MessageSquareText,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { requestAi, AiToolDefinition } from '../services/aiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type AiLoanSummary = {
  principal_amount: number;
  status: string;
};

type AiInstallmentSummary = {
  amount: number;
  status: string;
};

type AiWalletSummary = {
  name: string;
  balance: number;
  type: string;
};

export function AIAssistantDashboard() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: t.aiWelcome },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const tools: AiToolDefinition[] = [
    {
      type: 'function',
      name: 'update_client_status',
      description: 'Atualiza o status de um cliente.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Nome do cliente.' },
          newStatus: { type: 'string', description: 'Novo status: active, inactive, blocked.' },
        },
        required: ['clientName', 'newStatus'],
      },
    },
    {
      type: 'function',
      name: 'update_loan_status',
      description: 'Atualiza o status do empréstimo mais recente de um cliente.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Nome do cliente.' },
          newStatus: { type: 'string', description: 'Novo status: pending, active, repaid, default.' },
        },
        required: ['clientName', 'newStatus'],
      },
    },
    {
      type: 'function',
      name: 'adjust_wallet_balance',
      description: 'Ajusta o saldo total de uma carteira específica.',
      parameters: {
        type: 'object',
        properties: {
          walletName: { type: 'string', description: 'Nome da carteira.' },
          newBalance: { type: 'number', description: 'Novo saldo total da carteira.' },
        },
        required: ['walletName', 'newBalance'],
      },
    },
    {
      type: 'function',
      name: 'create_support_ticket',
      description: 'Cria um ticket de suporte quando o caso precisa de ajuda humana.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Assunto do ticket.' },
          description: { type: 'string', description: 'Descrição detalhada do problema.' },
          priority: { type: 'string', description: 'Prioridade: low, medium, high.' },
          category: { type: 'string', description: 'Categoria: technical, billing, feature, other.' },
        },
        required: ['subject', 'description'],
      },
    },
  ];

  const executeToolCall = async (name: string, args: Record<string, unknown>) => {
    if (!user) {
      return 'Usuário não autenticado.';
    }

    if (name === 'update_client_status') {
      const clientName = String(args.clientName || '');
      const newStatus = String(args.newStatus || '');

      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .ilike('full_name', `%${clientName}%`)
        .limit(1);

      if (!clients?.[0]) {
        return `Cliente "${clientName}" não encontrado no sistema.`;
      }

      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clients[0].id);

      return error
        ? `Erro ao atualizar cliente: ${error.message}`
        : `Status do cliente ${clientName} atualizado para ${newStatus} com sucesso.`;
    }

    if (name === 'update_loan_status') {
      const clientName = String(args.clientName || '');
      const newStatus = String(args.newStatus || '');

      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .ilike('full_name', `%${clientName}%`)
        .limit(1);

      if (!clients?.[0]) {
        return `Cliente "${clientName}" não encontrado.`;
      }

      const { data: loanData } = await supabase
        .from('loans')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_id', clients[0].id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!loanData?.[0]) {
        return `Nenhum empréstimo encontrado para ${clientName}.`;
      }

      const { error } = await supabase
        .from('loans')
        .update({ status: newStatus })
        .eq('id', loanData[0].id);

      return error
        ? `Erro ao atualizar empréstimo: ${error.message}`
        : `Status do empréstimo de ${clientName} atualizado para ${newStatus}.`;
    }

    if (name === 'adjust_wallet_balance') {
      const walletName = String(args.walletName || '');
      const newBalance = Number(args.newBalance || 0);

      const { data: wallets } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', `%${walletName}%`)
        .limit(1);

      if (!wallets?.[0]) {
        return `Carteira "${walletName}" não encontrada.`;
      }

      const { error } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallets[0].id);

      return error
        ? `Erro ao ajustar carteira: ${error.message}`
        : `Saldo da carteira "${walletName}" ajustado para ${newBalance} com sucesso.`;
    }

    if (name === 'create_support_ticket') {
      const subject = String(args.subject || 'Novo ticket');
      const description = String(args.description || '');
      const priority = String(args.priority || 'medium');
      const category = String(args.category || 'technical');

      const { error } = await supabase.from('support_tickets').insert([
        {
          user_id: user.id,
          subject,
          description,
          priority,
          category,
          status: 'open',
        },
      ]);

      if (!error) {
        window.dispatchEvent(new CustomEvent('support-ticket-created'));
      }

      return error
        ? `Erro ao criar ticket: ${error.message}`
        : `Ticket de suporte "${subject}" criado com sucesso. Nossa equipe técnica entrará em contato em breve.`;
    }

    return 'Ferramenta não suportada.';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !user) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { data: loans } = await supabase
        .from('loans')
        .select('principal_amount, status')
        .eq('user_id', user.id);

      const { data: installments } = await supabase
        .from('installments')
        .select('amount, status, loans!inner(user_id)')
        .eq('loans.user_id', user.id);

      const { data: wallets } = await supabase
        .from('wallets')
        .select('name, balance, type')
        .eq('user_id', user.id);

      const safeLoans = (loans || []) as AiLoanSummary[];
      const safeInstallments = (installments || []) as AiInstallmentSummary[];
      const safeWallets = (wallets || []) as AiWalletSummary[];

      const statsContext = {
        totalLoans: safeLoans.length,
        totalCapital: safeLoans.reduce((acc: number, loan) => acc + Number(loan.principal_amount), 0),
        lateAmount: safeInstallments
          .filter((item) => item.status === 'late')
          .reduce((acc: number, item) => acc + Number(item.amount), 0),
        wallets: safeWallets,
      };

      const systemInstruction = `
        Você é o Consultor Emerald, um especialista em microcrédito e gestão financeira.

        Sua missão é:
        1. Analisar dados e dar conselhos estratégicos sobre inadimplência e capital.
        2. Executar ações no sistema quando o usuário pedir.
        3. Prestar suporte sobre o uso do SaaS Emerald. Se a dúvida for técnica ou complexa demais, ofereça e use a ferramenta 'create_support_ticket'.

        Contexto do negócio:
        - Empresa/usuário: ${profile?.business_name || profile?.full_name || user.email || 'não identificado'}
        - Total de empréstimos: ${statsContext.totalLoans}
        - Capital investido: R$${statsContext.totalCapital}
        - Valor em atraso: R$${statsContext.lateAmount}
        - Carteiras atuais: ${JSON.stringify(statsContext.wallets)}

        Sempre responda em Português-BR.
      `;

      const firstResponse = await requestAi({
        mode: 'message',
        messages,
        userMessage,
        systemInstruction,
        tools,
      });

      if (firstResponse.type === 'function_call') {
        const executionResult = await executeToolCall(
          firstResponse.functionCall.name,
          firstResponse.functionCall.args
        );

        const finalResponse = await requestAi({
          mode: 'tool_result',
          previousResponseId: firstResponse.responseId,
          toolCallId: firstResponse.functionCall.id,
          toolResult: executionResult,
          systemInstruction,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              finalResponse.type === 'text' || finalResponse.type === 'message'
                ? finalResponse.text
                : executionResult,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: firstResponse.text,
          },
        ]);
      }
    } catch (err: any) {
      console.error('AI Error:', err.message);
      const friendlyMessage = err.message?.includes('OPENAI_API_KEY')
        ? 'A IA ainda não foi configurada no backend. Crie o arquivo `.env` na raiz do projeto e adicione `OPENAI_API_KEY=sua_chave_aqui`. Depois reinicie o servidor.'
        : `Houve um erro técnico ao consultar a inteligência. Detalhe: ${err.message || 'erro desconhecido'}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: friendlyMessage }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
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
            data-assistant-trigger
            className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <MessageSquareText className="size-4" />
            {t.deepAnalysis}
          </button>
        </div>
        <Sparkles className="absolute -bottom-10 -right-10 size-48 opacity-5 group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
      </div>

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
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-slate-900 flex items-center justify-center">
                    <BrainCircuit className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{t.smartAssistant}</h4>
                    <div className="flex items-center gap-1.5">
                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {t.aiConsulting || 'AI Consulting Active'}
                      </span>
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
                      'flex gap-3 max-w-[85%]',
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                    )}
                  >
                    <div
                      className={cn(
                        'size-8 rounded-full flex items-center justify-center shrink-0',
                        msg.role === 'assistant' ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-500 text-white'
                      )}
                    >
                      {msg.role === 'assistant' ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
                    </div>
                    <div
                      className={cn(
                        'p-4 rounded-[1.5rem] text-sm leading-relaxed',
                        msg.role === 'assistant'
                          ? 'bg-slate-50 text-slate-700 font-medium'
                          : 'bg-emerald-500 text-white font-bold'
                      )}
                    >
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
                  Powered by OpenAI + Gemini
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
