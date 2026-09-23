"use client";

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskChatButtonProps {
  requestId?: string;
  onClick: () => void;
  className?: string;
  label?: string;
  showLabel?: boolean;
  variant?: 'cyan' | 'blue' | 'white' | 'rose';
}

export default function TaskChatButton({
  requestId,
  onClick,
  className,
  label = 'Chat & Voice',
  showLabel = false,
  variant = 'white'
}: TaskChatButtonProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!requestId || !user?.uid) {
      setUnreadCount(0);
      return;
    }

    // 1. Listen to chatMessages subcollection for unread messages sent by the other party
    const messagesUnsub = onSnapshot(
      collection(db, 'helpRequests', requestId, 'chatMessages'),
      (snapshot) => {
        let count = 0;
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.senderId !== user.uid) {
            const readBy = Array.isArray(data.readBy) ? data.readBy : [];
            if (!readBy.includes(user.uid)) {
              count++;
            }
          }
        });
        setUnreadCount(count);
      },
      (err) => console.warn('Error listening to chat unread count:', err)
    );

    // 2. Also listen to helpRequests doc unreadCounts as fallback
    const reqUnsub = onSnapshot(
      doc(db, 'helpRequests', requestId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const docUnread = data.unreadCounts?.[user.uid] || 0;
          if (docUnread > 0) {
            setUnreadCount((prev) => Math.max(prev, docUnread));
          }
        }
      },
      (err) => console.warn('Error listening to request unread counts:', err)
    );

    return () => {
      messagesUnsub();
      reqUnsub();
    };
  }, [requestId, user?.uid]);

  const variantStyles = {
    cyan: "bg-white text-cyan-700 border border-cyan-300 hover:bg-cyan-100/70 hover:text-cyan-800 shadow-2xs",
    blue: "bg-blue-600 text-white hover:bg-blue-700 shadow-2xs",
    white: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs",
    rose: "bg-white text-rose-700 border border-rose-300 hover:bg-rose-100/70 hover:text-rose-800 shadow-2xs"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-center h-7 w-7 rounded-lg transition-all cursor-pointer select-none active:scale-95 shrink-0",
        variantStyles[variant],
        showLabel && "w-auto px-2.5 gap-1.5",
        className
      )}
    >
      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
      {showLabel && <span>{label}</span>}

      {/* Floating Unread Badge on Top Right */}
      {unreadCount > 0 && (
        <span 
          aria-label={`${unreadCount} unread messages`}
          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse ring-2 ring-white z-20 pointer-events-none"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
