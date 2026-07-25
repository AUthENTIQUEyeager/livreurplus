"use client";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

const iconLivreur = divIcon({
  className: "",
  html: '<div class="livreur-pin"></div>',
  iconSize: [16, 16],
});

const iconDestination = divIcon({
  className: "",
  html:
    '<div style="width:14px;height:14px;border-radius:9999px;background:#12141C;border:2px solid white;box-shadow:0 1px 4px rgba(18,20,28,0.3)"></div>',
  iconSize: [14, 14],
});

function Recentrer({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [JSON.stringify(points), map]);
  return null;
}

export default function LiveMap({
  livreur,
  destination,
  hauteur = "280px",
}: {
  livreur?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  hauteur?: string;
}) {
  const points: [number, number][] = [];
  if (livreur) points.push([livreur.lat, livreur.lng]);
  if (destination) points.push([destination.lat, destination.lng]);

  const centre: [number, number] = points[0] ?? [11.1771, -4.2979]; // Bobo-Dioulasso

  return (
    <div style={{ height: hauteur }} className="overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={centre}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {livreur && <Marker position={[livreur.lat, livreur.lng]} icon={iconLivreur} />}
        {destination && <Marker position={[destination.lat, destination.lng]} icon={iconDestination} />}
        <Recentrer points={points} />
      </MapContainer>
    </div>
  );
}
