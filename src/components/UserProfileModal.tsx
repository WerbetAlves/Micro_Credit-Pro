import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  User as UserIcon, 
  Sparkles, 
  Palette,
  Check,
  Zap,
  RefreshCw,
  Upload
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { currentTheme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // Referência para acionar o input de arquivo oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
      setAvatarUrl(user.user_metadata?.avatar_url || '');
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { 
          username,
          avatar_url: avatarUrl
        }
      });
      
      if (error) {
        if (error.message.includes('Auth session missing')) {
          console.warn('Supabase session missing. Simulating update for UI.');
          onClose();
          return;
        }
        throw error;
      }
      
      onClose();
    } catch (err: any) {
      console.error('Profile Save Error:', err.message);
      if (err.message.includes('not configured')) {
         onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // Função reescrita: Gera um avatar estilizado baseado no nome do usuário
  const generateAIAvatar = async () => {
    setAiLoading(true);
    try {
      // Simula um tempo de "geração" para feedback visual
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Usa um serviço de avatares divertido e gratuito (Dicebear) usando o nome do usuário ou um valor aleatório
      const seed = username || user?.email || Math.random().toString();
      // Usando o estilo 'bottts' (robôs) ou 'adventurer'
      const newAvatar = `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f1f5f9`;
      
      setAvatarUrl(newAvatar);
    } catch (err: any) {
      console.error('AI Avatar Error:', err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Nova Função: Lida com o upload do arquivo para o Supabase Storage
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadLoading(true);
    try {
      // 1. Cria um nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 2. Faz o upload para o bucket 'avatars' no Supabase
      const { error: uploadError } = await supabase.storage
        .from('avatars') // ATENÇÃO: Você precisa ter um bucket chamado 'avatars' no Supabase
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Pega a URL pública da imagem recém-enviada
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 4. Atualiza o estado da imagem na tela
      setAvatarUrl(data.publicUrl);
    } catch (error: any) {
      console.error('Erro no upload de imagem:', error.message);
      alert('Erro ao enviar imagem. Verifique se o bucket "avatars" existe no Supabase.');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
          >
            {/* Header / Banner */}
            <div className="h-32 bg-gradient-to-r from-primary-500 to-primary-700 relative">
               <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-all">
                  <X className="size-5" />
               </button>
            </div>

            <div className="px-8 pb-10 -mt-16 relative space-y-8">
               {/* Avatar Section */}
               <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="size-32 rounded-[2.5rem] bg-white p-2 shadow-xl ring-4 ring-primary-50">
                       <div className="w-full h-full rounded-[2.1rem] overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-100 relative">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon className="size-12 text-slate-300" />
                          )}
                          
                          {/* Overlay de carregamento para upload */}
                          {uploadLoading && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                               <RefreshCw className="size-6 text-primary-500 animate-spin" />
                            </div>
                          )}
                       </div>
                    </div>
                    
                    {/* Botão de gerar avatar IA movido ligeiramente para a direita */}
                    <button 
                      onClick={generateAIAvatar}
                      disabled={aiLoading || uploadLoading}
                      title="Gerar Avatar Automático"
                      className="absolute -bottom-2 -right-4 p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all group disabled:opacity-50"
                    >
                      {aiLoading ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4 group-hover:rotate-12 transition-all" />}
                    </button>

                    {/* Novo Botão: Fazer upload de foto */}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadLoading || aiLoading}
                      title="Carregar minha foto"
                      className="absolute -bottom-2 -left-4 p-3 bg-primary-500 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Upload className="size-4" />
                    </button>
                    {/* Input de arquivo invisível */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />

                  </div>
                  <div className="text-center">
                     <h3 className="text-xl font-black text-slate-900">{username}</h3>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{user?.email}</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Info Part */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.username}</label>
                      <div className="relative">
                         <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                         <input 
                            type="text" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Seu nome"
                            className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-primary-100 outline-none"
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                       {/* O botão "Gerar por IA" grande foi mantido, mas você agora tem a opção da câmera também */}
                       <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLoading}
                        className="w-full flex items-center justify-center gap-3 py-4 border-2 border-primary-100 border-dashed rounded-2xl hover:bg-primary-50 transition-all text-primary-600 font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                       >
                         {uploadLoading ? <RefreshCw className="size-4 animate-spin" /> : <Camera className="size-4" />}
                         CARREGAR FOTO
                       </button>
                       <p className="text-center text-[8px] text-slate-400 font-bold uppercase tracking-widest">Formatos aceitos: JPG, PNG</p>
                    </div>
                  </div>

                  {/* Themes Part */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Palette className="size-4 text-primary-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.colorCustomization}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                       {THEMES.map(theme => (
                         <button
                           key={theme.id}
                           onClick={() => setTheme(theme.id)}
                           className={cn(
                             "size-10 rounded-xl transition-all relative flex items-center justify-center ring-offset-2",
                             currentTheme.id === theme.id ? "ring-2 ring-primary-500 scale-110" : "hover:scale-105"
                           )}
                           style={{ backgroundColor: theme.shades[500] }}
                         >
                           {currentTheme.id === theme.id && <Check className="size-4 text-white" />}
                         </button>
                       ))}
                    </div>
                    <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100">
                       <p className="text-[9px] font-bold text-primary-700 leading-tight">
                         O tema selecionado altera globalmente botões, ícones e destaques do Emerald Pro.
                       </p>
                    </div>
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-50 flex gap-4">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={loading || uploadLoading}
                    className="flex-2 py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? t.processing : t.save}
                  </button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}