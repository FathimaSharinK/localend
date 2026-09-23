"use client";

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { HelpRequest, HelpTask, HelpOffer } from '@/types';
import { Button } from '@/components/ui/Button';
import { 
  ClipboardList, 
  HandHeart, 
  MapPin, 
  CheckCircle2, 
  KeyRound, 
  Copy, 
  Check, 
  Pencil, 
  Trash2, 
  Star, 
  ShieldCheck, 
  X,
  MessageSquare,
  Navigation,
  Eye 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import HelpDetailModal from '@/components/requests/HelpDetailModal';
import CreateRequestModal from '@/components/requests/CreateRequestModal';
import ReviewModal from '@/components/reviews/ReviewModal';
import TaskChatModal from '@/components/chat/TaskChatModal';
import TaskChatButton from '@/components/chat/TaskChatButton';
import AppLayout from '@/components/layout/AppLayout';
import { sortByLatestScheduled } from '@/lib/sortUtils';
import { acceptHelpOffer } from '@/services/offers.service';
import { getGoogleMapsUrl, getRequestDistance, formatDistance } from '@/lib/distance';

interface EnrichedOffer {
  offer: HelpOffer;
  request?: HelpRequest;
}

export default function TasksPage() {
  const { user, profile } = useAuth();
  const isEmployee = profile?.role === 'employee';
  const isUser = profile?.role === 'user';
  const isAdmin = profile?.role === 'admin';

  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Silent auto-GPS check on page mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    }
  }, []);

  const [chatSession, setChatSession] = useState<{
    requestId: string;
    taskTitle: string;
    partnerName: string;
    partnerRole: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'my-requests' | 'helping'>(
    isEmployee ? 'helping' : 'my-requests'
  );

  useEffect(() => {
    if (isEmployee) setActiveTab('helping');
    if (isUser) setActiveTab('my-requests');
  }, [isEmployee, isUser]);
  
  const [myRequests, setMyRequests] = useState<HelpRequest[]>([]);
  const [helpingTasks, setHelpingTasks] = useState<HelpTask[]>([]);
  const [taskRequestsMap, setTaskRequestsMap] = useState<Record<string, HelpRequest>>({});
  const [myOffers, setMyOffers] = useState<EnrichedOffer[]>([]);
  const [incomingOffersByReqId, setIncomingOffersByReqId] = useState<Record<string, HelpOffer[]>>({});
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<HelpRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<HelpRequest | null>(null);
  
  // Review Modal State
  const [reviewItem, setReviewItem] = useState<{
    requestId?: string;
    taskId?: string;
    title: string;
    reviewerRole: 'requester' | 'helper';
    targetUserName?: string;
    targetUserId?: string;
  } | null>(null);

  // Helper Code Verification Modal State
  const [verifyingTask, setVerifyingTask] = useState<HelpTask | null>(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // 1. My Requests
    const reqQuery = query(
      collection(db, 'helpRequests'),
      where('requesterId', '==', user.uid)
    );
    const unsubReq = onSnapshot(reqQuery, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HelpRequest));
      setMyRequests(sortByLatestScheduled(items));
    }, (err) => console.warn('Tasks myRequests error:', err));

    // 2. Tasks where I am helper
    const taskQuery = query(
      collection(db, 'helpTasks'),
      where('helperId', '==', user.uid)
    );
    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HelpTask));
      setHelpingTasks(sortByLatestScheduled(items));
      setLoading(false);
    }, (err) => {
      console.warn('Tasks helpingTasks error:', err);
      setLoading(false);
    });

    // 3. My Pending Offers (Waiting for requester acceptance)
    const offersQuery = query(
      collection(db, 'helpOffers'),
      where('helperId', '==', user.uid)
    );
    const unsubOffers = onSnapshot(offersQuery, async (snapshot) => {
      const offerItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HelpOffer));
      const pendingOffers = offerItems.filter(o => o.status === 'PENDING');
      
      const enriched: EnrichedOffer[] = [];
      for (const off of pendingOffers) {
        try {
          const rDoc = await getDoc(doc(db, 'helpRequests', off.requestId));
          if (rDoc.exists()) {
            enriched.push({ offer: off, request: { id: rDoc.id, ...rDoc.data() } as HelpRequest });
          } else {
            enriched.push({ offer: off });
          }
        } catch (e) {
          enriched.push({ offer: off });
        }
      }
      setMyOffers(enriched);
    });

    // 4. Pending incoming offers for my requests
    const incomingQuery = query(
      collection(db, 'helpOffers'),
      where('status', '==', 'PENDING')
    );
    const unsubIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const map: Record<string, HelpOffer[]> = {};
      snapshot.docs.forEach((d) => {
        const off = { id: d.id, ...d.data() } as HelpOffer;
        if (!map[off.requestId]) {
          map[off.requestId] = [];
        }
        map[off.requestId].push(off);
      });
      setIncomingOffersByReqId(map);
    }, (err) => console.warn('Tasks incomingOffers error:', err));

    return () => {
      unsubReq();
      unsubTasks();
      unsubOffers();
      unsubIncoming();
    };
  }, [user]);

  // Prefetch full HelpRequest documents for helper missions so descriptions are always ready
  useEffect(() => {
    if (helpingTasks.length === 0) return;
    const reqIdsToFetch = Array.from(new Set(
      helpingTasks.map(t => t.requestId).filter(Boolean)
    ));

    let isMounted = true;
    const fetchRequests = async () => {
      const newEntries: Record<string, HelpRequest> = {};
      await Promise.all(
        reqIdsToFetch.map(async (reqId) => {
          try {
            const snap = await getDoc(doc(db, 'helpRequests', reqId));
            if (snap.exists()) {
              newEntries[reqId] = { id: snap.id, ...snap.data() } as HelpRequest;
            }
          } catch (e) {
            console.warn('Could not fetch request for task:', reqId, e);
          }
        })
      );
      if (isMounted && Object.keys(newEntries).length > 0) {
        setTaskRequestsMap(prev => ({ ...prev, ...newEntries }));
      }
    };

    fetchRequests();
    return () => { isMounted = false; };
  }, [helpingTasks]);

  const handleOpenTaskDetails = async (task: HelpTask) => {
    let req = taskRequestsMap[task.requestId];
    if (!req) {
      try {
        const snap = await getDoc(doc(db, 'helpRequests', task.requestId));
        if (snap.exists()) {
          req = { id: snap.id, ...snap.data() } as HelpRequest;
          setTaskRequestsMap(prev => ({ ...prev, [task.requestId]: req! }));
        }
      } catch (e) {
        console.warn('Error fetching task request details:', e);
      }
    }

    if (req) {
      setSelectedRequest(req);
    } else {
      // Graceful fallback synthetic HelpRequest if original request doc is unavailable
      setSelectedRequest({
        id: task.requestId,
        requesterId: task.requesterId,
        requesterName: task.requesterName || 'Neighbor Resident',
        title: task.title,
        description: task.description || 'No additional mission description found.',
        categoryId: task.category || 'General Assistance',
        priority: task.priority || 'NORMAL',
        date: task.scheduledDate,
        startTime: task.scheduledTime,
        location: task.location,
        status: task.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
        selectedHelperId: task.helperId,
        selectedHelperName: task.helperName,
        completionCode: task.completionCode,
        createdAt: task.createdAt,
        updatedAt: task.createdAt
      });
    }
  };

  const handleAcceptOfferDirectly = async (req: HelpRequest, offer: HelpOffer) => {
    if (!req.id || !offer.id) return;
    setAcceptingOfferId(offer.id);
    try {
      const allOffers = incomingOffersByReqId[req.id] || [offer];
      await acceptHelpOffer(req, offer, allOffers);
    } catch (err: any) {
      console.error('Error accepting offer directly:', err);
      alert(err.message || 'Failed to accept proposal.');
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleDeleteRequest = async (req: HelpRequest) => {
    if (!req.id) return;
    if (!window.confirm(`Permanently delete your request "${req.title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'helpRequests', req.id));

      const offersSnap = await getDocs(query(collection(db, 'helpOffers'), where('requestId', '==', req.id)));
      for (const d of offersSnap.docs) {
        await deleteDoc(d.ref);
      }

      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', req.id)));
      for (const d of tasksSnap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      console.error('Error deleting request:', err);
    }
  };

  const handleCompleteAsRequester = async (req: HelpRequest) => {
    if (!req.id) return;
    try {
      await updateDoc(doc(db, 'helpRequests', req.id), {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });

      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', req.id)));
      for (const d of tasksSnap.docs) {
        await updateDoc(d.ref, { status: 'COMPLETED' });
      }

      setReviewItem({
        requestId: req.id,
        title: req.title,
        reviewerRole: 'requester',
        targetUserName: req.selectedHelperName,
        targetUserId: req.selectedHelperId
      });
    } catch (err) {
      console.error('Error completing request:', err);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingTask?.id) return;

    if (verifyCodeInput.trim() !== verifyingTask.completionCode) {
      setVerifyError('Incorrect 4-digit code. Please verify with the requester.');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');

    try {
      // 1. Mark task as COMPLETED
      await updateDoc(doc(db, 'helpTasks', verifyingTask.id), {
        status: 'COMPLETED'
      });

      // 2. Mark request as COMPLETED
      if (verifyingTask.requestId) {
        await updateDoc(doc(db, 'helpRequests', verifyingTask.requestId), {
          status: 'COMPLETED',
          updatedAt: new Date().toISOString()
        });
      }

      const completedTask = verifyingTask;
      setVerifyingTask(null);
      setVerifyCodeInput('');

      // 3. Open review modal as helper
      setReviewItem({
        taskId: completedTask.id,
        requestId: completedTask.requestId,
        title: completedTask.title,
        reviewerRole: 'helper',
        targetUserName: completedTask.requesterName,
        targetUserId: completedTask.requesterId
      });
    } catch (err: any) {
      console.error('Error verifying code:', err);
      setVerifyError('Verification failed. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'OFFER_RECEIVED': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SCHEDULED': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'IN_PROGRESS': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELLED': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300 pb-16 text-slate-900">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 uppercase tracking-wider">
                <ClipboardList className="w-3 h-3" />
                {isUser ? 'Service Orders' : `${profile?.department || 'Field'} Operations`}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {isUser ? 'Client Status' : 'Specialist Roster'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isUser ? 'My Service Requests' : 'My Assigned Missions'}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {isUser 
                ? "Track requests you've posted, view assigned technicians, and share handshake verification codes."
                : `Service requests you have accepted in ${profile?.department || 'your department'} or been dispatched to. Fulfill jobs and verify completion codes.`}
            </p>
          </div>

          {/* Tab Switcher - Only shown for Admin */}
          {isAdmin && (
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('helping')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === 'helping'
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>My Missions ({helpingTasks.length + myOffers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('my-requests')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === 'my-requests'
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <HandHeart className="w-3.5 h-3.5" />
                <span>My Requests ({myRequests.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 1: MY REQUESTS (CITIZENS & ADMIN ONLY) */}
        {!isEmployee && activeTab === 'my-requests' && (
          <div className="space-y-3.5">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-36 bg-slate-100 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : myRequests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                  <HandHeart className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No requests posted yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Need a hand with something in your neighborhood? Click "Ask for Help" to broadcast your need.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="bg-white border border-slate-200/85 hover:border-blue-300 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getStatusBadge(req.status))}>
                            {req.status.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {/* Quick View, Edit & Delete Actions */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRequest(req)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Request"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1 hover:text-blue-600 transition-colors">
                        {req.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                        {req.description}
                      </p>

                      {/* Direct Card-Level Incoming Proposal Banner & Accept Action */}
                      {req.status === 'OFFER_RECEIVED' && (
                        <div 
                          className="mb-3 p-3 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-blue-50/80 border border-emerald-200/90 rounded-xl shadow-2xs space-y-2.5 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                Incoming Specialist Proposal
                              </span>
                            </div>
                            {(incomingOffersByReqId[req.id!]?.length || 0) > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {incomingOffersByReqId[req.id!].length} proposals
                              </span>
                            )}
                          </div>

                          {(() => {
                            const offersForReq = incomingOffersByReqId[req.id!] || [];
                            const latestOffer = offersForReq[0];

                            if (!latestOffer) {
                              return (
                                <div className="text-xs text-slate-500 italic py-1 flex items-center justify-between">
                                  <span>Offer received. Tap card to view details.</span>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="flex items-start gap-2 bg-white/90 p-2 rounded-lg border border-emerald-100/90 shadow-2xs">
                                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                    {latestOffer.helperName ? latestOffer.helperName.charAt(0).toUpperCase() : 'S'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-bold text-slate-800 truncate">
                                        {latestOffer.helperName}
                                      </span>
                                      <span className="text-[10px] text-slate-400 shrink-0">
                                        {latestOffer.createdAt ? new Date(latestOffer.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Today'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 italic line-clamp-1 mt-0.5">
                                      "{latestOffer.message || 'I would like to volunteer and help with this request!'}"
                                    </p>
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  disabled={acceptingOfferId === latestOffer.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptOfferDirectly(req, latestOffer);
                                  }}
                                  className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  {acceptingOfferId === latestOffer.id ? (
                                    <>
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Accepting Proposal...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>Accept Proposal</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Assigned Helper Name badge if accepted */}
                      {req.selectedHelperName && (
                        <div className="mb-2.5 flex items-center justify-between p-2 bg-blue-50/80 rounded-lg border border-blue-100 text-xs">
                          <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[9px]">
                              {req.selectedHelperName.charAt(0)}
                            </div>
                            <span className="text-slate-500 font-medium">Assigned Specialist:</span>
                            <strong className="text-blue-900 font-semibold">{req.selectedHelperName}</strong>
                          </div>
                        </div>
                      )}

                      {/* Handshake Code Container if IN_PROGRESS */}
                      {req.status === 'IN_PROGRESS' && req.completionCode && (
                        <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 block">
                                Handshake Code
                              </span>
                              <span className="font-mono text-base font-extrabold tracking-wider text-blue-900">
                                {req.completionCode}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(req.completionCode!, req.id!)}
                              className="h-7 px-2 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer gap-1"
                            >
                              {copiedCodeId === req.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedCodeId === req.id ? 'Copied' : 'Copy'}</span>
                            </Button>
                            <TaskChatButton
                              requestId={req.id!}
                              variant="blue"
                              onClick={() => setChatSession({
                                requestId: req.id!,
                                taskTitle: req.title,
                                partnerName: req.selectedHelperName || 'Technician',
                                partnerRole: 'Specialist'
                              })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Completed Review Banner */}
                      {req.status === 'COMPLETED' && (
                        <div className="mb-2.5 p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Mission Completed</span>
                            </div>
                            {!req.requesterReview ? (
                              <Button
                                size="sm"
                                onClick={() => setReviewItem({
                                  requestId: req.id,
                                  title: req.title,
                                  reviewerRole: 'requester',
                                  targetUserName: req.selectedHelperName,
                                  targetUserId: req.selectedHelperId
                                })}
                                className="h-6 px-2 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-md shadow-2xs gap-1 cursor-pointer"
                              >
                                <Star className="w-2.5 h-2.5 fill-white" />
                                Review Specialist
                              </Button>
                            ) : (
                              <span className="text-amber-600 font-semibold flex items-center gap-0.5 text-xs">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                You rated: {req.requesterReview.rating}/5
                              </span>
                            )}
                          </div>
                          {req.helperReview && (
                            <div className="text-[11px] text-slate-500 bg-white/70 p-1.5 rounded border border-emerald-100 flex items-center justify-between">
                              <span>Specialist rated you:</span>
                              <span className="font-semibold text-amber-600 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                {req.helperReview.rating}/5
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <a
                        href={getGoogleMapsUrl(req.location, req.coordinates)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 truncate max-w-[170px] hover:text-blue-600 transition-colors cursor-pointer group"
                        title="Open location in Google Maps"
                      >
                        <MapPin className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                        <span className="truncate group-hover:underline">{req.location}</span>
                      </a>
                      <span className="font-semibold text-blue-600 inline-flex items-center gap-1">
                        View Offers & Details &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: ASSIGNED MISSIONS (EMPLOYEES & ADMINS ONLY) */}
        {!isUser && activeTab === 'helping' && (
          <div className="space-y-6">
            {/* Sub-section: Pending Specialist Proposals */}
            {myOffers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Pending Proposals ({myOffers.length})
                  </h2>
                  <span className="text-[11px] text-slate-400">Waiting for citizen approval</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myOffers.map(({ offer, request: req }) => (
                    <div
                      key={offer.id}
                      onClick={() => req && setSelectedRequest(req)}
                      className={cn(
                        "bg-white border border-amber-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between",
                        req && "cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            Proposal Pending
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(offer.createdAt).toLocaleDateString()}
                            </span>
                            {req && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequest(req);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer"
                                title="View full request details"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Details</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1">
                          {req?.title || 'Help Request'}
                        </h3>

                        {req?.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                            {req.description}
                          </p>
                        )}

                        <p className="text-xs text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 mb-2 italic">
                          &quot;{offer.message}&quot;
                        </p>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <a
                            href={getGoogleMapsUrl(req?.location, req?.coordinates)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:text-amber-800 transition-colors cursor-pointer group"
                            title="Open location in Google Maps"
                          >
                            <MapPin className="w-3 h-3 text-slate-400 group-hover:text-amber-700 shrink-0" />
                            <span className="group-hover:underline">{req?.location || 'Area Location'}</span>
                          </a>
                        </div>
                      </div>

                      <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-700 font-medium">
                        <span>Requester will review your proposal shortly</span>
                        {req && <span className="text-[10px] font-semibold text-amber-800 hover:underline">View Request →</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-section: Active & Completed Commitments */}
            <div className="space-y-3">
              {myOffers.length > 0 && (
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active & Completed Missions ({helpingTasks.length})
                </h2>
              )}

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-36 bg-slate-100 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : helpingTasks.length === 0 && myOffers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No active missions</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    You have not claimed or been assigned any missions yet. Check your Department Job Board to claim open requests.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpingTasks.map((task) => {
                    const reqDoc = taskRequestsMap[task.requestId];
                    const displayDescription = task.description || reqDoc?.description;
                    const displayCategory = task.category || reqDoc?.categoryId;
                    const isUrgentMission = task.priority === 'URGENT' || reqDoc?.priority === 'URGENT' || reqDoc?.isEscalated === true;
                    const missionDist = getRequestDistance(
                      reqDoc?.coordinates,
                      liveCoords || profile?.coordinates,
                      task.location || reqDoc?.location,
                      profile?.area
                    );
                    const missionDistFormatted = formatDistance(missionDist);

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleOpenTaskDetails(task)}
                        className={cn(
                          "rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between",
                          isUrgentMission
                            ? "bg-rose-50/90 border-2 border-rose-300 hover:border-rose-400 shadow-sm hover:shadow-md ring-1 ring-rose-200/80"
                            : "bg-white border border-slate-200/85 hover:border-cyan-300 shadow-xs hover:shadow-sm"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isUrgentMission && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-600 text-white border border-rose-700 animate-pulse flex items-center gap-1 shadow-2xs font-mono">
                                  🚨 URGENT MISSION
                                </span>
                              )}
                              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getStatusBadge(task.status))}>
                                {task.status.replace('_', ' ')}
                              </span>
                              {displayCategory && (
                                <span className={cn(
                                  "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                                  isUrgentMission 
                                    ? "bg-rose-100/80 text-rose-800 border-rose-200" 
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                )}>
                                  {displayCategory}
                                </span>
                              )}
                              {missionDistFormatted && (
                                <span className={cn(
                                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                                  isUrgentMission 
                                    ? "bg-rose-100/90 text-rose-800 border-rose-300" 
                                    : "bg-emerald-50/90 text-emerald-800 border-emerald-200"
                                )}>
                                  <Navigation className={cn("w-2.5 h-2.5 shrink-0", isUrgentMission ? "text-rose-600" : "text-emerald-600")} />
                                  <span>{missionDistFormatted}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn("text-[11px] font-mono", isUrgentMission ? "text-rose-700 font-semibold" : "text-slate-400")}>
                                {task.scheduledDate} {task.scheduledTime}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTaskDetails(task);
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer border",
                                  isUrgentMission
                                    ? "text-rose-900 bg-rose-100 hover:bg-rose-200 border-rose-300"
                                    : "text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border-cyan-200"
                                )}
                                title="View full task description & details"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Details</span>
                              </button>
                            </div>
                          </div>

                          <h3 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTaskDetails(task);
                            }}
                            className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1 hover:text-cyan-700 transition-colors cursor-pointer"
                          >
                            {task.title}
                          </h3>

                          {/* Task Description Preview */}
                          <div className="mb-2.5">
                            {displayDescription ? (
                              <p 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTaskDetails(task);
                                }}
                                className="text-xs text-slate-600 line-clamp-2 leading-relaxed hover:text-slate-900 cursor-pointer"
                                title="Click to view full description and instructions"
                              >
                                {displayDescription}
                              </p>
                            ) : (
                              <p 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTaskDetails(task);
                                }}
                                className="text-xs text-slate-400 italic hover:text-slate-600 cursor-pointer"
                              >
                                Tap &quot;Details&quot; or card to view full instructions &amp; details.
                              </p>
                            )}
                          </div>

                          {/* Requester Badge */}
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTaskDetails(task);
                            }}
                            className="mb-2.5 flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-100 text-xs transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px]">
                                {task.requesterName?.charAt(0) || 'R'}
                              </div>
                              <span className="text-slate-500 font-medium">Helping Neighbor:</span>
                              <strong className="text-slate-900 font-semibold">{task.requesterName}</strong>
                            </div>
                            <span className="text-[10px] text-cyan-700 font-medium hover:underline">
                              View Requester Info →
                            </span>
                          </div>

                          {/* Complete Task action for helper */}
                          {task.status === 'IN_PROGRESS' && (
                            <div 
                              className={cn(
                                "mb-3 p-2.5 rounded-xl flex items-center justify-between border",
                                isUrgentMission
                                  ? "bg-rose-100/80 border-rose-300"
                                  : "bg-cyan-50 border-cyan-200"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div>
                                <span className={cn(
                                  "text-[9px] font-bold uppercase tracking-wider block",
                                  isUrgentMission ? "text-rose-900" : "text-cyan-800"
                                )}>
                                  {isUrgentMission ? '🚨 URGENT MISSION IN PROGRESS' : 'Task In Progress'}
                                </span>
                                <span className="text-xs text-slate-600">Enter handshake code when done</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenTaskDetails(task)}
                                  className={cn(
                                    "h-7 px-2.5 text-xs font-semibold rounded-lg cursor-pointer gap-1 bg-white",
                                    isUrgentMission
                                      ? "text-rose-900 border-rose-300 hover:bg-rose-50"
                                      : "text-cyan-800 border-cyan-300 hover:bg-cyan-100/80"
                                  )}
                                  title="View full task description & details"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Details</span>
                                </Button>
                                <TaskChatButton
                                  requestId={task.requestId}
                                  variant={isUrgentMission ? "rose" : "cyan"}
                                  onClick={() => setChatSession({
                                    requestId: task.requestId,
                                    taskTitle: task.title,
                                    partnerName: task.requesterName || 'Citizen',
                                    partnerRole: 'Citizen Requester'
                                  })}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setVerifyingTask(task);
                                    setVerifyCodeInput('');
                                    setVerifyError('');
                                  }}
                                  className={cn(
                                    "h-7 px-3 text-xs font-semibold text-white rounded-lg shadow-xs cursor-pointer",
                                    isUrgentMission ? "bg-rose-600 hover:bg-rose-700" : "bg-cyan-700 hover:bg-cyan-800"
                                  )}
                                >
                                  Enter Code & Finish
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Completed Task Banner */}
                          {task.status === 'COMPLETED' && (
                            <div 
                              className="mb-2.5 p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col gap-1.5 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Mission Accomplished</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenTaskDetails(task)}
                                    className="h-6 px-2 text-[11px] font-semibold text-emerald-800 bg-white border-emerald-200 hover:bg-emerald-100 rounded-md shadow-2xs gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    Details
                                  </Button>
                                  {!task.helperReview ? (
                                    <Button
                                      size="sm"
                                      onClick={() => setReviewItem({
                                        taskId: task.id,
                                        requestId: task.requestId,
                                        title: task.title,
                                        reviewerRole: 'helper',
                                        targetUserName: task.requesterName,
                                        targetUserId: task.requesterId
                                      })}
                                      className="h-6 px-2 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-md shadow-2xs gap-1 cursor-pointer"
                                    >
                                      <Star className="w-2.5 h-2.5 fill-white" />
                                      Review Requester
                                    </Button>
                                  ) : (
                                    <span className="text-amber-600 font-semibold flex items-center gap-0.5 text-xs">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                      You rated: {task.helperReview.rating}/5
                                    </span>
                                  )}
                                </div>
                              </div>
                              {task.requesterReview && (
                                <div className="text-[11px] text-slate-500 bg-white/70 p-1.5 rounded border border-emerald-100 flex items-center justify-between">
                                  <span>Requester rated you:</span>
                                  <span className="font-semibold text-amber-600 flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                    {task.requesterReview.rating}/5
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <a
                            href={getGoogleMapsUrl(task.location, (reqDoc?.coordinates || null))}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 truncate max-w-[170px] hover:text-cyan-700 transition-colors cursor-pointer group"
                            title="Open location in Google Maps"
                          >
                            <MapPin className="w-3 h-3 text-slate-400 group-hover:text-cyan-600 shrink-0" />
                            <span className="truncate group-hover:underline">{task.location}</span>
                          </a>
                          <span className="font-semibold text-emerald-600 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Verified Mission
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification Code Input Modal for Helper */}
        {verifyingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div 
              className="fixed inset-0" 
              onClick={() => setVerifyingTask(null)} 
            />
            <div className="relative bg-white rounded-2xl max-w-xs w-full p-5 shadow-xl border border-slate-200 z-10 space-y-3.5 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">Verify Handshake Code</h3>
                <button
                  onClick={() => setVerifyingTask(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleVerifyCodeSubmit} className="space-y-3">
                <p className="text-xs text-slate-600">
                  Ask <strong>{verifyingTask.requesterName}</strong> for their 4-digit code to complete:
                </p>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={verifyCodeInput}
                  onChange={(e) => setVerifyCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="h-10 w-full text-center text-lg font-mono font-bold tracking-widest rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {verifyError && <p className="text-xs text-rose-600 font-medium">{verifyError}</p>}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setVerifyingTask(null)}
                    className="h-8 px-3 text-xs font-semibold text-slate-600 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifying || verifyCodeInput.length !== 4}
                    className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify & Finish'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Request Modal */}
        {editingRequest && (
          <CreateRequestModal
            editRequest={editingRequest}
            onClose={() => setEditingRequest(null)}
          />
        )}

        {/* Help Detail Modal */}
        <HelpDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />

        {/* Review Modal */}
        {reviewItem && (
          <ReviewModal
            isOpen={!!reviewItem}
            onClose={() => setReviewItem(null)}
            requestId={reviewItem.requestId}
            taskId={reviewItem.taskId}
            missionTitle={reviewItem.title}
            reviewerRole={reviewItem.reviewerRole}
            targetUserName={reviewItem.targetUserName}
            targetUserId={reviewItem.targetUserId}
          />
        )}

        {/* Real-time Task Chat & Voice Notes Modal */}
        {chatSession && (
          <TaskChatModal
            requestId={chatSession.requestId}
            taskTitle={chatSession.taskTitle}
            otherPartyName={chatSession.partnerName}
            otherPartyRole={chatSession.partnerRole}
            onClose={() => setChatSession(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
