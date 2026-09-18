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
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import HelpDetailModal from '@/components/requests/HelpDetailModal';
import CreateRequestModal from '@/components/requests/CreateRequestModal';
import ReviewModal from '@/components/reviews/ReviewModal';
import AppLayout from '@/components/layout/AppLayout';

interface EnrichedOffer {
  offer: HelpOffer;
  request?: HelpRequest;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-requests' | 'helping'>('my-requests');
  
  const [myRequests, setMyRequests] = useState<HelpRequest[]>([]);
  const [helpingTasks, setHelpingTasks] = useState<HelpTask[]>([]);
  const [myOffers, setMyOffers] = useState<EnrichedOffer[]>([]);
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
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyRequests(items);
    }, (err) => console.warn('Tasks myRequests error:', err));

    // 2. Tasks where I am helper
    const taskQuery = query(
      collection(db, 'helpTasks'),
      where('helperId', '==', user.uid)
    );
    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HelpTask));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHelpingTasks(items);
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

    return () => {
      unsubReq();
      unsubTasks();
      unsubOffers();
    };
  }, [user]);

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
                Activity Ledger
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Mutual Aid Track</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              My Tasks & Commitments
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Track requests you've posted, review volunteer offers, and manage missions you've pledged to help with.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-xl shrink-0">
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
              <span>Helping Out ({helpingTasks.length + myOffers.length})</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: MY REQUESTS */}
        {activeTab === 'my-requests' && (
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

                        {/* Quick Edit & Delete Actions */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

                      {/* Assigned Helper Name badge if accepted */}
                      {req.selectedHelperName && (
                        <div className="mb-2.5 flex items-center justify-between p-2 bg-blue-50/80 rounded-lg border border-blue-100 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[9px]">
                              {req.selectedHelperName.charAt(0)}
                            </div>
                            <span className="text-slate-500 font-medium">Assigned Volunteer:</span>
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
                              <span>{copiedCodeId === req.id ? 'Copied' : 'Copy Code'}</span>
                            </Button>
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
                                Review Volunteer
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
                              <span>Volunteer rated you:</span>
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
                      <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {req.location}
                      </span>
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

        {/* SECTION 2: HELPING OUT */}
        {activeTab === 'helping' && (
          <div className="space-y-6">
            {/* Sub-section: Pending Volunteer Offers */}
            {myOffers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Pending Volunteer Offers ({myOffers.length})
                  </h2>
                  <span className="text-[11px] text-slate-400">Waiting for requester approval</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myOffers.map(({ offer, request: req }) => (
                    <div
                      key={offer.id}
                      className="bg-white border border-amber-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            Offer Pending
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(offer.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1">
                          {req?.title || 'Help Request'}
                        </h3>

                        <p className="text-xs text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 mb-2 italic">
                          "{offer.message}"
                        </p>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{req?.location || 'Area Location'}</span>
                        </div>
                      </div>

                      <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-700 font-medium">
                        <span>Requester will review your proposal shortly</span>
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
                  <h3 className="text-sm font-bold text-slate-900">No active commitments</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    You haven't volunteered for any tasks yet. Check the "Discover Help" feed to offer assistance to neighbors.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {helpingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white border border-slate-200/85 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getStatusBadge(task.status))}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {task.scheduledDate} {task.scheduledTime}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 mb-1">
                          {task.title}
                        </h3>

                        {/* Requester Badge */}
                        <div className="mb-2.5 flex items-center gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                          <div className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px]">
                            {task.requesterName?.charAt(0) || 'R'}
                          </div>
                          <span className="text-slate-500 font-medium">Helping Neighbor:</span>
                          <strong className="text-slate-900 font-semibold">{task.requesterName}</strong>
                        </div>

                        {/* Complete Task action for helper */}
                        {task.status === 'IN_PROGRESS' && (
                          <div className="mb-3 p-2.5 bg-cyan-50 border border-cyan-200 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-800 block">
                                Task In Progress
                              </span>
                              <span className="text-xs text-slate-600">Enter handshake code when done</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setVerifyingTask(task);
                                setVerifyCodeInput('');
                                setVerifyError('');
                              }}
                              className="h-7 px-3 text-xs font-semibold bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg shadow-xs cursor-pointer"
                            >
                              Enter Code & Finish
                            </Button>
                          </div>
                        )}

                        {/* Completed Task Banner */}
                        {task.status === 'COMPLETED' && (
                          <div className="mb-2.5 p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col gap-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Mission Accomplished</span>
                              </div>
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
                        <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {task.location}
                        </span>
                        <span className="font-semibold text-emerald-600 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Verified Mission
                        </span>
                      </div>
                    </div>
                  ))}
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
      </div>
    </AppLayout>
  );
}
