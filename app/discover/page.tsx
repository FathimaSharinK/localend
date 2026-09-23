"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { HelpRequest } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Sparkles, 
  Pencil, 
  MessageSquare, 
  HandHeart, 
  ArrowRight,
  Navigation,
  LocateFixed,
  SlidersHorizontal,
  Compass,
  AlertTriangle,
  Zap,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getRequestDistance, 
  formatDistance, 
  DISTANCE_FILTERS, 
  Coordinates,
  DEFAULT_HUB_COORDINATES,
  resolveCoordinates,
  getGoogleMapsUrl 
} from '@/lib/distance';
import HelpDetailModal from '@/components/requests/HelpDetailModal';
import CreateRequestModal from '@/components/requests/CreateRequestModal';
import AppLayout from '@/components/layout/AppLayout';

import { DISCOVER_CATEGORIES } from '@/data/categories';
import { evaluateAndEscalateRequest, getMinutesUntilDeadline } from '@/lib/slaEscalation';
import { directAcceptTask } from '@/services/tasks.service';
import TaskChatModal from '@/components/chat/TaskChatModal';
import { sortByLatestScheduled } from '@/lib/sortUtils';

const CATEGORIES = DISCOVER_CATEGORIES;

export default function DiscoverPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile?.role === 'user') {
      router.replace('/tasks');
    }
  }, [profile?.role, router]);

  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRadius, setSelectedRadius] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'nearest' | 'newest'>('nearest');
  
  // Real-time GPS/User coordinates (Always Active)
  const [liveCoords, setLiveCoords] = useState<Coordinates | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<HelpRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<HelpRequest | null>(null);
  const [chatTask, setChatTask] = useState<{ id: string; title: string; partnerName: string; partnerRole: string } | null>(null);

  // Always-Active Continuous Live GPS Watcher
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load instantly from localStorage cache so distances render with 0ms delay
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

    // Immediate high-accuracy position fetch
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveCoords(coords);
        try { localStorage.setItem('localend_live_coords', JSON.stringify(coords)); } catch (e) {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );

    // Continuous watchPosition to keep GPS always active and current
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveCoords(coords);
        try { localStorage.setItem('localend_live_coords', JSON.stringify(coords)); } catch (e) {}
      },
      (err) => console.log('Continuous GPS notice:', err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Effective coordinates: live detected GPS, or profile coordinates, or area lookup, or Perinthalmanna default
  const effectiveCoords: Coordinates = useMemo(() => {
    if (liveCoords && typeof liveCoords.lat === 'number' && !isNaN(liveCoords.lat)) {
      return liveCoords;
    }
    if (profile?.coordinates && typeof profile.coordinates.lat === 'number' && !isNaN(profile.coordinates.lat)) {
      return profile.coordinates;
    }
    const resolved = resolveCoordinates(null, profile?.area);
    if (resolved) return resolved;
    return DEFAULT_HUB_COORDINATES;
  }, [liveCoords, profile?.coordinates, profile?.area]);

  // Clean reference location name (sanitizes email strings)
  const referenceLocationName = useMemo(() => {
    if (liveCoords) return `Live GPS (${liveCoords.lat.toFixed(3)}, ${liveCoords.lng.toFixed(3)})`;
    if (profile?.area && !profile.area.includes('@')) return profile.area;
    return 'Perinthalmanna Hub';
  }, [liveCoords, profile?.area]);

  const handleDetectGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveCoords(coords);
        try { localStorage.setItem('localend_live_coords', JSON.stringify(coords)); } catch (e) {}
        setDetectingGps(false);
      },
      (err) => {
        console.warn("Could not fetch GPS:", err);
        setDetectingGps(false);
        alert("Unable to detect current GPS location. You can configure your area in Settings.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!user) return;

    let q;
    // User sees only their own requests; Employee sees OPEN requests; Admin sees all
    if (profile?.role === 'user') {
      q = query(
        collection(db, 'helpRequests'),
        where('requesterId', '==', user.uid)
      );
    } else {
      q = query(
        collection(db, 'helpRequests'),
        where('status', '==', 'OPEN')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      
      // Auto-evaluate SLA deadlines for open requests
      items.forEach(req => {
        if (req.status === 'OPEN') {
          evaluateAndEscalateRequest(req);
        }
      });

      setRequests(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching discover requests:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile?.role]);

  // Enrich requests with distances and apply radius + category + text filters
  const filteredRequests = useMemo(() => {
    // 1. Calculate distance for every request
    let list = requests.map((r) => {
      const dist = getRequestDistance(
        r.coordinates,
        effectiveCoords,
        r.location,
        profile?.area
      );
      return {
        ...r,
        distanceKm: dist,
        distanceFormatted: formatDistance(dist),
      };
    });

    // 2. Keyword Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
      );
    }

    // 3. Category Filter
    if (selectedCategory !== 'All') {
      list = list.filter((r) => r.categoryId?.toLowerCase() === selectedCategory.toLowerCase());
    }

    // 4. Radius / Distance Filter
    if (selectedRadius !== 'all') {
      const maxKm = Number(selectedRadius);
      list = list.filter((r) => r.distanceKm !== null && r.distanceKm <= maxKm);
    }

    // 5. Sorting (Nearest First vs Newest First)
    if (sortBy === 'nearest') {
      list.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else {
      list = sortByLatestScheduled(list);
    }

    return list;
  }, [requests, searchQuery, selectedCategory, selectedRadius, sortBy, effectiveCoords, profile?.area, profile?.role, profile?.department]);

  const [claimingEmergencyId, setClaimingEmergencyId] = useState<string | null>(null);

  // Urgent Department Requests for Employee (SLA approaching deadline <= 120m, overdue, or marked URGENT)
  const urgentDeptRequests = useMemo(() => {
    if (profile?.role !== 'employee' || !profile?.department) return [];
    return requests.filter(req => {
      if (req.status !== 'OPEN') return false;
      const deptMatch = req.categoryId?.trim().toLowerCase() === profile.department?.trim().toLowerCase();
      if (!deptMatch) return false;
      if (req.isEscalated || req.priority === 'URGENT') return true;
      const mins = getMinutesUntilDeadline(req.date, req.startTime);
      return mins !== null && mins <= 120;
    });
  }, [requests, profile?.role, profile?.department]);

  const handleClaimEmergency = async (req: HelpRequest) => {
    if (!user || !profile || !req.id) return;
    setClaimingEmergencyId(req.id);
    try {
      await directAcceptTask(req, {
        uid: user.uid,
        fullName: profile.fullName || 'Department Specialist'
      });
      alert(`Emergency mission "${req.title}" claimed successfully! Handshake code generated.`);
      router.push('/tasks');
    } catch (err: any) {
      console.error('Error claiming emergency mission:', err);
      alert(err.message || 'Failed to claim mission.');
    } finally {
      setClaimingEmergencyId(null);
    }
  };

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

  const getCategoryLabel = (cat: string) => {
    if (cat === 'Medical') return '🩺 Medical';
    if (cat === 'Groceries') return '🛒 Groceries';
    if (cat === 'Electrical') return '⚡ Electrical';
    if (cat === 'Plumbing') return '🔧 Plumbing';
    return cat;
  };

  return (
    <AppLayout>
      <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300 pb-16 text-slate-900">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {profile?.role === 'employee' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  {profile.department || 'Staff'} Department Job Board
                </span>
              ) : profile?.role === 'user' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Your Citizen Request Explorer
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  All Category Master Explorer
                </span>
              )}
              <span className="text-[11px] text-slate-400 font-mono">Live Sync</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {profile?.role === 'employee' 
                ? `${profile.department || 'Department'} Tasks Awaiting Specialist`
                : profile?.role === 'user'
                ? 'Your Service & Help Requests'
                : 'Browse Neighborhood Requests'}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {profile?.role === 'employee'
                ? `You are viewing open ${profile.department || 'specialized'} requests posted by local citizens. Claim jobs to earn trust points.`
                : profile?.role === 'user'
                ? 'Track your posted requests, technician status, and 4-digit verification tokens.'
                : 'Master view of all 4 service categories: Medical, Groceries, Electrical, and Plumbing.'}
            </p>
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search keyword, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:border-blue-600 shadow-2xs"
            />
          </div>
        </div>

        {/* Filter Controls Stack */}
        <div className="space-y-3">
          {/* Row 1: Category Filter Chips - Accessible for all community members & employees */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('All')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1",
                selectedCategory === 'All'
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span>🌟 All Community Help</span>
            </button>

            {profile?.role === 'employee' && profile?.department && (
              <button
                onClick={() => setSelectedCategory(profile.department!)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 border",
                  selectedCategory.toLowerCase() === profile.department.toLowerCase()
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                    : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                )}
              >
                <span>🎯 My {profile.department} Jobs</span>
              </button>
            )}

            {CATEGORIES.filter(c => c !== 'All').map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1",
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <span>{getCategoryLabel(cat)}</span>
              </button>
            ))}
          </div>

          {/* Row 2: Distance Radius Filter & Sort & GPS Indicator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/90 border border-slate-200/90 rounded-2xl">
            {/* Distance Radius Filter Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mr-1">
                <Navigation className="w-3 h-3 text-blue-600" />
                <span>Radius:</span>
              </span>
              {DISTANCE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setSelectedRadius(f.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border",
                    selectedRadius === f.value
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/70"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Right: Location Reference & Sort Toggle */}
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
              {/* Reference location badge - Always Active GPS */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {liveCoords ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                ) : (
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                )}
                <span className="truncate max-w-[130px] font-bold text-slate-800" title={referenceLocationName}>
                  {liveCoords ? 'Live GPS Active' : referenceLocationName}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Always Active
                </span>
              </div>

              {/* Sort Switcher */}
              <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSortBy('nearest')}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer",
                    sortBy === 'nearest'
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Nearest
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('newest')}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer",
                    sortBy === 'newest'
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Newest
                </button>
              </div>
            </div>
          </div>

          {/* Active Radius Filter Info Banner */}
          {selectedRadius !== 'all' && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-800 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  Showing tasks within <strong>{selectedRadius} km</strong> of <strong>{referenceLocationName}</strong> ({filteredRequests.length} match{filteredRequests.length === 1 ? '' : 'es'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRadius('all')}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer shrink-0"
              >
                Clear radius filter
              </button>
            </div>
          )}
        </div>

        {/* Requests Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2.5">
              <HandHeart className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {profile?.role === 'employee' 
                ? `No open ${profile?.department || ''} requests right now`
                : 'No requests found in this radius'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {profile?.role === 'employee'
                ? `There are currently no open service requests in the ${profile?.department || ''} department. You will be alerted as soon as a citizen requests assistance.`
                : selectedRadius !== 'all'
                ? `There are no requests within ${selectedRadius} km of ${profile?.area || 'your location'}. Try choosing a wider radius or "All Distances".`
                : 'There are no open help requests right now. Check back soon!'}
            </p>
            {selectedRadius !== 'all' && (
              <Button
                size="sm"
                onClick={() => setSelectedRadius('all')}
                className="mt-3.5 h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                View All Distances
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRequests.map((request) => {
              const isOwner = user && request.requesterId === user.uid;
              const minsLeft = getMinutesUntilDeadline(request.date, request.startTime);
              const isUrgentSla = request.isEscalated || (request.status === 'OPEN' && (request.priority === 'URGENT' || (minsLeft !== null && minsLeft <= 120)));

              return (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={cn(
                    "rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between group",
                    isUrgentSla
                      ? "bg-rose-50/85 border-2 border-rose-300 hover:border-rose-400 shadow-sm hover:shadow-md ring-1 ring-rose-200/70"
                      : "bg-white border border-slate-200/85 hover:border-blue-300 shadow-xs hover:shadow-sm"
                  )}
                >
                  <div>
                    {/* Card Top: Badges & Proximity */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getPriorityColor(request.priority))}>
                          {request.priority}
                        </span>
                        {/* Category Badge */}
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                          isUrgentSla ? "bg-white/80 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200"
                        )}>
                          {getCategoryLabel(request.categoryId)}
                        </span>
                        {/* SLA Alert Badge */}
                        {isUrgentSla && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-600 text-white border border-rose-700 animate-pulse flex items-center gap-1 shadow-2xs font-mono">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Urgent SLA{minsLeft !== null ? (minsLeft <= 0 ? ' (OVERDUE)' : ` (${minsLeft}m left)`) : ''}</span>
                          </span>
                        )}
                        {isOwner && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            Your Request
                          </span>
                        )}
                        {/* Distance Badge */}
                        {request.distanceFormatted && (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                            isUrgentSla ? "text-rose-700 bg-white/80 border-rose-200" : "text-blue-700 bg-blue-50/90 border-blue-200"
                          )}>
                            <Navigation className={cn("w-2.5 h-2.5 shrink-0", isUrgentSla ? "text-rose-600" : "text-blue-600")} />
                            <span>{request.distanceFormatted}</span>
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-[11px] font-medium shrink-0",
                        isUrgentSla ? "text-rose-600/80" : "text-slate-400"
                      )}>
                        {isOwner ? 'Posted by You' : `by ${request.requesterName}`}
                      </span>
                    </div>

                    <h3 className={cn(
                      "text-sm font-semibold transition-colors line-clamp-1 mb-1",
                      isUrgentSla ? "text-slate-900 font-bold group-hover:text-rose-700" : "text-slate-900 group-hover:text-blue-600"
                    )}>
                      {request.title}
                    </h3>
                    <p className={cn(
                      "text-xs line-clamp-2 leading-relaxed mb-3",
                      isUrgentSla ? "text-slate-700" : "text-slate-500"
                    )}>
                      {request.description}
                    </p>
                  </div>

                  <div className={cn("space-y-2.5 pt-2.5 border-t", isUrgentSla ? "border-rose-200/80" : "border-slate-100")}>
                    <div className={cn(
                      "flex items-center justify-between text-[11px]",
                      isUrgentSla ? "text-rose-700/80" : "text-slate-500"
                    )}>
                      <a
                        href={getGoogleMapsUrl(request.location, request.coordinates)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 truncate max-w-[170px] hover:underline cursor-pointer group"
                        title="Open location in Google Maps"
                      >
                        <MapPin className={cn("w-3 h-3 shrink-0", isUrgentSla ? "text-rose-500" : "text-slate-400 group-hover:text-blue-600")} />
                        <span className="truncate group-hover:underline">{request.location}</span>
                      </a>
                      {request.date && (
                        <span className={cn(
                          "inline-flex items-center gap-1 font-mono text-[10px]",
                          isUrgentSla ? "text-rose-600" : "text-slate-400"
                        )}>
                          <Calendar className="w-3 h-3" />
                          {request.date}
                        </span>
                      )}
                    </div>

                    {isOwner ? (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequest(request);
                          }}
                          className="flex-1 h-8.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Manage Offers</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRequest(request);
                          }}
                          className="h-8.5 w-8.5 rounded-lg border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0 cursor-pointer"
                          title="Edit Request"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : profile?.role === 'employee' ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                        }}
                        className={cn(
                          "w-full h-8.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          isUrgentSla
                            ? "bg-rose-600 text-white hover:bg-rose-700 font-bold shadow-xs ring-1 ring-rose-500/50"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200/60"
                        )}
                      >
                        {isUrgentSla ? <Zap className="w-3.5 h-3.5" /> : null}
                        <span>{isUrgentSla ? 'Claim Urgent Task' : 'Claim / Offer Service'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                        }}
                        className={cn(
                          "w-full h-8.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          isUrgentSla 
                            ? "bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 font-semibold" 
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                        )}
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help Detail Modal */}
        <HelpDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />

        {/* Edit Request Modal */}
        {editingRequest && (
          <CreateRequestModal
            editRequest={editingRequest}
            onClose={() => setEditingRequest(null)}
          />
        )}

        {/* Real-time Task Chat with Voice Notes Modal */}
        {chatTask && (
          <TaskChatModal
            requestId={chatTask.id}
            taskTitle={chatTask.title}
            otherPartyName={chatTask.partnerName}
            otherPartyRole={chatTask.partnerRole}
            onClose={() => setChatTask(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
