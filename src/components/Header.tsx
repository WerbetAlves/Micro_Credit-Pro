import React, { useState, useEffect } from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { UserProfileModal } from './UserProfileModal';
import { NotificationsPopover, Notification } from './NotificationsPopover';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    }
    fetchProfile();
    fetchNotifications();
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setNotifications(data.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: new Date(n.created_at),
        isRead: n.is_read
      })));
    }
  }

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 lg:p-2.5 rounded-xl transition-all relative",
                  isNotificationsOpen ? "bg-primary-50 text-primary-600" : "hover:bg-slate-50 text-slate-400"
                )}
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>

              <NotificationsPopover 
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onClearAll={clearAll}
              />
            </div>

            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 pr-2 rounded-xl transition-all"
              id="user-profile-trigger"
              onClick={() => setIsProfileOpen(true)}
            >
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900 leading-none">{user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
                <span className="text-[10px] font-black text-emerald-600 uppercase mt-1 tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">
                  Plano {profile?.plan_type || 'Free'}
                </span>
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
