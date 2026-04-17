import React, { useState } from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfileModal } from './UserProfileModal';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5">
        <div className="flex items-center gap-4 shrink-0">
          <button onClick={onMenuClick} className="lg:hidden p-2 text-slate-500">
            <Menu className="size-6" />
          </button>
          <h1 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900 truncate max-w-[150px] sm:max-w-none">{title}</h1>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-6 flex-1 justify-end">
          <div className="hidden xl:flex items-center bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
            <Search className="size-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent border-none focus:ring-0 text-sm w-32 xl:w-64 text-slate-600 placeholder:text-slate-400 font-medium" 
            />
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3">
            {children}
            <button className="p-2 lg:p-2.5 rounded-xl hover:bg-slate-50 text-slate-400 transition-colors relative">
              <Bell className="size-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-white" />
            </button>
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 pr-2 rounded-xl transition-all"
              id="user-profile-trigger"
              onClick={() => setIsProfileOpen(true)}
            >
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900 leading-none">{user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase mt-1">Emerald Member</span>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl overflow-hidden shadow-sm border border-slate-100 ring-2 ring-transparent hover:ring-primary-100 transition-all">
                <img 
                  src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}&background=10b981&color=fff`} 
                  alt="User" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <UserProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </>
  );
}
