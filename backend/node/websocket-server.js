/**
 * TripSalama - WebSocket Server
 * Serveur temps réel pour le tracking véhicule
 *
 * Port: 8081
 * Usage: node websocket-server.js
 */

'use strict';

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Configuration
const PORT = process.env.WS_PORT || 8081;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

// Créer le serveur HTTP
const server = http.createServer((req, res) => {
    // Endpoint de santé
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            connections: wss.clients.size,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

// Créer le serveur WebSocket
const wss = new WebSocket.Server({
    server,
    path: '/ws'
});

// Storage des connexions
const clients = new Map();        // clientId -> WebSocket
const rideRooms = new Map();      // rideId -> Set<clientId>
const clientRides = new Map();    // clientId -> Set<rideId>

// Générer un ID unique
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

// Logs avec timestamp
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

// Gérer une nouvelle connexion
wss.on('connection', (ws, req) => {
    const clientId = generateId();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    log(`Nouvelle connexion: ${clientId} depuis ${clientIp}`);

    // Stocker le client
    clients.set(clientId, ws);
    clientRides.set(clientId, new Set());

    // Métadonnées du client
    ws.clientId = clientId;
    ws.isAlive = true;
    ws.userId = null;

    // Heartbeat
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Message reçu
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(ws, message);
        } catch (error) {
            log(`Erreur parsing message de ${clientId}:`, error.message);
            sendError(ws, 'Invalid JSON');
        }
    });

    // Déconnexion
    ws.on('close', (code, reason) => {
        log(`Déconnexion: ${clientId} (code: ${code})`);
        handleDisconnect(clientId);
    });

    // Erreur
    ws.on('error', (error) => {
        log(`Erreur client ${clientId}:`, error.message);
    });

    // Envoyer l'ID client
    send(ws, 'connected', { clientId });
});

// Traiter un message
function handleMessage(ws, message) {
    const { type, data } = message;
    const clientId = ws.clientId;

    log(`Message de ${clientId}: ${type}`, data);

    switch (type) {
        case 'auth':
            // Authentification du client
            ws.userId = data.userId;
            send(ws, 'auth_success', { userId: data.userId });
            break;

        case 'join_ride':
            // Rejoindre le room d'une course
            joinRideRoom(clientId, data.rideId);
            break;

        case 'leave_ride':
            // Quitter le room d'une course
            leaveRideRoom(clientId, data.rideId);
            break;

        case 'position':
            // Position GPS - broadcast aux autres membres du room
            broadcastToRide(data.rideId, 'position', data, clientId);
            break;

        case 'ride_status':
            // Changement de statut - broadcast à tous
            broadcastToRide(data.rideId, 'ride_status', data);
            break;

        case 'ping':
            // Heartbeat
            send(ws, 'pong');
            break;

        case 'message':
            // Message chat
            broadcastToRide(data.rideId, 'message', data);
            break;

        default:
            log(`Type de message inconnu: ${type}`);
    }
}

// Rejoindre un room de course
function joinRideRoom(clientId, rideId) {
    if (!rideRooms.has(rideId)) {
        rideRooms.set(rideId, new Set());
    }
    rideRooms.get(rideId).add(clientId);
    clientRides.get(clientId).add(rideId);

    log(`Client ${clientId} a rejoint ride ${rideId}`);

    const ws = clients.get(clientId);
    if (ws) {
        send(ws, 'joined_ride', { rideId, members: rideRooms.get(rideId).size });
    }
}

// Quitter un room de course
function leaveRideRoom(clientId, rideId) {
    if (rideRooms.has(rideId)) {
        rideRooms.get(rideId).delete(clientId);

        // Supprimer le room s'il est vide
        if (rideRooms.get(rideId).size === 0) {
            rideRooms.delete(rideId);
        }
    }

    if (clientRides.has(clientId)) {
        clientRides.get(clientId).delete(rideId);
    }

    log(`Client ${clientId} a quitté ride ${rideId}`);
}

// Gérer la déconnexion
function handleDisconnect(clientId) {
    // Quitter tous les rooms
    if (clientRides.has(clientId)) {
        for (const rideId of clientRides.get(clientId)) {
            leaveRideRoom(clientId, rideId);
        }
        clientRides.delete(clientId);
    }

    // Supprimer le client
    clients.delete(clientId);
}

// Envoyer un message à un client
function send(ws, type, data = {}) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
}

// Envoyer une erreur
function sendError(ws, message) {
    send(ws, 'error', { message });
}

// Broadcast à tous les membres d'une course
function broadcastToRide(rideId, type, data, excludeClientId = null) {
    if (!rideRooms.has(rideId)) {
        return;
    }

    const members = rideRooms.get(rideId);
    log(`Broadcast ${type} à ride ${rideId} (${members.size} membres)`);

    for (const clientId of members) {
        if (clientId === excludeClientId) continue;

        const ws = clients.get(clientId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            send(ws, type, data);
        }
    }
}

// Broadcast global
function broadcast(type, data) {
    for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) {
            send(ws, type, data);
        }
    }
}

// Heartbeat - vérifier les connexions mortes
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            log(`Client ${ws.clientId} ne répond plus, déconnexion`);
            ws.terminate();
            return;
        }

        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

// Cleanup à l'arrêt
wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

// Démarrer le serveur
server.listen(PORT, () => {
    log(`WebSocket Server démarré sur le port ${PORT}`);
    log(`Endpoint santé: http://localhost:${PORT}/health`);
});

// Gestion des signaux
process.on('SIGTERM', () => {
    log('SIGTERM reçu, arrêt en cours...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    log('SIGINT reçu, arrêt en cours...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});

module.exports = { wss, broadcast, broadcastToRide };
