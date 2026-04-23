import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Check, 
  Trash2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  UserPlus,
  CreditCard
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

export interface Notification {
  id: string;
  type: 'payment' | 'loan' | 'client' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenNotification?: (notification: Notification) => void;
  onViewAll?: () => void;
}

export function NotificationsPopover({ 
  isOpen, 
  onClose, 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onClearAll,
  onOpenNotification,
  onViewAll,
}: NotificationsPopoverProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'pt' ? ptBR : enUS;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'payment': return <CreditCard className="size-4 text-emerald-500" />;
      case 'loan': return <TrendingUp className="size-4 text-blue-500" />;
      case 'client': return <UserPlus className="size-4 text-amber-500" />;
      case 'alert': return <AlertCircle className="size-4 text-red-500" />;
      default: return <Bell className="size-4 text-slate-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-[100] lg:hidden" 
            onClick={onClose} 
          />
          
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 mt-3 w-[calc(100vw-2rem)] sm:w-96 bg-white border border-slate-100 rounded-[2rem] shadow-2xl shadow-slate-200/50 z-[110] overflow-hidden origin-top-right"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{t.notificationTitle}</h3>
                {unreadCount > 0 && (
                  <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mt-0.5">
                    {unreadCount} {t.unreadNotifications}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <>
                    <button 
                      onClick={onMarkAllAsRead}
                      className="p-2 text-slate-400 hover:text-primary-500 transition-colors tooltip"
                      title={t.markAllAsRead}
                    >
                      <Check className="size-4" />
                    </button>
                    <button 
                      onClick={onClearAll}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[min(450px,70vh)] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) {
                          onMarkAsRead(n.id);
                        }
                        onOpenNotification?.(n);
                      }}
                      className={cn(
                        "p-5 flex gap-4 transition-all cursor-pointer group hover:bg-slate-50",
                        !n.isRead ? "bg-primary-50/30" : "bg-white"
                      )}
                    >
                      <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        !n.isRead ? "bg-white" : "bg-slate-50"
                      )}>
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            "text-sm tracking-tight",
                            !n.isRead ? "font-black text-slate-900" : "font-bold text-slate-700"
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap lowercase">
                            {formatDistanceToNow(n.timestamp, { addSuffix: true, locale: dateLocale })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="size-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300">
                    <Bell className="size-8" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{t.noNotifications}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Emerald Member</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-4 border-t border-slate-50">
                <button
                  onClick={onViewAll}
                  className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  {t.fullActivityLog}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
