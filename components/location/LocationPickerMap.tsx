"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerMapProps {
  position: { lat: number; lng: number } | null;
  onPositionChange: (pos: { lat: number; lng: number }) => void;
}

function LocationMarker({ 
  position, 
  setPosition 
}: { 
  position: { lat: number; lng: number } | null; 
  setPosition: (pos: { lat: number; lng: number }) => void 
}) {
  const map = useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  useEffect(() => {
    if (position && typeof position.lat === 'number' && typeof position.lng === 'number') {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 14));
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={[position.lat, position.lng]} />
  );
}

export default function LocationPickerMap({ position, onPositionChange }: LocationPickerMapProps) {
  const centerPos = position ? [position.lat, position.lng] as [number, number] : [40.7128, -74.0060] as [number, number];

  return (
    <div className="h-[220px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative z-0 mt-1.5">
      <MapContainer 
        center={centerPos} 
        zoom={position ? 15 : 3} 
        scrollWheelZoom={true} 
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={onPositionChange} />
      </MapContainer>
    </div>
  );
}
