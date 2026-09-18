"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getRequestDistance, 
  formatDistance, 
  DISTANCE_FILTERS, 
  Coordinates 
} from '@/lib/distance';
import HelpDetailModal from '@/components/requests/HelpDetailModal';
import CreateRequestModal from '@/components/requests/CreateRequestModal';
import AppLayout from '@/components/layout/AppLayout';

const CATEGORIES = [
  'All',
  'Moving',
  'Delivery',
  'Shopping',
  'Transportation',
  'Household',
  'Technical Help',
  'Education',
  'Errands',
  'Community Support',
  'Other'
];

export default function DiscoverPage() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRadius, setSelectedRadius] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'nearest' | 'newest'>('nearest');
  
  // Real-time GPS/User coordinates
  const [liveCoords, setLiveCoords] = useState<Coordinates | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<HelpRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<HelpRequest | null>(null);

  // Effective coordinates: live detected GPS, or profile coordinates
  const effectiveCoords: Coordinates | null = useMemo(() => {
    if (liveCoords) return liveCoords;
    if (profile?.coordinates) return profile.coordinates;
    return null;
  }, [liveCoords, profile?.coordinates]);

  const handleDetectGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLiveCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setDetectingGps(false);
      },
      (err) => {
        console.warn("Could not fetch GPS:", err);
        setDetectingGps(false);
        alert("Unable to detect current GPS location. You can configure your area in Settings.");
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    const q = query(
      collection(db, 'helpRequests'),
      where('status', '==', 'OPEN')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      setRequests(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching discover requests:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
      list = list.filter((r) => r.categoryId === selectedCategory);
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
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [requests, searchQuery, selectedCategory, selectedRadius, sortBy, effectiveCoords, profile?.area]);

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
      <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300 pb-16 text-slate-900">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Hyperlocal Community Help
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Live Proximity Feed</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Discover Opportunities to Help
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Browse requests posted by neighbors in your area. Filter by distance and offer assistance nearby.
            </p>
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search keyword, location, skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:border-blue-600 shadow-2xs"
            />
          </div>
        </div>

        {/* Filter Controls Stack */}
        <div className="space-y-3">
          {/* Row 1: Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {cat}
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
              {/* Reference location badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[130px] font-medium text-slate-700">
                  {profile?.area || (liveCoords ? 'Live GPS' : 'Location Not Set')}
                </span>
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={detectingGps}
                  className="ml-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                  title="Detect live GPS location"
                >
                  {detectingGps ? 'Detecting...' : liveCoords ? 'GPS Active' : 'Detect'}
                </button>
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
            <h3 className="text-sm font-bold text-slate-900">No requests found in this radius</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {selectedRadius !== 'all'
                ? `There are no requests within ${selectedRadius} km of ${profile?.area || 'your location'}. Try choosing a wider radius or "All Distances".`
                : searchQuery || selectedCategory !== 'All' 
                ? 'Try adjusting your search or category filter to discover more requests.' 
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

              return (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className="bg-white border border-slate-200/85 hover:border-blue-300 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Card Top: Badges & Proximity */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", getPriorityColor(request.priority))}>
                          {request.priority}
                        </span>
                        {isOwner && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            Your Request
                          </span>
                        )}
                        {/* Distance Badge */}
                        {request.distanceFormatted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50/90 px-2 py-0.5 rounded-md border border-blue-200">
                            <Navigation className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                            <span>{request.distanceFormatted}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {isOwner ? 'Posted by You' : `by ${request.requesterName}`}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                      {request.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                      {request.description}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1.5 truncate max-w-[150px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{request.location}</span>
                      </span>
                      {request.date && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
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
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                        }}
                        className="w-full h-8.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/60 font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Offer Assistance</span>
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
      </div>
    </AppLayout>
  );
}
