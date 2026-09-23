"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { Button } from '@/components/ui/Button';
import { 
  Plus, 
  Navigation, 
  ClipboardList, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Settings as SettingsIcon,
  MessageSquare,
  KeyRound,
  Copy,
  Check,
  Wrench,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { HelpRequest, HelpTask, HelpOffer } from '@/types';
import { cn } from '@/lib/utils';
import { getRequestDistance, formatDistance, getGoogleMapsUrl } from '@/lib/distance';
import { evaluateAndEscalateRequest, getMinutesUntilDeadline } from '@/lib/slaEscalation';
import HelpDetailModal from '@/components/requests/HelpDetailModal';
import TaskChatModal from '@/components/chat/TaskChatModal';
import TaskChatButton from '@/components/chat/TaskChatButton';
import AppLayout from '@/components/layout/AppLayout';
import { acceptHelpOffer } from '@/services/offers.service';
import { directAcceptTask } from '@/services/tasks.service';
import { sortByLatestScheduled } from '@/lib/sortUtils';

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { openCreateRequest } = useModal();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  
  // Citizen Stat counts
  const [openRequestsCount, setOpenRequestsCount] = useState(0);
  const [inProgressRequestsCount, setInProgressRequestsCount] = useState(0);
  const [completedRequestsCount, setCompletedRequestsCount] = useState(0);

  // Employee Stat counts
  const [deptOpenCount, setDeptOpenCount] = useState(0);
  const [employeeMissionsCount, setEmployeeMissionsCount] = useState(0);
  const [employeeCompletedCount, setEmployeeCompletedCount] = useState(0);

  const [feedRequests, setFeedRequests] = useState<HelpRequest[]>([]);
  const [deptOpenRequests, setDeptOpenRequests] = useState<HelpRequest[]>([]);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [incomingOffersByReqId, setIncomingOffersByReqId] = useState<Record<string, HelpOffer[]>>({});
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<HelpRequest | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<{
    requestId: string;
    taskTitle: string;
    partnerName: string;
    partnerRole: string;
  } | null>(null);

  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);

  const isUser = profile?.role === 'user';
  const isEmployee = profile?.role === 'employee';

  // Always-Active Continuous Live GPS Watcher
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load instantly from localStorage cache
    try {
      const cached = localStorage.getItem('localend_live_coords');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.lat === 'number' && !isNaN(parsed.lat)) {
          setLiveCoords(parsed);
        }
      }
    } catch (e) {}

    if (!navigator.geolocation) return;

    // Immediate check
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveCoords(coords);
        try { localStorage.setItem('localend_live_coords', JSON.stringify(coords)); } catch (e) {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );

    // Continuous watchPosition to keep GPS always active
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveCoords(coords);
        try { localStorage.setItem('localend_live_coords', JSON.stringify(coords)); } catch (e) {}
      },
      (err) => console.log('Dashboard continuous GPS notice:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (profile && !profile.onboardingCompleted) {
        router.replace('/onboarding');
        return;
      }
      if (profile?.role === 'admin' || user.email?.toLowerCase() === 'admin@gmail.com') {
        router.replace('/admin');
        return;
      }
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // 1. Citizen Live Requests listener
    const myReqQuery = query(
      collection(db, 'helpRequests'),
      where('requesterId', '==', user.uid)
    );
    const unsubMyReq = onSnapshot(myReqQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      const open = docs.filter(r => r.status === 'OPEN' || r.status === 'OFFER_RECEIVED');
      const inProg = docs.filter(r => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED');
      const comp = docs.filter(r => r.status === 'COMPLETED');

      setOpenRequestsCount(open.length);
      setInProgressRequestsCount(inProg.length);
      setCompletedRequestsCount(comp.length);

      if (isUser) {
        const sortedDocs = sortByLatestScheduled(docs);
        setFeedRequests(sortedDocs.slice(0, 4));
        setLoading(false);
      }
    }, (err) => console.warn('Dashboard my requests snapshot error:', err));

    // 2. Employee Missions listener
    const myTasksQuery = query(
      collection(db, 'helpTasks'),
      where('helperId', '==', user.uid)
    );
    const unsubMyTasks = onSnapshot(myTasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpTask));
      const inProg = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'SCHEDULED');
      const comp = tasks.filter(t => t.status === 'COMPLETED');
      setEmployeeMissionsCount(inProg.length);
      setEmployeeCompletedCount(comp.length);
    }, (err) => console.warn('Dashboard tasks snapshot error:', err));

    // 3. Employee Dept Feed listener
    let unsubDept: (() => void) | undefined;
    if (isEmployee && profile?.department) {
      const deptReqQuery = query(
        collection(db, 'helpRequests'),
        where('status', '==', 'OPEN')
      );
      unsubDept = onSnapshot(deptReqQuery, (snapshot) => {
        const allOpen = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
        const openRequests = allOpen.filter(r => 
          r.requesterId !== user.uid && 
          r.categoryId?.trim().toLowerCase() === profile.department?.trim().toLowerCase()
        );
        
        // Evaluate SLA
        openRequests.forEach(r => evaluateAndEscalateRequest(r));
        setDeptOpenCount(openRequests.length);
        setDeptOpenRequests(openRequests);

        const sortedDeptReqs = sortByLatestScheduled(openRequests);
        setFeedRequests(sortedDeptReqs.slice(0, 4));
        setLoading(false);
      }, (err) => {
        console.warn('Dashboard dept requests feed error:', err);
        setLoading(false);
      });
    }

    // 4. Pending offers listener (for citizen instant accept on dashboard)
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
    }, (err) => console.warn('Dashboard incoming offers error:', err));

    return () => {
      unsubMyReq();
      unsubMyTasks();
      if (unsubDept) unsubDept();
      unsubIncoming();
    };
  }, [user, isUser, isEmployee, profile?.department]);

  // Urgent Department Requests (SLA approaching deadline <= 120m, overdue, or marked URGENT)
  const urgentDeptRequests = React.useMemo(() => {
    if (!isEmployee || !profile?.department) return [];
    return deptOpenRequests.filter(req => {
      if (req.status !== 'OPEN') return false;
      const deptMatch = req.categoryId?.trim().toLowerCase() === profile.department?.trim().toLowerCase();
      if (!deptMatch) return false;
      if (req.isEscalated || req.priority === 'URGENT') return true;
      const mins = getMinutesUntilDeadline(req.date, req.startTime);
      return mins !== null && mins <= 120;
    });
  }, [deptOpenRequests, isEmployee, profile?.department]);

  const handleDirectClaimEmergencyTask = async (req: HelpRequest) => {
    if (!user || !profile || !req.id) return;
    setClaimingTaskId(req.id);
    try {
      await directAcceptTask(req, {
        uid: user.uid,
        fullName: profile.fullName || 'Department Specialist'
      });
      alert(`Emergency mission "${req.title}" claimed successfully! Handshake code generated.`);
      router.push('/tasks');
    } catch (err: any) {
      console.error('Error claiming emergency task:', err);
      alert(err.message || 'Failed to claim task.');
    } finally {
      setClaimingTaskId(null);
    }
  };

  const handleAcceptOfferDirectly = async (req: HelpRequest, offer: HelpOffer) => {
    if (!req.id || !offer.id) return;
    setAcceptingOfferId(offer.id);
    try {
      const allOffers = incomingOffersByReqId[req.id] || [offer];
      await acceptHelpOffer(req, offer, allOffers);
    } catch (err: any) {
      console.error('Error accepting offer directly from dashboard:', err);
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

  if (authLoading || !user || !profile || !profile.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-600 border-blue-200';
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
      <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300 text-slate-900">
        {/* Futuristic Hero Greeting Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 p-5 sm:p-6 border border-slate-200/90 shadow-xs">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-blue-500/8 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-52 h-52 bg-indigo-500/8 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 rounded-full text-[11px] font-semibold text-blue-700 border border-blue-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>
                  {isUser ? 'Client Service Portal Live' : `${profile.department || 'Field'} Operations Terminal`}
                </span>
              </div>
              
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                Welcome back, <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">{profile.fullName}</span>
              </h1>
              
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                {isUser 
                  ? "Book and monitor professional neighborhood assistance across Medical, Groceries, Electrical, and Plumbing with verified 4-digit completion codes."
                  : `Serve verified requests in the ${profile.department} category, submit specialist proposals, and execute field missions.`}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
              {isUser ? (
                <>
                  <Button
                    onClick={() => openCreateRequest()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 h-9 rounded-xl shadow-xs gap-1.5 transition-all text-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ask for Help</span>
                  </Button>
                  <Link
                    href="/tasks"
                    className="px-3.5 h-9 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-medium text-xs border border-slate-200 transition-all cursor-pointer"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                    <span>My Requests</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/discover"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 h-9 rounded-xl shadow-xs gap-1.5 inline-flex items-center transition-all text-xs cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Claim Department Jobs</span>
                  </Link>
                  <Link
                    href="/tasks"
                    className="px-3.5 h-9 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-medium text-xs border border-slate-200 transition-all cursor-pointer"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                    <span>My Missions</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {isUser ? (
            <>
              {/* User Stat 1: Open Requests */}
              <Link href="/tasks" className="group">
                <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Open Requests</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                    {loading ? <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" /> : openRequestsCount}
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Awaiting specialist</span>
                    <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      View <ArrowRight className="w-3 h-3" />
                    </span>
                  </p>
                </div>
              </Link>

              {/* User Stat 2: In Progress / Assigned */}
              <Link href="/tasks" className="group">
                <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Services</span>
                    <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-cyan-600 group-hover:text-white transition-all">
                      <Wrench className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                    {loading ? <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" /> : inProgressRequestsCount}
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Technician assigned</span>
                    <span className="text-cyan-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      View Codes <ArrowRight className="w-3 h-3" />
                    </span>
                  </p>
                </div>
              </Link>

              {/* User Stat 3: Completed Services */}
              <Link href="/tasks" className="group">
                <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Completed Services</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                    {loading ? <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" /> : completedRequestsCount}
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Verified deliveries</span>
                    <span className="text-emerald-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      View History <ArrowRight className="w-3 h-3" />
                    </span>
                  </p>
                </div>
              </Link>
            </>
          ) : (
            <>
              {/* Employee Stat 1: Dept Open Leads */}
              <Link href="/discover" className="group">
                <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Available Leads</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                    {loading ? <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" /> : deptOpenCount}
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>{profile?.department || 'Department'} Queue</span>
                    <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Claim <ArrowRight className="w-3 h-3" />
                    </span>
                  </p>
                </div>
              </Link>

              {/* Employee Stat 2: Active Missions */}
              <Link href="/tasks" className="group">
                <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Missions</span>
                    <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-cyan-600 group-hover:text-white transition-all">
                      <Wrench className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                    {loading ? <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" /> : employeeMissionsCount}
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Fulfill & Verify</span>
                    <span className="text-cyan-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </p>
                </div>
              </Link>

              {/* Employee Stat 3: Completed */}
              <Link href="/tasks" className="group">
                <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Completed Missions</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                    {loading ? <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" /> : employeeCompletedCount}
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Handshakes verified</span>
                    <span className="text-emerald-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      History <ArrowRight className="w-3 h-3" />
                    </span>
                  </p>
                </div>
              </Link>
            </>
          )}
        </div>

        {/* Live Requests Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{isUser ? 'My Service Requests' : `Available ${profile.department || ''} Leads`}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                {isUser 
                  ? "Status of your submitted requests and direct access to technician communication."
                  : `Incoming citizen requests needing ${profile.department || 'field'} intervention.`}
              </p>
            </div>
            <Link
              href={isUser ? "/tasks" : "/discover"}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
            >
              {isUser ? 'View All My Requests' : 'Explore All Leads'} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : feedRequests.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center border-dashed border-slate-200">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {isUser ? 'No active service requests' : 'All caught up!'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isUser 
                  ? 'Need help with Medical, Groceries, Electrical, or Plumbing in your area?'
                  : `No pending ${profile?.department || ''} requests at this moment.`}
              </p>
              {isUser && (
                <Button
                  onClick={() => openCreateRequest()}
                  className="mt-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 h-8 rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Create a Service Request
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {feedRequests.map((request) => {
                const dist = getRequestDistance(
                  request.coordinates,
                  liveCoords || profile?.coordinates,
                  request.location,
                  profile?.area
                );
                const distFormatted = formatDistance(dist);
                const minutesLeft = getMinutesUntilDeadline(request.date, request.startTime);
                const isUrgentSla = request.isEscalated || (request.status === 'OPEN' && (request.priority === 'URGENT' || (minutesLeft !== null && minutesLeft <= 120)));

                return (
                  <div 
                    key={request.id}
                    onClick={() => setSelectedDetailRequest(request)}
                    className={cn(
                      "rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col justify-between group",
                      isUrgentSla
                        ? "bg-rose-50/85 border-2 border-rose-300 hover:border-rose-400 shadow-sm hover:shadow-md ring-1 ring-rose-200/70"
                        : "glass-card"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getPriorityColor(request.priority))}>
                            {request.priority}
                          </span>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getStatusBadge(request.status))}>
                            {request.status.replace('_', ' ')}
                          </span>
                          {/* Distance Badge */}
                          {distFormatted && (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                              isUrgentSla ? "text-rose-700 bg-white/80 border-rose-200" : "text-emerald-700 bg-emerald-50/90 border-emerald-200"
                            )}>
                              <Navigation className={cn("w-2.5 h-2.5 shrink-0", isUrgentSla ? "text-rose-600" : "text-emerald-600")} />
                              <span>{distFormatted}</span>
                            </span>
                          )}
                          {isUrgentSla && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-600 text-white border border-rose-700 animate-pulse flex items-center gap-1 shadow-2xs font-mono">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Urgent SLA{minutesLeft !== null ? (minutesLeft <= 0 ? ' (OVERDUE)' : ` (${minutesLeft}m left)`) : ''}</span>
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded border",
                          isUrgentSla ? "bg-white/80 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200"
                        )}>
                          {request.categoryId}
                        </span>
                      </div>

                      <h4 className="font-semibold text-sm text-slate-900 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                        {request.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {request.description}
                      </p>

                      {/* Citizen View: Direct Card-Level Incoming Proposal Banner & Accept Action */}
                      {isUser && request.status === 'OFFER_RECEIVED' && (
                        <div 
                          className="mb-3 p-2.5 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-blue-50/80 border border-emerald-200/90 rounded-xl shadow-2xs space-y-2 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                Specialist Proposal
                              </span>
                            </div>
                            {(incomingOffersByReqId[request.id!]?.length || 0) > 1 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {incomingOffersByReqId[request.id!].length} offers
                              </span>
                            )}
                          </div>

                          {(() => {
                            const offersForReq = incomingOffersByReqId[request.id!] || [];
                            const latestOffer = offersForReq[0];

                            if (!latestOffer) {
                              return (
                                <div className="text-xs text-slate-500 italic py-1 flex items-center justify-between">
                                  <span>Offer received. Tap to view details.</span>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="flex items-start gap-2 bg-white/90 p-1.5 rounded-lg border border-emerald-100/90 shadow-2xs">
                                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                                    {latestOffer.helperName ? latestOffer.helperName.charAt(0).toUpperCase() : 'S'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-bold text-slate-800 truncate">
                                        {latestOffer.helperName}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-600 italic line-clamp-1">
                                      "{latestOffer.message || 'I would like to volunteer and help with this request!'}"
                                    </p>
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  disabled={acceptingOfferId === latestOffer.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptOfferDirectly(request, latestOffer);
                                  }}
                                  className="w-full h-7 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  {acceptingOfferId === latestOffer.id ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Accepting...</span>
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

                      {/* Citizen View: In-Progress Handshake info & Chat button */}
                      {isUser && request.status === 'IN_PROGRESS' && request.completionCode && (
                        <div className="mb-2.5 p-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                            <div>
                              <span className="text-[9px] uppercase font-bold text-blue-600 block">Code</span>
                              <span className="font-mono text-sm font-extrabold text-blue-900">{request.completionCode}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(request.completionCode!, request.id!)}
                              className="p-1 rounded bg-white text-blue-600 border border-blue-200 hover:bg-blue-100 text-[10px] font-semibold"
                            >
                              {copiedCodeId === request.id ? 'Copied' : 'Copy'}
                            </button>
                            <TaskChatButton
                              requestId={request.id!}
                              variant="blue"
                              onClick={() => setChatSession({
                                requestId: request.id!,
                                taskTitle: request.title,
                                partnerName: request.selectedHelperName || 'Technician',
                                partnerRole: 'Specialist'
                              })}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <a
                        href={getGoogleMapsUrl(request.location, request.coordinates)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 truncate max-w-[150px] hover:text-blue-600 transition-colors cursor-pointer group"
                        title="Open location in Google Maps"
                      >
                        <MapPin className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                        <span className="truncate group-hover:underline">{request.location}</span>
                      </a>
                      <span className="font-semibold text-blue-600 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-xs">
                        View Details &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Navigation Pathways */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Fast Pathways</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {isUser ? (
              <>
                <div onClick={() => openCreateRequest()} className="cursor-pointer group">
                  <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Ask for Help</h3>
                      <p className="text-[11px] text-slate-400 truncate">Book Medical, Groceries, etc.</p>
                    </div>
                  </div>
                </div>

                <Link href="/tasks" className="group">
                  <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                    <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shrink-0">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors">My Requests</h3>
                      <p className="text-[11px] text-slate-400 truncate">Codes & technician chat</p>
                    </div>
                  </div>
                </Link>

                <Link href="/settings" className="group">
                  <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-700 group-hover:text-white transition-all shrink-0">
                      <SettingsIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Settings</h3>
                      <p className="text-[11px] text-slate-400 truncate">Address & preferences</p>
                    </div>
                  </div>
                </Link>
              </>
            ) : (
              <>
                <Link href="/discover" className="group">
                  <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Dept Job Queue</h3>
                      <p className="text-[11px] text-slate-400 truncate">Claim open service leads</p>
                    </div>
                  </div>
                </Link>

                <Link href="/tasks" className="group">
                  <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                    <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shrink-0">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors">My Missions</h3>
                      <p className="text-[11px] text-slate-400 truncate">Codes & execution</p>
                    </div>
                  </div>
                </Link>

                <Link href="/settings" className="group">
                  <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                      <SettingsIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Settings</h3>
                      <p className="text-[11px] text-slate-400 truncate">Profile & active duty</p>
                    </div>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Help Request Detail Modal */}
        <HelpDetailModal
          request={selectedDetailRequest}
          onClose={() => setSelectedDetailRequest(null)}
        />

        {/* Task Chat & Voice Notes Modal */}
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
