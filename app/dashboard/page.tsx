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
  Settings as SettingsIcon
} from 'lucide-react';
import { HelpRequest, HelpTask } from '@/types';
import { cn } from '@/lib/utils';
import { getRequestDistance, formatDistance } from '@/lib/distance';
import HelpDetailModal from '@/components/requests/HelpDetailModal';
import AppLayout from '@/components/layout/AppLayout';

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { openCreateRequest } = useModal();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);
  const [upcomingTasksCount, setUpcomingTasksCount] = useState(0);
  const [completedHelpsCount, setCompletedHelpsCount] = useState(0);
  const [recentCommunityRequests, setRecentCommunityRequests] = useState<HelpRequest[]>([]);
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<HelpRequest | null>(null);

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

    // 1. Live listener for my requests (Active requests count)
    const myReqQuery = query(
      collection(db, 'helpRequests'),
      where('requesterId', '==', user.uid)
    );
    const unsubMyReq = onSnapshot(myReqQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      const active = docs.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
      setActiveRequestsCount(active.length);
    }, (err) => console.warn('Dashboard my requests snapshot error:', err));

    // 2. Live listener for tasks where I am helping (Upcoming & Completed counts)
    const myTasksQuery = query(
      collection(db, 'helpTasks'),
      where('helperId', '==', user.uid)
    );
    const unsubMyTasks = onSnapshot(myTasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpTask));
      const upcoming = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      const completed = tasks.filter(t => t.status === 'COMPLETED');
      setUpcomingTasksCount(upcoming.length);
      setCompletedHelpsCount(completed.length);
    }, (err) => console.warn('Dashboard tasks snapshot error:', err));

    // 3. Live listener for open community requests to discover
    const openReqQuery = query(
      collection(db, 'helpRequests'),
      where('status', '==', 'OPEN')
    );
    const unsubOpenReq = onSnapshot(openReqQuery, (snapshot) => {
      let openRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      openRequests = openRequests.filter(r => r.requesterId !== user.uid);
      openRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentCommunityRequests(openRequests.slice(0, 3));
      setLoading(false);
    }, (err) => {
      console.warn('Dashboard community requests error:', err);
      setLoading(false);
    });

    return () => {
      unsubMyReq();
      unsubMyTasks();
      unsubOpenReq();
    };
  }, [user]);

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

  return (
    <AppLayout>
      <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300">
        {/* Futuristic Hero Greeting Banner (Clean White Theme - Compact & Proportional) */}
        <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 p-5 sm:p-6 border border-slate-200/90 shadow-xs">
          {/* Glow ambient meshes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-blue-500/8 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-52 h-52 bg-indigo-500/8 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 rounded-full text-[11px] font-semibold text-blue-700 border border-blue-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Hyperlocal Network Live</span>
              </div>
              
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                Welcome back, <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">{profile.fullName}</span>
              </h1>
              
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Your neighborhood favor exchange is active. View your active requests, task commitments, and nearby opportunities.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
              <Button
                onClick={() => openCreateRequest()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 h-9 rounded-xl shadow-xs gap-1.5 transition-all text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ask for Help</span>
              </Button>
              <Link
                href="/discover"
                className="px-3.5 h-9 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-medium text-xs border border-slate-200 transition-all cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span>Explore</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Futuristic Live Stat Cards (Compact) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Active Requests */}
          <Link href="/tasks" className="group">
            <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">My Requests</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                {loading ? (
                  <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" />
                ) : (
                  activeRequestsCount
                )}
              </div>

              <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Open favor requests</span>
                <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </span>
              </p>
            </div>
          </Link>

          {/* Upcoming Tasks */}
          <Link href="/tasks" className="group">
            <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Helping Tasks</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                {loading ? (
                  <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" />
                ) : (
                  upcomingTasksCount
                )}
              </div>

              <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Active commitments</span>
                <span className="text-emerald-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </span>
              </p>
            </div>
          </Link>

          {/* Completed Helps */}
          <Link href="/tasks" className="group">
            <div className="glass-card rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Favors Completed</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shadow-xs group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5">
                {loading ? (
                  <span className="inline-block w-10 h-8 bg-slate-200 animate-pulse rounded-lg" />
                ) : (
                  completedHelpsCount
                )}
              </div>

              <p className="text-[11px] font-medium text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Verified impacts</span>
                <span className="text-purple-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </span>
              </p>
            </div>
          </Link>
        </div>

        {/* Live Recent Community Requests */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Nearby Help Requests</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Neighbors nearby waiting for a helping hand.</p>
            </div>
            <Link
              href="/discover"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
            >
              Explore all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : recentCommunityRequests.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center border-dashed border-slate-200">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">All caught up!</h4>
              <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">No pending requests in your area at this moment. You can create a request anytime.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {recentCommunityRequests.map((request) => {
                const dist = getRequestDistance(
                  request.coordinates,
                  profile?.coordinates,
                  request.location,
                  profile?.area
                );
                const distFormatted = formatDistance(dist);

                return (
                  <div 
                    key={request.id}
                    onClick={() => setSelectedDetailRequest(request)}
                    className="glass-card rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getPriorityColor(request.priority))}>
                            {request.priority}
                          </span>
                          {distFormatted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50/90 px-2 py-0.5 rounded-md border border-blue-200">
                              <Navigation className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                              <span>{distFormatted}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          by {request.requesterName}
                        </span>
                      </div>

                      <h4 className="font-semibold text-sm text-slate-900 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                        {request.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {request.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1.5 truncate max-w-[130px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{request.location}</span>
                      </span>
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

        {/* Quick Navigation Cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Fast Pathways</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href="/discover" className="group">
              <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                  <Navigation className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Discover Help</h3>
                  <p className="text-[11px] text-slate-400 truncate">Explore community offers</p>
                </div>
              </div>
            </Link>
            
            <Link href="/tasks" className="group">
              <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:-translate-y-0.5">
                <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shrink-0">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors">My Tasks</h3>
                  <p className="text-[11px] text-slate-400 truncate">Codes & commitments</p>
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
                  <p className="text-[11px] text-slate-400 truncate">Profile & security</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Help Request Detail Modal */}
        <HelpDetailModal
          request={selectedDetailRequest}
          onClose={() => setSelectedDetailRequest(null)}
        />
      </div>
    </AppLayout>
  );
}
