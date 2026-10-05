"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Navigation, X } from 'lucide-react';
import { Button } from '../ui/Button';

import { resolveCoordinates, Coordinates } from '@/lib/distance';

// Dynamically import Leaflet Map to completely prevent SSR window errors
const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400 mt-1.5 animate-pulse">
      Loading interactive map...
    </div>
  )
});

interface LocationPickerProps {
  onLocationSelect: (location: string, coordinates?: { lat: number; lng: number }) => void;
  defaultLocation?: string;
  initialCoordinates?: { lat: number; lng: number } | null;
}

export default function LocationPicker({ 
  onLocationSelect, 
  defaultLocation,
  initialCoordinates 
}: LocationPickerProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initialCoordinates || null
  );
  const [address, setAddress] = useState(defaultLocation || '');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(!!initialCoordinates);

  // Synchronize address when defaultLocation prop updates (e.g. after profile/request data loads asynchronously)
  useEffect(() => {
    if (defaultLocation !== undefined) {
      setAddress(defaultLocation);
    }
  }, [defaultLocation]);

  // Synchronize position when initialCoordinates prop updates
  useEffect(() => {
    if (initialCoordinates) {
      setPosition(initialCoordinates);
    }
  }, [initialCoordinates]);

  // Debounced forward geocoding for typed text to get exact coordinates
  useEffect(() => {
    if (!address || address.length < 3 || address.includes('@')) return;

    // First attempt instant local resolution
    const localMatch = resolveCoordinates(null, address);
    if (localMatch) {
      setPosition(localMatch);
      onLocationSelect(address, localMatch);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const query = encodeURIComponent(`${address.trim()}, Kerala, India`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            const newCoords = { lat, lng };
            setPosition(newCoords);
            onLocationSelect(address, newCoords);
          }
        }
      } catch (e) {
        // Silently fallback to deterministic local coords
        const fallback = resolveCoordinates(null, address);
        if (fallback) {
          setPosition(fallback);
          onLocationSelect(address, fallback);
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [address]);

  // Reverse Geocoding to get readable address from coordinates
  const fetchAddress = async (lat: number, lng: number) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
        onLocationSelect(data.display_name, { lat, lng });
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      // Fallback
      const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setAddress(fallback);
      onLocationSelect(fallback, { lat, lng });
    } finally {
      setLoadingAddress(false);
    }
  };

  const handlePositionChange = (newPos: { lat: number; lng: number }) => {
    setPosition(newPos);
    fetchAddress(newPos.lat, newPos.lng);
  };

  const handleAutoDetect = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setLoadingAddress(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        fetchAddress(newPos.lat, newPos.lng);
        setIsMapOpen(true);
      },
      (err) => {
        console.error(err);
        alert("Unable to retrieve your location");
        setLoadingAddress(false);
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          autoComplete="off"
          className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-all"
          placeholder="Enter neighborhood or street address..."
          value={address}
          onChange={(e) => {
            e.currentTarget.setCustomValidity('');
            const val = e.target.value;
            setAddress(val);
            const instantCoords = resolveCoordinates(position, val);
            if (instantCoords) {
              setPosition(instantCoords);
            }
            onLocationSelect(val, instantCoords || position || undefined);
          }}
          onInvalid={(e) => {
            e.currentTarget.setCustomValidity('Please fill out Neighborhood Location.');
          }}
          onInput={(e) => {
            e.currentTarget.setCustomValidity('');
          }}
          required
        />
        {address && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setAddress('');
              onLocationSelect('', undefined);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Clear location"
            aria-label="Clear location input"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button 
          type="button" 
          variant="outline" 
          className="h-8 px-3 rounded-lg border-slate-200 hover:bg-slate-100/80 text-slate-700 text-xs font-medium transition-all cursor-pointer"
          onClick={() => setIsMapOpen(!isMapOpen)}
        >
          <MapPin className="h-3.5 w-3.5 mr-1 text-slate-500" />
          {isMapOpen ? 'Hide Map' : 'Show Map'}
        </Button>
        
        <Button 
          type="button" 
          className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all cursor-pointer"
          onClick={handleAutoDetect}
          disabled={loadingAddress}
        >
          <Navigation className="h-3.5 w-3.5 mr-1 text-slate-300" />
          {loadingAddress ? 'Detecting...' : 'Auto Detect GPS'}
        </Button>
      </div>

      {isMapOpen && (
        <LocationPickerMap 
          position={position} 
          onPositionChange={handlePositionChange} 
        />
      )}
    </div>
  );
}
