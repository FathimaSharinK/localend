"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  where,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TaskChatMessage, UserRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { 
  X, 
  Send, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Volume2, 
  Sparkles, 
  MessageSquare,
  Clock,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskChatModalProps {
  requestId: string;
  taskTitle: string;
  otherPartyName: string;
  otherPartyRole?: string;
  onClose: () => void;
}

export default function TaskChatModal({
  requestId,
  taskTitle,
  otherPartyName,
  otherPartyRole = 'Partner',
  onClose
}: TaskChatModalProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<TaskChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio playback state
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording]);

  // Firestore Real-time listener for chat messages
  useEffect(() => {
    if (!requestId) return;

    const messagesQuery = query(
      collection(db, 'helpRequests', requestId, 'chatMessages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as TaskChatMessage));
      setMessages(fetched);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching task messages:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requestId]);

  // Auto-mark messages as read and clear unread counters when modal is open
  useEffect(() => {
    if (!requestId || !user?.uid) return;

    const markRead = async () => {
      try {
        // 1. Reset unreadCounts on helpRequests doc
        await updateDoc(doc(db, 'helpRequests', requestId), {
          [`unreadCounts.${user.uid}`]: 0
        }).catch(() => {});

        // 2. Reset unreadCounts on helpTasks
        const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', requestId)));
        for (const td of tasksSnap.docs) {
          await updateDoc(td.ref, {
            [`unreadCounts.${user.uid}`]: 0
          }).catch(() => {});
        }

        // 3. Mark unread chat notifications as read
        const notifsSnap = await getDocs(query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          where('relatedId', '==', requestId),
          where('read', '==', false)
        ));
        for (const nd of notifsSnap.docs) {
          await updateDoc(nd.ref, { read: true });
        }

        // 4. Mark all messages as readBy current user
        const msgsSnap = await getDocs(collection(db, 'helpRequests', requestId, 'chatMessages'));
        for (const md of msgsSnap.docs) {
          const mData = md.data();
          if (mData.senderId !== user.uid) {
            const readBy = Array.isArray(mData.readBy) ? mData.readBy : [];
            if (!readBy.includes(user.uid)) {
              await updateDoc(md.ref, {
                readBy: arrayUnion(user.uid)
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('Error marking messages as read:', err);
      }
    };

    markRead();
  }, [requestId, user?.uid, messages.length]);

  // Dispatch real-time notification & increment unread counter for recipient
  const dispatchNewMessageNotification = async (type: 'text' | 'voice', previewText: string) => {
    if (!requestId || !user) return;
    try {
      const reqRef = doc(db, 'helpRequests', requestId);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      
      const reqData = reqSnap.data();
      const recipientId = user.uid === reqData.requesterId ? reqData.selectedHelperId : reqData.requesterId;
      
      if (!recipientId) return;

      const preview = type === 'voice' ? '🎙️ Sent a voice note' : previewText.slice(0, 80);

      // Increment unread count on helpRequests
      await updateDoc(reqRef, {
        [`unreadCounts.${recipientId}`]: increment(1),
        lastMessage: preview,
        lastMessageSenderId: user.uid,
        lastMessageAt: new Date().toISOString()
      });

      // Update any helpTasks docs
      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', requestId)));
      for (const td of tasksSnap.docs) {
        await updateDoc(td.ref, {
          [`unreadCounts.${recipientId}`]: increment(1),
          lastMessage: preview
        });
      }

      // Create AppNotification in notifications collection
      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        title: `💬 New message from ${profile?.fullName || user.displayName || 'Partner'}`,
        message: preview,
        type: 'CHAT_MESSAGE',
        relatedId: requestId,
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Error updating unread count and sending notification:', err);
    }
  };

  // Cleanup media recording on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Send Text Message
  const handleSendText = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || !user || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'helpRequests', requestId, 'chatMessages'), {
        requestId,
        senderId: user.uid,
        senderName: profile?.fullName || 'Neighbor',
        senderRole: (profile?.role || 'user') as UserRole,
        type: 'text',
        text: content,
        readBy: [user.uid],
        createdAt: new Date().toISOString()
      });
      setInputText('');
      await dispatchNewMessageNotification('text', content);
    } catch (err) {
      console.error('Failed to send text message:', err);
    } finally {
      setSending(false);
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record voice notes.');
    }
  };

  // Cancel Recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  // Stop & Send Voice Note
  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !user) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const duration = recordingDuration;

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());

      // Convert Blob to Base64 Data URI
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        try {
          await addDoc(collection(db, 'helpRequests', requestId, 'chatMessages'), {
            requestId,
            senderId: user.uid,
            senderName: profile?.fullName || 'Neighbor',
            senderRole: (profile?.role || 'user') as UserRole,
            type: 'voice',
            audioData: base64Audio,
            audioDuration: duration,
            readBy: [user.uid],
            createdAt: new Date().toISOString()
          });
          await dispatchNewMessageNotification('voice', '🎙️ Voice note');
        } catch (sendErr) {
          console.error('Error saving voice note to Firestore:', sendErr);
        }
      };

      setIsRecording(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    };

    mediaRecorderRef.current.stop();
  };

  // Play / Pause Voice Note
  const handleTogglePlayAudio = (messageId: string, audioData?: string) => {
    if (!audioData) return;

    if (currentlyPlayingId === messageId) {
      audioPlayerRef.current?.pause();
      setCurrentlyPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioData);
      audioPlayerRef.current = audio;
      setCurrentlyPlayingId(messageId);

      audio.play();
      audio.onended = () => {
        setCurrentlyPlayingId(null);
      };
      audio.onerror = () => {
        setCurrentlyPlayingId(null);
      };
    }
  };

  // Differentiate Quick Replies based on user's active role in this interaction
  const isEmployee = 
    profile?.role === 'employee' || 
    otherPartyRole?.toLowerCase().includes('requester') || 
    otherPartyRole?.toLowerCase().includes('citizen');

  const isAdmin = profile?.role === 'admin';

  // Citizen / Requester messages (asking ETA, directions, tools, PIN status)
  const citizenQuickReplies = [
    "When will you arrive? ⏱️",
    "I am at home / waiting 🏠",
    "Here is the landmark / directions 📍",
    "4-digit code is ready 🤝",
    "Please bring any needed tools 🧰",
    "Thank you for the quick help! 🙏"
  ];

  // Employee / Specialist messages (travel updates, arrival, PIN requests, completion)
  const employeeQuickReplies = [
    "I am on the way 🚗",
    "Arrived at the location 📍",
    "Almost finished with the work ⏱️",
    "Please share the 4-digit code 🤝",
    "Task completed, thank you! ✅"
  ];

  // Admin Dispatcher messages
  const adminQuickReplies = [
    "Admin Dispatch Update 📢",
    "Specialist has been dispatched 🚗",
    "Please confirm when arrived 📍",
    "Please provide the completion PIN 🤝"
  ];

  const quickReplies = isEmployee 
    ? employeeQuickReplies 
    : isAdmin 
      ? adminQuickReplies 
      : citizenQuickReplies;

  const quickBadgeTitle = isEmployee 
    ? "Specialist Quick:" 
    : isAdmin 
      ? "Admin Quick:" 
      : "Citizen Quick:";

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col h-[600px] max-h-[90vh] overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {otherPartyName.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-900 truncate">{otherPartyName}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 uppercase">
                  {otherPartyRole}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                <span>Task: {taskTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Connecting to task chat...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">No messages yet</p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Communicate directly with {otherPartyName} regarding arrival time, instructions, or voice updates!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                    <span>{isMe ? 'You' : msg.senderName}</span>
                    <span>•</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {msg.type === 'voice' ? (
                    // Voice Note Player Bubble
                    <div
                      className={cn(
                        "p-2.5 rounded-2xl flex items-center gap-3 border shadow-xs min-w-[200px]",
                        isMe
                          ? "bg-blue-600 text-white border-blue-500 rounded-br-xs"
                          : "bg-white text-slate-900 border-slate-200 rounded-bl-xs"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleTogglePlayAudio(msg.id!, msg.audioData)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs",
                          isMe
                            ? "bg-white text-blue-600"
                            : "bg-blue-600 text-white"
                        )}
                      >
                        {currentlyPlayingId === msg.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5" /> Voice Note
                          </span>
                          <span>{formatSeconds(msg.audioDuration || 0)}</span>
                        </div>
                        {/* Audio wave simulation bars */}
                        <div className="flex items-center gap-0.5 mt-1 h-3">
                          {[40, 70, 100, 60, 30, 80, 50, 90, 45, 65, 35].map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h}%` }}
                              className={cn(
                                "w-1 rounded-full transition-all",
                                isMe ? "bg-white/70" : "bg-blue-600/70",
                                currentlyPlayingId === msg.id ? "animate-pulse" : ""
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Regular Text Message Bubble
                    <div
                      className={cn(
                        "px-3.5 py-2 rounded-2xl text-xs leading-relaxed border shadow-xs break-words max-w-full",
                        isMe
                          ? "bg-blue-600 text-white border-blue-600 rounded-br-xs"
                          : "bg-white text-slate-900 border-slate-200 rounded-bl-xs"
                      )}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Recording Active Bar */}
        {isRecording && (
          <div className="p-3 bg-rose-50 border-t border-rose-200 flex items-center justify-between animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span>Recording Voice Note:</span>
              <span className="font-mono text-sm font-bold text-rose-800">{formatSeconds(recordingDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1"
              >
                <Square className="w-3 h-3 fill-current" /> Stop & Send
              </button>
            </div>
          </div>
        )}

        {/* Quick Pre-defined Replies Bar (Ergonomically positioned above the input field) */}
        {!isRecording && (
          <div className="px-3 py-2 bg-slate-50/90 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-slate-500 font-semibold shrink-0 flex items-center gap-1 pr-0.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{quickBadgeTitle}</span>
            </span>
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendText(reply)}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200/90 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/40 transition-all shrink-0 shadow-2xs font-medium cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        {!isRecording && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
            className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type instructions or message..."
              className="flex-1 h-9 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />

            {/* Voice Record Button */}
            <button
              type="button"
              onClick={startRecording}
              title="Record Voice Note"
              className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 text-slate-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send Text Button */}
            <Button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="h-9 w-9 p-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
