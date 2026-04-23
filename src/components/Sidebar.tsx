import React, { useState } from 'react';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Globe,
  X,
  Users,
  PieChart,
  Calendar,
  MessageSquareText,
  Shield,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfileModal } from './UserProfileModal';

interface SidebarProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ className, isOpen, onClose }: SidebarProps) {
  const { language, setLanguage, t } = useLanguage();
  const { currentTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navItems = React.useMemo(() => {
    const items = [
      { name: t.overview, icon: LayoutDashboard, path: '/' },
      { name: t.clients, icon: Users, path: '/clients' },
      { name: t.loans, icon: Landmark, path: '/loans' },
      { name: t.calendar, icon: Calendar, path: '/calendar' },
      { name: t.payments, icon: Wallet, path: '/payments' },
      { name: t.supportCenter, icon: MessageSquareText, path: '/support' },
      { name: t.financial, icon: BarChart3, path: '/financial' },
      { name: t.analytics, icon: PieChart, path: '/analytics' },
      { name: t.settings, icon: Settings, path: '/settings' },
    ];

    if (profile?.is_admin) {
      items.splice(1, 0, { name: t.adminPanel, icon: Shield, path: '/admin' });
    }

    return items;
  }, [t, profile]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed left-0 top-0 h-[100dvh] overflow-y-auto bg-white border-r border-slate-100 p-6 z-[70] transition-transform duration-300 ease-in-out lg:translate-x-0 w-72 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <div className="flex items-center justify-between mb-10 shrink-0">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-100">
              <Landmark className="text-white size-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Emerald Pro</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-600">
            <X className="size-6" />
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-2 mb-6">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                if (item.path !== '#') {
                  const state =
                    item.path === '/settings'
                      ? { activeTab: item.name === 'Planos & Assinatura' ? 'billing' : 'profile' }
                      : undefined;

                  navigate(item.path, { state });
                  onClose();
                }
              }}
              className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium w-full text-left',
                location.pathname === item.path
                  ? 'bg-primary-50 text-primary-600 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-primary-500'
              )}
            >
              <item.icon
                className={cn(
                  'size-5',
                  location.pathname === item.path
                    ? 'text-primary-600'
                    : 'text-slate-400 group-hover:text-primary-500'
                )}
              />
              {item.name}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100 space-y-4 shrink-0">
          <div className="px-4 py-2">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Globe className="size-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.language}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded-md transition-all flex-1 text-center',
                  language === 'en' ? 'bg-primary-500 text-white' : 'bg-slate-50 text-slate-400'
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('pt')}
                className={cn(
                  'text-[10px] font-bold px-2 py-1 rounded-md transition-all flex-1 text-center',
                  language === 'pt' ? 'bg-primary-500 text-white' : 'bg-slate-50 text-slate-400'
                )}
              >
                PT-BR
              </button>
            </div>
          </div>

          <div
            onClick={() => setIsProfileOpen(true)}
            className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-all border border-transparent hover:border-primary-100"
          >
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0 ring-2 ring-transparent">
              <img
                src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}&background=10b981&color=fff`}
                alt="User"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">
                {user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.safeAccount}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t.confirmLogout)) {
                  signOut();
                }
              }}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title={t.logout}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
