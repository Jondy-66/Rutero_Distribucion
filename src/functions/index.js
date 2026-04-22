
/**
 * @fileoverview Ejemplo de Cloud Function para Geofencing y Reverse Geocoding.
 * Nota: Este archivo es referencial para ser desplegado en el entorno de Firebase Functions.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const turf = require('@turf/turf');
const axios = require('axios');

admin.initializeApp();

exports.onActiveLocationUpdate = functions.firestore
    .document('active_locations/{userId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        const userId = context.params.userId;

        // 1. GEOFENCING CON TURF.JS
        const userPoint = turf.point([newData.lng, newData.lat]);
        
        // Obtener zonas asignadas al usuario
        const zonesSnap = await admin.firestore().collection('zones')
            .where('userId', '==', userId)
            .get();

        let isInside = zonesSnap.empty; // Si no hay zonas, está "dentro" por defecto

        zonesSnap.forEach(doc => {
            const zone = doc.data();
            if (turf.booleanPointInPolygon(userPoint, zone.geoJson)) {
                isInside = true;
            }
        });

        if (!isInside) {
            await admin.firestore().collection('alerts').add({
                userId,
                type: 'out_of_route',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                location: { lat: newData.lat, lng: newData.lng },
                details: 'Usuario fuera del perímetro asignado.'
            });
            await change.after.ref.update({ is_out_of_route: true });
        } else {
            await change.after.ref.update({ is_out_of_route: false });
        }

        // 2. REVERSE GEOCODING CONDICIONAL (> 100 metros)
        const calculateDistance = (p1, p2) => {
            const from = turf.point([p1.lng, p1.lat]);
            const to = turf.point([p2.lng, p2.lat]);
            return turf.distance(from, to) * 1000; // a metros
        };

        if (!oldData || calculateDistance(oldData, newData) > 100) {
            const apiKey = functions.config().google.maps_key;
            try {
                const response = await axios.get(
                    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${newData.lat},${newData.lng}&key=${apiKey}`
                );
                if (response.data.results[0]) {
                    const address = response.data.results[0].formatted_address;
                    await change.after.ref.update({ address_text: address });
                }
            } catch (error) {
                console.error("Geocoding error:", error);
            }
        }

        return null;
    });
