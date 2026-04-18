import React, { useState, useEffect } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import useLiveTracking from "../hooks/useLiveTracking";
import { FaMotorcycle, FaStore, FaHome } from "react-icons/fa";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const MapView = ({ order }) => {
  const { location: deliveryPartnerLocation } = useLiveTracking(order._id);
  const [route, setRoute] = useState(null);
  const [eta, setEta] = useState(null);
  const [viewport, setViewport] = useState({
    latitude: 28.6139, // Default to Delhi
    longitude: 77.209,
    zoom: 11,
  });

  const restaurantLocation = order?.restaurant?.address?.location || order?.restaurant?.location || null;
  const userLocation = order?.deliveryAddress?.location || null;

  useEffect(() => {
    if (userLocation) {
      setViewport((prev) => ({
        ...prev,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      }));
    }
  }, [userLocation]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!restaurantLocation || !userLocation || !MAPBOX_TOKEN) return;

      const activeOrigin = deliveryPartnerLocation || restaurantLocation;
      const coordinates = `${activeOrigin.lng},${activeOrigin.lat};${userLocation.lng},${userLocation.lat}`;

      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
        );
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          setRoute(data.routes[0].geometry);
          setEta(Math.round(data.routes[0].duration / 60)); // ETA in minutes
        }
      } catch (error) {
        console.error("Error fetching Mapbox directions:", error);
      }
    };

    fetchRoute();
    const interval = setInterval(fetchRoute, 30000); // Refresh route every 30 seconds

    return () => clearInterval(interval);
  }, [restaurantLocation, userLocation, deliveryPartnerLocation]);

  return (
    <div className="relative h-96 w-full rounded-lg overflow-hidden shadow-lg">
      <Map
        {...viewport}
        onMove={(evt) => setViewport(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={viewport}
      >
        {/* Restaurant Marker */}
        {restaurantLocation && (
          <Marker longitude={restaurantLocation.lng} latitude={restaurantLocation.lat} anchor="bottom">
            <FaStore className="text-blue-600 text-3xl" />
          </Marker>
        )}

        {/* User's Home Marker */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="bottom">
            <FaHome className="text-green-600 text-3xl" />
          </Marker>
        )}

        {/* Delivery Partner Marker */}
        {deliveryPartnerLocation && (
          <Marker longitude={deliveryPartnerLocation.lng} latitude={deliveryPartnerLocation.lat} anchor="bottom">
            <FaMotorcycle className="text-red-600 text-4xl animate-pulse" />
          </Marker>
        )}

        {/* Route Polyline */}
        {route && (
          <Source id="route" type="geojson" data={{ type: "Feature", geometry: route }}>
            <Layer
              id="route"
              type="line"
              paint={{
                "line-color": "#1c64f2",
                "line-width": 6,
                "line-opacity": 0.8,
              }}
            />
          </Source>
        )}
      </Map>
      {eta && (
        <div className="absolute top-2 right-2 bg-white p-2 rounded-md shadow-md font-bold">
          Estimated Delivery: {eta} mins
        </div>
      )}
    </div>
  );
};

export default MapView;
