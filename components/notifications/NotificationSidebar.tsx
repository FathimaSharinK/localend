"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppNotification } from '@/types';
import { Bell, CheckCircle2, X, Check, ArrowRight, Sparkles, MessageSquare, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface NotificationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSidebar({ isOpen, onClose }: NotificationSidebarProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(
          doc => ({ id: doc.id, ...doc.data() } as AppNotification)
        );
        items.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to notifications:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (e: React.MouseEvent, notification: AppNotification) => {
    e.stopPropagation();
    if (!notification.id || notification.read) return;
    try {
      await updateDoc(doc(db, 'notifications', notification.id), { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (notification.id && !notification.read) {
      try {
        await updateDoc(doc(db, 'notifications', notification.id), { read: true });
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
    onClose();

    if (notification.type === 'SLA_BREACH') {
      if (profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@gmail.com') {
        router.push('/admin?tab=overview');
      } else if (profile?.role === 'employee') {
        router.push('/dashboard');
      } else {
        router.push('/tasks');
      }
    } else {
      router.push('/tasks');
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      await Promise.all(
        unread.map(n => updateDoc(doc(db, 'notifications', n.id!), { read: true }))
      );
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setIsClearing(true);
    try {
      await Promise.all(
        notifications.map(n => n.id ? deleteDoc(doc(db, 'notifications', n.id)) : Promise.resolve())
      );
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id?: string) => {
    e.stopPropagation();
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-label="Close notifications panel"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <aside 
          className="w-screen max-w-sm bg-white border-l border-slate-200 text-slate-900 shadow-xl flex flex-col animate-in slide-in-from-right duration-300"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Signal Feed</h2>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-600 text-white rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Real-time alerts & updates</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg h-7 w-7"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Subheader action */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium text-[11px]">
                {unreadCount > 0 ? (
                  <span className="text-blue-700 font-semibold">{unreadCount} unread signal{unreadCount > 1 ? 's' : ''}</span>
                ) : (
                  <span>{notifications.length} signal{notifications.length > 1 ? 's' : ''}</span>
                )}
              </span>
              <div className="flex items-center gap-2.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-xs"
                  >
                    Mark read
                  </button>
                )}
                {unreadCount > 0 && <span className="text-slate-300">|</span>}
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleClearAll}
                  className="font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer text-xs hover:underline disabled:opacity-50"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isClearing ? 'Clearing...' : 'Clear all'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-16 text-slate-400 space-y-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                <span className="text-xs font-medium">Synchronizing signals...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="mx-auto w-11 h-11 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 mb-0.5">Signals Clear</h3>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  No active notifications. Updates on offers and verification tokens will arrive here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "group relative p-3 rounded-xl border transition-all cursor-pointer flex gap-2.5 text-left",
                    notification.read
                      ? "bg-slate-50/50 border-slate-200/80 hover:border-slate-300 opacity-75"
                      : "bg-blue-50/40 border-blue-200 hover:border-blue-300 shadow-2xs"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    notification.type === 'SLA_BREACH'
                      ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse"
                      : notification.type === 'TASK_COMPLETED'
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : notification.type === 'OFFER_ACCEPTED'
                      ? "bg-purple-50 text-purple-600 border border-purple-100"
                      : notification.type === 'CHAT_MESSAGE'
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                      : "bg-blue-50 text-blue-600 border border-blue-100"
                  )}>
                    {notification.type === 'SLA_BREACH' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : notification.type === 'TASK_COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : notification.type === 'CHAT_MESSAGE' ? (
                      <MessageSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h4 className={cn(
                        "text-xs font-semibold truncate",
                        notification.read ? "text-slate-700" : "text-slate-900"
                      )}>
                        {notification.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {new Date(notification.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100/60">
                      <span className="text-[11px] text-blue-600 font-semibold inline-flex items-center gap-1 group-hover:underline">
                        Open task <ArrowRight className="w-3 h-3" />
                      </span>

                      <div className="flex items-center gap-1.5">
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(e, notification)}
                            className="text-[10px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 cursor-pointer"
                            title="Mark as read"
                          >
                            <Check className="w-2.5 h-2.5" /> Read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Unread indicator dot */}
                  {!notification.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
