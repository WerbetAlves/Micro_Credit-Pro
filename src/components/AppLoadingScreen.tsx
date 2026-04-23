import { Landmark } from 'lucide-react';

interface AppLoadingScreenProps {
  label?: string;
}

export function AppLoadingScreen({ label = 'Carregando ambiente...' }: AppLoadingScreenProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/70 p-10 text-center">
          <div className="mx-auto mb-6 size-16 rounded-[1.5rem] bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
            <Landmark className="size-8" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Emerald Pro</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">{label}</p>

          <div className="mt-8 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full animate-pulse" />
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
            <div className="size-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
            <div className="size-2 rounded-full bg-emerald-300 animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
