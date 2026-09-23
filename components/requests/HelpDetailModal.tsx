"use client";

import React, { useState, useEffect } from 'react';
import { HelpRequest, HelpOffer, UserData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Button } from '@/components/ui/Button';
import { 
  X, 
  MapPin, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  HandHeart, 
  MessageSquare, 
  Send,
  User,
  ShieldCheck,
  Tag,
  Pencil,
  Trash2,
  Copy,
  Check,
  Star,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRequestDistance, formatDistance, getGoogleMapsUrl } from '@/lib/distance';
import CreateRequestModal from './CreateRequestModal';
import ReviewModal from '@/components/reviews/ReviewModal';

interface HelpDetailModalProps {
  request: HelpRequest | null;
  onClose: () => void;
  onOfferSuccess?: () => void;
}

export default function HelpDetailModal({ request, onClose, onOfferSuccess }: HelpDetailModalProps) {
  const { user, profile } = useAuth();
  const [requesterData, setRequesterData] = useState<UserData | null>(null);
  const [offers, setOffers] = useState<HelpOffer[]>([]);
  const [hasOffered, setHasOffered] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [error, setError] = useState('');

  // Extended lifecycle states
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAcceptingOfferId, setIsAcceptingOfferId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Fetch requester profile and offers for this request
  useEffect(() => {
    if (!request?.id) return;

    setOfferSuccess(false);
    setCustomMessage('');
    setError('');
    setVerifyCodeInput('');
    setCodeError('');

    // Fetch requester public details
    const fetchRequester = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', request.requesterId));
        if (userDoc.exists()) {
          setRequesterData(userDoc.data() as UserData);
        }
      } catch (err) {
        console.warn('Could not load requester profile:', err);
      }
    };
    fetchRequester();

    // Listen to offers on this request
    const q = query(
      collection(db, 'helpOffers'),
      where('requestId', '==', request.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpOffer));
      setOffers(data);
      if (user) {
        const alreadyOffered = data.some(o => o.helperId === user.uid);
        setHasOffered(alreadyOffered);
      }
    });

    return () => unsub();
  }, [request, user]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!request) return null;

  const isOwner = user?.uid === request.requesterId;
  const isAssignedHelper = user?.uid === request.selectedHelperId;
  const isEmployee = profile?.role === 'employee' || profile?.role === 'admin';
  const isDeptMatch = profile?.role === 'admin' || (profile?.role === 'employee' && profile?.department === request.categoryId);
  const canOffer = isEmployee && isDeptMatch && !isOwner && !hasOffered && !offerSuccess && (request.status === 'OPEN' || request.status === 'OFFER_RECEIVED');

  const requestDistance = getRequestDistance(
    request.coordinates,
    profile?.coordinates,
    request.location,
    profile?.area
  );
  const distanceFormatted = formatDistance(requestDistance);

  const mapUrl = getGoogleMapsUrl(request.location, request.coordinates);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !request.id) return;

    setSubmittingOffer(true);
    setError('');

    try {
      const offerRef = doc(collection(db, 'helpOffers'));
      await setDoc(offerRef, {
        requestId: request.id,
        helperId: user.uid,
        helperName: profile.fullName || 'Neighbor Helper',
        message: customMessage.trim() || 'I would like to volunteer and help with this request!',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // Update request status to OFFER_RECEIVED if still OPEN
      if (request.status === 'OPEN') {
        await updateDoc(doc(db, 'helpRequests', request.id), {
          status: 'OFFER_RECEIVED'
        });
      }

      // Send notification to requester
      const notificationRef = doc(collection(db, 'notifications'));
      await setDoc(notificationRef, {
        userId: request.requesterId,
        title: 'New Help Offer! 🤝',
        message: `${profile.fullName || 'A neighbor'} offered to help with "${request.title}".`,
        read: false,
        type: 'OFFER_RECEIVED',
        relatedId: request.id,
        createdAt: new Date().toISOString()
      });

      setOfferSuccess(true);
      if (onOfferSuccess) onOfferSuccess();
    } catch (err: any) {
      console.error('Error sending offer:', err);
      setError(err.message || 'Failed to submit your help offer.');
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleAcceptOffer = async (offer: HelpOffer) => {
    if (!request?.id || !user) return;
    setIsAcceptingOfferId(offer.id || 'loading');
    setError('');

    try {
      const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 1. Mark selected offer as ACCEPTED
      if (offer.id) {
        await updateDoc(doc(db, 'helpOffers', offer.id), {
          status: 'ACCEPTED'
        });
      }

      // 2. Mark other pending offers as REJECTED
      const otherPending = offers.filter(o => o.id !== offer.id && o.status === 'PENDING');
      for (const o of otherPending) {
        if (o.id) {
          await updateDoc(doc(db, 'helpOffers', o.id), {
            status: 'REJECTED'
          });
        }
      }

      // 3. Update helpRequests
      await updateDoc(doc(db, 'helpRequests', request.id), {
        status: 'IN_PROGRESS',
        selectedHelperId: offer.helperId,
        selectedHelperName: offer.helperName,
        completionCode: generatedCode,
        updatedAt: new Date().toISOString()
      });

      // 4. Create or update in helpTasks
      const taskRef = doc(collection(db, 'helpTasks'));
      await setDoc(taskRef, {
        requestId: request.id,
        requesterId: request.requesterId,
        requesterName: request.requesterName,
        helperId: offer.helperId,
        helperName: offer.helperName,
        title: request.title,
        description: request.description || '',
        category: request.categoryId || 'General',
        priority: request.priority || 'NORMAL',
        scheduledDate: request.date,
        scheduledTime: request.startTime,
        location: request.location,
        status: 'IN_PROGRESS',
        completionCode: generatedCode,
        createdAt: new Date().toISOString()
      });

      // 5. Notify volunteer
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        userId: offer.helperId,
        title: 'Offer Accepted! 🚀',
        message: `Your volunteer offer for "${request.title}" was accepted! Handshake code generated.`,
        read: false,
        type: 'OFFER_ACCEPTED',
        relatedId: request.id,
        createdAt: new Date().toISOString()
      });

    } catch (err: any) {
      console.error('Error accepting offer:', err);
      setError(err.message || 'Failed to accept offer');
    } finally {
      setIsAcceptingOfferId(null);
    }
  };

  const handleDirectAcceptTask = async () => {
    if (!request?.id || !user) return;
    setSubmittingOffer(true);
    setError('');

    try {
      const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 1. Update helpRequests immediately to IN_PROGRESS so it leaves Explore
      await updateDoc(doc(db, 'helpRequests', request.id), {
        status: 'IN_PROGRESS',
        selectedHelperId: user.uid,
        selectedHelperName: profile?.fullName || user.displayName || 'Neighbor Helper',
        completionCode: generatedCode,
        updatedAt: new Date().toISOString()
      });

      // 2. Create helpTasks doc
      const taskRef = doc(collection(db, 'helpTasks'));
      await setDoc(taskRef, {
        requestId: request.id,
        requesterId: request.requesterId,
        requesterName: request.requesterName,
        helperId: user.uid,
        helperName: profile?.fullName || user.displayName || 'Neighbor Helper',
        title: request.title,
        description: request.description || '',
        category: request.categoryId || 'General',
        priority: request.priority || 'NORMAL',
        scheduledDate: request.date,
        scheduledTime: request.startTime,
        location: request.location,
        status: 'IN_PROGRESS',
        completionCode: generatedCode,
        createdAt: new Date().toISOString()
      });

      // 3. Notify requester
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        userId: request.requesterId,
        title: 'Task Accepted by Neighbor! 🚀',
        message: `${profile?.fullName || 'A neighbor'} accepted your request "${request.title}"! Handshake code generated.`,
        read: false,
        type: 'OFFER_ACCEPTED',
        relatedId: request.id,
        createdAt: new Date().toISOString()
      });

      if (onOfferSuccess) onOfferSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error accepting task:', err);
      setError(err.message || 'Failed to accept task.');
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!request?.id || !isOwner) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${request.title}"?`)) return;

    setIsDeleting(true);
    try {
      // 1. Delete request
      await deleteDoc(doc(db, 'helpRequests', request.id));

      // 2. Delete offers
      const offersSnap = await getDocs(query(collection(db, 'helpOffers'), where('requestId', '==', request.id)));
      for (const d of offersSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 3. Delete tasks if any
      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', request.id)));
      for (const d of tasksSnap.docs) {
        await deleteDoc(d.ref);
      }

      onClose();
    } catch (err: any) {
      console.error('Error deleting request:', err);
      setError('Failed to delete request.');
      setIsDeleting(false);
    }
  };

  const handleCompleteByRequester = async () => {
    if (!request?.id || !isOwner) return;
    try {
      await updateDoc(doc(db, 'helpRequests', request.id), {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });

      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', request.id)));
      for (const d of tasksSnap.docs) {
        await updateDoc(d.ref, { status: 'COMPLETED' });
      }

      // Notify helper
      if (request.selectedHelperId) {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          userId: request.selectedHelperId,
          title: 'Mission Completed! 🎉',
          message: `${request.requesterName} verified and closed "${request.title}". Great work!`,
          read: false,
          type: 'TASK_COMPLETED',
          relatedId: request.id,
          createdAt: new Date().toISOString()
        });
      }

      setShowReviewModal(true);
    } catch (err: any) {
      console.error('Error marking completed:', err);
      setError('Failed to mark task completed.');
    }
  };

  const handleVerifyCodeByHelper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request?.id || !user) return;

    if (verifyCodeInput.trim() !== request.completionCode) {
      setCodeError('Invalid code! Enter the 4-digit code provided by the requester.');
      return;
    }

    setVerifyingCode(true);
    setCodeError('');
    try {
      await updateDoc(doc(db, 'helpRequests', request.id), {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });

      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', request.id)));
      for (const d of tasksSnap.docs) {
        await updateDoc(d.ref, { status: 'COMPLETED' });
      }

      // Notify requester
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        userId: request.requesterId,
        title: 'Handshake Verified & Completed! 🤝',
        message: `${request.selectedHelperName || 'Volunteer'} entered your 4-digit completion code for "${request.title}".`,
        read: false,
        type: 'TASK_COMPLETED',
        relatedId: request.id,
        createdAt: new Date().toISOString()
      });

      setShowReviewModal(true);
    } catch (err: any) {
      console.error('Error verifying completion code:', err);
      setCodeError('Failed to verify code.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-700';
      case 'OFFER_RECEIVED': return 'bg-indigo-100 text-indigo-700';
      case 'SCHEDULED': return 'bg-amber-100 text-amber-700';
      case 'IN_PROGRESS': return 'bg-cyan-100 text-cyan-700';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      case 'CANCELLED': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
        <div 
          className="fixed inset-0" 
          onClick={onClose} 
          aria-label="Close modal backdrop" 
        />

        <div 
          className="relative bg-white rounded-2xl max-w-xl w-full max-h-[88vh] overflow-y-auto shadow-xl border border-slate-200 p-5 space-y-4 z-10 animate-in zoom-in-95 duration-200 text-left custom-scrollbar"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-detail-title"
        >
          {/* Modal Top Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {request.categoryId}
                </span>

                <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-flex items-center gap-1", getPriorityBadge(request.priority))}>
                  <AlertCircle className="w-2.5 h-2.5" />
                  {request.priority} Priority
                </span>

                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md", getStatusBadge(request.status))}>
                  {request.status.replace('_', ' ')}
                </span>
              </div>

              <h2 id="help-detail-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {request.title}
              </h2>
            </div>

            {/* Actions: Edit, Delete, Close */}
            <div className="flex items-center gap-1 shrink-0">
              {isOwner && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg h-7 w-7"
                    title="Edit Request"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteRequest}
                    disabled={isDeleting}
                    className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-7 w-7"
                    title="Delete Request"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-7 w-7"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Requester Information Card */}
          <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                {request.requesterName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-xs text-slate-900">
                  {request.requesterName} {isOwner && <span className="text-blue-600 font-normal">(You)</span>}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {requesterData?.area ? `Resident of ${requesterData.area}` : 'Community Member'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                <MessageSquare className="w-3 h-3 text-blue-500" />
                {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
              </span>
            </div>
          </div>

          {/* Assigned Specialist Card */}
          {request.selectedHelperName && (
            <div className="flex items-center justify-between p-3 bg-emerald-50/80 rounded-xl border border-emerald-100 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                  {request.selectedHelperName.charAt(0)}
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider block">Assigned Specialist / Technician</span>
                  <p className="font-semibold text-xs text-slate-900">
                    {request.selectedHelperName} {isAssignedHelper && <span className="text-emerald-700 font-normal">(You)</span>}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {request.status === 'COMPLETED' ? 'Mission Finished' : 'Active Mission'}
              </span>
            </div>
          )}

          {/* Full Description */}
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Full Request Details</h3>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line shadow-2xs">
              {request.description}
            </div>
          </div>

          {/* Metadata Grid: Date & Time */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-[10px] font-medium">Scheduled Date</p>
                <p className="font-semibold text-slate-800 truncate text-xs">{request.date || 'Flexible'}</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-[10px] font-medium">Start Time</p>
                <p className="font-semibold text-slate-800 truncate text-xs">{request.startTime || 'Anytime'}</p>
              </div>
            </div>
          </div>

          {/* Full Location Card with Interactive Map Link */}
          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">Task Location</span>
                  {distanceFormatted && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-200">
                      {distanceFormatted}
                    </span>
                  )}
                </div>
              </div>

              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-800 hover:text-purple-950 bg-white hover:bg-purple-100/80 border border-purple-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Open exact location in Google Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                  <span>Open in Google Maps</span>
                </a>
              )}
            </div>

            <p className="text-xs text-slate-800 font-medium leading-relaxed pl-8 break-words select-text">
              {request.location || 'Location details not specified.'}
            </p>

            {request.coordinates?.lat && request.coordinates?.lng && (
              <div className="pl-8 pt-0.5 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>Coordinates:</span>
                <span className="text-purple-700 font-semibold">
                  {request.coordinates.lat.toFixed(6)}, {request.coordinates.lng.toFixed(6)}
                </span>
              </div>
            )}
          </div>

          {/* SECTION FOR REQUESTER: INCOMING OFFERS */}
          {isOwner && offers.length > 0 && request.status !== 'COMPLETED' && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HandHeart className="w-3.5 h-3.5 text-blue-600" />
                  Incoming Specialist Proposals ({offers.length})
                </h3>
                <span className="text-[10px] text-slate-400">Review technician proposals</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {offers.map((offer) => (
                  <div 
                    key={offer.id} 
                    className={cn(
                      "p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                      offer.status === 'ACCEPTED'
                        ? "bg-emerald-50/70 border-emerald-200"
                        : offer.status === 'REJECTED'
                        ? "bg-slate-50 border-slate-200 opacity-60"
                        : "bg-white border-slate-200 shadow-2xs hover:border-blue-300"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">{offer.helperName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(offer.createdAt).toLocaleDateString()}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider",
                          offer.status === 'ACCEPTED' ? "bg-emerald-100 text-emerald-800" :
                          offer.status === 'REJECTED' ? "bg-slate-100 text-slate-500" :
                          "bg-amber-100 text-amber-800"
                        )}>
                          {offer.status}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs italic line-clamp-2">"{offer.message}"</p>
                    </div>

                    {offer.status === 'PENDING' && request.status !== 'IN_PROGRESS' && (
                      <Button
                        size="sm"
                        onClick={() => handleAcceptOffer(offer)}
                        disabled={isAcceptingOfferId === offer.id}
                        className="h-7.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shrink-0 gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isAcceptingOfferId === offer.id ? 'Accepting...' : 'Accept Proposal'}
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IN-PROGRESS HANDSHAKE TOKEN CONTAINER FOR REQUESTER */}
          {isOwner && request.status === 'IN_PROGRESS' && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Handshake Completion Code</span>
                </div>
                <span className="text-[10px] text-blue-700 font-medium">Share with technician</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Provide this 4-digit code to your technician <strong>{request.selectedHelperName}</strong> when the task is done. They will enter it on their device to verify completion:
              </p>
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xl font-mono font-extrabold text-blue-700 tracking-widest shadow-2xs">
                    {request.completionCode || '----'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyCode(request.completionCode || '')}
                    className="h-8 px-2.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </Button>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Awaiting technician verification
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* HELPER SECTION: COMPLETE MISSION VIA CODE */}
          {isAssignedHelper && request.status === 'IN_PROGRESS' && (
            <form onSubmit={handleVerifyCodeByHelper} className="p-3.5 bg-cyan-50/80 border border-cyan-200 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-950 font-bold">
                  <ShieldCheck className="w-4 h-4 text-cyan-700" />
                  <span>Complete Mission with Handshake Code</span>
                </div>
                <span className="text-[10px] text-cyan-800">Assigned Volunteer</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Ask <strong>{request.requesterName}</strong> for their 4-digit completion code once you've finished:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={verifyCodeInput}
                  onChange={(e) => setVerifyCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 4829"
                  className="h-8 w-28 text-center text-sm font-mono font-bold tracking-widest rounded-lg border border-cyan-300 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-600"
                />
                <Button
                  type="submit"
                  disabled={verifyingCode || verifyCodeInput.length !== 4}
                  className="h-8 px-3 text-xs font-semibold bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg shadow-xs cursor-pointer"
                >
                  {verifyingCode ? 'Verifying...' : 'Verify & Complete'}
                </Button>
              </div>
              {codeError && <p className="text-xs text-rose-600 font-medium">{codeError}</p>}
            </form>
          )}

          {/* COMPLETED TASK STATUS & MUTUAL REVIEWS */}
          {request.status === 'COMPLETED' && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mission Successfully Completed & Verified</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700">Archived</span>
              </div>

              {/* Reviews Display */}
              <div className="space-y-2">
                {/* Requester's Review of Helper */}
                {request.requesterReview && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Review by Requester ({request.requesterName})
                      </span>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              "w-3 h-3",
                              s <= request.requesterReview!.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="italic text-slate-600">"{request.requesterReview.comment}"</p>
                  </div>
                )}

                {/* Helper's Review of Requester */}
                {request.helperReview && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Review by Volunteer ({request.selectedHelperName || 'Volunteer'})
                      </span>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              "w-3 h-3",
                              s <= request.helperReview!.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="italic text-slate-600">"{request.helperReview.comment}"</p>
                  </div>
                )}

                {/* Fallback old review field */}
                {!request.requesterReview && !request.helperReview && request.review && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center gap-1 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            "w-3.5 h-3.5",
                            s <= request.review!.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                          )}
                        />
                      ))}
                      <span className="text-slate-500 text-[10px] ml-1 font-medium">by {request.review.reviewerName}</span>
                    </div>
                    <p className="italic text-slate-600">"{request.review.comment}"</p>
                  </div>
                )}

                {/* Prompt button to review if current user hasn't reviewed yet */}
                {((isOwner && !request.requesterReview) || (isAssignedHelper && !request.helperReview)) && (
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-100/60">
                    <p className="text-slate-600 text-[11px]">
                      {isOwner ? "Share feedback for your specialist:" : "Share feedback for your requester:"}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setShowReviewModal(true)}
                      className="h-7 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-2xs gap-1 cursor-pointer"
                    >
                      <Star className="w-3 h-3 fill-white" />
                      {isOwner ? "Review Specialist" : "Review Requester"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VOLUNTEER ACTIONS FOR SPECIALIST EMPLOYEES ONLY */}
          {!isOwner && canOffer && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <HandHeart className="w-3.5 h-3.5 text-blue-600" /> Specialist Claim / Offer ({request.categoryId})
                </label>
                <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Technician Action
                </span>
              </div>

              <form onSubmit={handleSendOffer} className="space-y-2.5">
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Send a claim proposal to {request.requesterName}. Once accepted, a secure 4-digit handshake code will be generated.
                </p>
                <textarea
                  rows={2}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="e.g. As a specialist in this category, I can complete this service today..."
                  className="w-full p-2.5 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-slate-800 placeholder:text-slate-400 resize-none transition-all"
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={submittingOffer}
                    className="h-8.5 px-4 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingOffer ? 'Sending...' : 'Claim / Send Service Offer'}</span>
                  </Button>
                </div>
              </form>
            </div>
          )}

          {!isOwner && !isEmployee && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>This request is reserved for <strong>{request.categoryId} Department</strong> technicians. Citizens cannot claim requests.</span>
            </div>
          )}

          {!isOwner && isEmployee && (hasOffered || offerSuccess) && request.status !== 'COMPLETED' && !isAssignedHelper && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>You have submitted a specialist proposal for this task! Awaiting requester acceptance.</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            <span>Posted on {new Date(request.createdAt).toLocaleDateString()}</span>
            <Button variant="ghost" onClick={onClose} className="rounded-lg text-xs font-semibold text-slate-500 h-7 px-2">
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <CreateRequestModal
          editRequest={request}
          onClose={() => {
            setIsEditing(false);
            onClose();
          }}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          requestId={request.id}
          missionTitle={request.title}
          reviewerRole={isOwner ? 'requester' : 'helper'}
          targetUserName={isOwner ? request.selectedHelperName : request.requesterName}
          targetUserId={isOwner ? request.selectedHelperId : request.requesterId}
        />
      )}
    </>
  );
}
