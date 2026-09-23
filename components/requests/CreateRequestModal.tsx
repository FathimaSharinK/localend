"use client";

import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HelpPriority, HelpRequest, DepartmentItem } from '@/types';
import { X, Sparkles, MapPin, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import LocationPicker from '@/components/location/LocationPicker';
import { REQUEST_CATEGORIES } from '@/data/categories';
import { subscribeDepartments, DEFAULT_DEPARTMENTS } from '@/services/departments.service';
import { resolveCoordinates } from '@/lib/distance';

export default function CreateRequestModal({ onClose, editRequest }: { onClose: () => void, editRequest?: HelpRequest }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  const [departmentList, setDepartmentList] = useState<DepartmentItem[]>(DEFAULT_DEPARTMENTS);
  const [title, setTitle] = useState(editRequest?.title || '');
  const [description, setDescription] = useState(editRequest?.description || '');
  const [category, setCategory] = useState(editRequest?.categoryId || 'Medical');

  useEffect(() => {
    const unsub = subscribeDepartments((depts) => {
      if (depts && depts.length > 0) {
        setDepartmentList(depts);
        if (!editRequest && !category) {
          setCategory(depts[0].name || depts[0].id || 'Medical');
        }
      }
    });
    return () => unsub();
  }, [editRequest, category]);
  const [priority, setPriority] = useState<HelpPriority>(editRequest?.priority || 'NORMAL');
  const [date, setDate] = useState(editRequest?.date || '');
  const [time, setTime] = useState(editRequest?.startTime || '');
  const [location, setLocation] = useState(editRequest?.location || '');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
    editRequest?.coordinates || profile?.coordinates || null
  );
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!editRequest;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setError('');

    if (!title.trim()) {
      setError('Please provide a Request Title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a Detailed Description.');
      return;
    }
    if (!category) {
      setError('Please select a Department / Category.');
      return;
    }
    if (!priority) {
      setError('Please select an Urgency Level.');
      return;
    }
    if (!date) {
      setError('Please select a Target Date.');
      return;
    }
    if (!time) {
      setError('Please specify a Time Window.');
      return;
    }
    if (!location.trim()) {
      setError('Please enter or detect your Location / Neighborhood Area.');
      return;
    }

    setLoading(true);
    const resolvedCoords = resolveCoordinates(coordinates, location.trim()) || profile?.coordinates || null;

    try {
      if (isEditing && editRequest.id) {
        await updateDoc(doc(db, 'helpRequests', editRequest.id), {
          title: title.trim(),
          description: description.trim(),
          categoryId: category,
          priority,
          date,
          startTime: time,
          location: location.trim(),
          coordinates: resolvedCoords,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'helpRequests'), {
          requesterId: user.uid,
          requesterName: profile.fullName || 'Neighbor',
          title: title.trim(),
          description: description.trim(),
          categoryId: category,
          priority,
          date,
          startTime: time,
          location: location.trim(),
          coordinates: resolvedCoords,
          status: 'OPEN',
          isEscalated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      onClose();
      if (!isEditing) {
        router.push('/dashboard'); 
      } else {
        router.refresh(); 
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save request');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-xl bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag affordance */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isEditing ? 'Modify Request' : 'Broadcast Need for Help'}
              </h2>
              <p className="text-[11px] text-slate-500">Share what assistance you need from neighborhood volunteers</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="rounded-lg h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 flex-1 custom-scrollbar">
          <form id="create-request-form" onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span>Request Title</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <Input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Need help moving heavy sofa down 2 floors"
                className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span>Detailed Description</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <textarea
                className="flex min-h-[75px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all resize-none"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe any tools needed, exact stair flights, timeline flexibility..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span>Select Department / Category</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {departmentList.map((dept) => {
                  const deptKey = dept.name || dept.id;
                  const isSelected = category.toLowerCase() === deptKey.toLowerCase();
                  return (
                    <button
                      key={dept.id || dept.name}
                      type="button"
                      onClick={() => setCategory(deptKey)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 border border-slate-200/80 text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                    >
                      <span>{dept.icon || '🛠️'}</span>
                      <span className="truncate">{dept.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <span>Urgency Level</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  required
                  className="flex h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as HelpPriority)}
                >
                  <option value="LOW">🟢 Low Priority</option>
                  <option value="NORMAL">🔵 Normal Priority</option>
                  <option value="HIGH">🟠 High Priority</option>
                  <option value="URGENT">🔴 Urgent / Critical</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>Target Date</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 text-xs focus:bg-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Time Window</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <Input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 text-xs focus:bg-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Location / Neighborhood Area</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <LocationPicker 
                defaultLocation={location}
                initialCoordinates={coordinates}
                onLocationSelect={(addr, coords) => {
                  setLocation(addr);
                  if (coords) {
                    setCoordinates(coords);
                  }
                }} 
              />
            </div>
          </form>
        </div>
        
        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-100 bg-slate-50/70">
          <Button 
            variant="ghost" 
            type="button" 
            onClick={onClose} 
            className="rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold h-8.5 px-3"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="create-request-form" 
            disabled={loading} 
            className="rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer h-8.5 px-4"
          >
            {loading ? 'Transmitting Request...' : isEditing ? 'Save Changes' : 'Broadcast Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
