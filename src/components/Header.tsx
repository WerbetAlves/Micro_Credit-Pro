import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { NotificationsPopover, Notification } from './NotificationsPopover';
import { buildDashboardNotifications } from '../lib/dashboardNotifications';

const UserProfileModal = lazy(() =>
  import('./UserProfileModal').then((module) => ({ default: module.UserProfileModal }))
);

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const readStorageKey = user ? `emerald_notifications_read_${user.id}` : 'emerald_notifications_read_guest';

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

  useEffect(() => {
    if (!user || typeof (supabase as any).channel !== 'function') return;

    const channel = (supabase as any)
      .channel(`dashboard-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'installments' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchNotifications())
      .subscribe();

    return () => {
      if (typeof (supabase as any).removeChannel === 'function') {
        (supabase as any).removeChannel(channel);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(() => {
      fetchNotifications();
    }, 60000);

    const handleFocus = () => {
      fetchNotifications();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;

    const readIds = JSON.parse(localStorage.getItem(readStorageKey) || '[]') as string[];

    const [{ data: installments }, { data: loans }, { data: clients }, { data: supportTickets }] = await Promise.all([
      supabase
        .from('installments')
        .select('id, due_date, amount, status, loans!inner(user_id, clients(full_name))')
        .eq('loans.user_id', user.id),
      supabase
        .from('loans')
        .select('id, principal_amount, status, created_at, clients(full_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('clients')
        .select('id, full_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('support_tickets')
        .select('id, subject, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const mapped = buildDashboardNotifications({
      installments: (installments || []) as any,
      loans: (loans || []) as any,
      clients: (clients || []) as any,
      supportTickets: (supportTickets || []) as any,
      readIds,
    });

    setNotifications(mapped);
  }

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    const current = new Set(JSON.parse(localStorage.getItem(readStorageKey) || '[]'));
    current.add(id);
    localStorage.setItem(readStorageKey, JSON.stringify(Array.from(current)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    localStorage.setItem(readStorageKey, JSON.stringify(notifications.map((notification) => notification.id)));
  };

  const clearAll = async () => {
    if (!user) return;
    localStorage.setItem(readStorageKey, JSON.stringify(notifications.map((notification) => notification.id)));
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleSearchSubmit = () => {
    const query = searchTerm.trim();

    if (!query) return;

    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleOpenNotification = (notification: Notification) => {
    const route = (notification as Notification & { route?: string }).route || '/activity';
    setIsNotificationsOpen(false);
    navigate(route);
  };

  const handleViewAllActivity = () => {
    setIsNotificationsOpen(false);
    navigate('/activity');
  };

  useEffect(() => {
    if (!location.pathname.startsWith('/search')) {
      return;
    }

    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('q') || '');
  }, [location.pathname, location.search]);

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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
              placeholder="Search..." 
              className="bg-transparent border-none focus:ring-0 text-sm w-32 xl:w-64 text-slate-600 placeholder:text-slate-400 font-medium" 
            />
            <button
              onClick={handleSearchSubmit}
              className="ml-2 text-[10px] font-black uppercase tracking-widest text-primary-600"
            >
              Ir
            </button>
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
                onOpenNotification={handleOpenNotification}
                onViewAll={handleViewAllActivity}
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

      {isProfileOpen && (
        <Suspense fallback={null}>
          <UserProfileModal 
            isOpen={isProfileOpen} 
            onClose={() => setIsProfileOpen(false)} 
          />
        </Suspense>
      )}
    </>
  );
}
