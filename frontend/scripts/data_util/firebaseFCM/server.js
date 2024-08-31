import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { defaultServer, mimeTypes } from './serverconfig.js';
import admin from 'firebase-admin';
import cron from 'node-cron';
import dotenv from 'dotenv';
dotenv.config();

let SERVERCONFIG = {};

// Load Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: getEnvVar("FIREBASE_URI")
});

// Utility to read environment variables
function getEnvVar(name, defaultValue) {
    return process.env[name] || defaultValue;
}

// Dummy in-memory storage for user tokens, topic subscriptions, and scheduled notifications (replace with your DB logic)
const userTokens = {}; // { userId: Set(token1, token2, ...) }
const tokenToUser = {}; // { token: userId }
const userSessions = {}; // { sessionId: userId }
const topicSubscriptions = {}; // { topic: Set(userId1, userId2, ...) }
const scheduledNotifications = {}; // { notificationId: { userId, topic, title, body, time, cronJob } }

// Save user token
function saveUserToken(userId, token) {
    if (!userTokens[userId]) {
        userTokens[userId] = new Set();
    }
    userTokens[userId].add(token);
    tokenToUser[token] = userId;
}

// Get user tokens
function getUserTokens(userId) {
    return Array.from(userTokens[userId] || []);
}

// Get userId by token
function getUserIdByToken(token) {
    return tokenToUser[token];
}

// Revoke user token
function revokeUserToken(userId, token) {
    if (userTokens[userId]) {
        userTokens[userId].delete(token);
        if (userTokens[userId].size === 0) {
            delete userTokens[userId];
        }
    }
    delete tokenToUser[token];
}

// Subscribe user to a topic
function subscribeUserToTopic(userId, topic) {
    if (!topicSubscriptions[topic]) {
        topicSubscriptions[topic] = new Set();
    }
    topicSubscriptions[topic].add(userId);
}

// Unsubscribe user from a topic
function unsubscribeUserFromTopic(userId, topic) {
    if (topicSubscriptions[topic]) {
        topicSubscriptions[topic].delete(userId);
        if (topicSubscriptions[topic].size === 0) {
            delete topicSubscriptions[topic];
        }
    }
}

// Schedule a notification
function scheduleNotification(userId, topic, title, body, time) {
    const notificationId = `${userId}_${topic}`;
    if(scheduledNotifications[notificationId]) {
        deleteScheduledNotification(notificationId); //just replace it
    }
    const cronJob = cron.schedule(new Date(time).toISOString().replace(/\.\d{3}Z$/, ''), () => {
        const tokens = [];
        if (topicSubscriptions[topic]) {
            topicSubscriptions[topic].forEach(subscribedUserId => {
                tokens.push(...getUserTokens(subscribedUserId));
            });
        }
        if (tokens.length > 0) { //if not deleted
            const message = {
                notification: { title, body },
                tokens
            };

            //firebase aggregates push notifications for us via cloud, potentially more reliable for us, and free
            admin.messaging().sendMulticast(message)
                .then((response) => {
                    console.log('Successfully sent scheduled message:', response);
                    // Clean up the scheduled notification
                    deleteScheduledNotification(notificationId);
                })
                .catch((error) => {
                    console.log('Error sending scheduled message:', error);
                });
        } else {
            console.log('No tokens found for topic:', topic);
        }
    });

    scheduledNotifications[notificationId] = { userId, topic, title, body, time, cronJob };
    return notificationId;
}

// Delete scheduled notification
function deleteScheduledNotification(notificationId) {
    const notification = scheduledNotifications[notificationId];
    if (notification && notification.cronJob) { //stop the scheduled task
        notification.cronJob.stop();
    }
    delete scheduledNotifications[notificationId];
}

// Get scheduled notifications for a user or topic
function getScheduledNotifications({ userId, topic }) {
    return Object.entries(scheduledNotifications)
        .filter(([, value]) => (userId ? value.userId === userId : true) && (topic ? value.topic === topic : true))
        .map(([key, value]) => ({ notificationId: key, ...value }));
}

// Define a hash table for routes
const routes = {
    "/config": {
        GET: (request, response, cfg) => {
            const config = {
                clientId: getEnvVar('GOOGLE_CLIENT_ID', ''),
                apiKey: getEnvVar('GOOGLE_API_KEY', ''),
                mapsKey: getEnvVar('GOOGLE_MAPS_KEY', ''),
                firebaseConfig: {
                    apiKey: getEnvVar('FIREBASE_API_KEY', ''),
                    authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN', ''),
                    projectId: getEnvVar('FIREBASE_PROJECT_ID', ''),
                    storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET', ''),
                    messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID', ''),
                    appId: getEnvVar('FIREBASE_APP_ID', ''),
                    vapidKey: getEnvVar('FIREBASE_VAPID_KEY', '')
                }
            };
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(config));
        }
    },
    "/save-token": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { sessionId, token } = JSON.parse(body);
                const userId = userSessions[sessionId] || getUserIdByToken(token) || sessionId; // Use existing userId if token found
                userSessions[sessionId] = userId; // Associate sessionId with userId
                saveUserToken(userId, token);
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end('Token saved successfully');
            });
        }
    },
    "/revoke-token": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { userId, token } = JSON.parse(body);
                revokeUserToken(userId, token);
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end('Token revoked successfully');
            });
        }
    },
    "/get-user-id": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { token } = JSON.parse(body);
                const userId = getUserIdByToken(token);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ userId }));
            });
        }
    },
    "/subscribe-to-topic": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { userId, topic } = JSON.parse(body);
                const tokens = getUserTokens(userId);

                admin.messaging().subscribeToTopic(tokens, topic)
                    .then((response) => {
                        subscribeUserToTopic(userId, topic);
                        console.log('Successfully subscribed to topic:', response);
                        response.writeHead(200, { 'Content-Type': 'text/plain' });
                        response.end('Successfully subscribed to topic');
                    })
                    .catch((error) => {
                        console.log('Error subscribing to topic:', error);
                        response.writeHead(500, { 'Content-Type': 'text/plain' });
                        response.end('Error subscribing to topic');
                    });
            });
        }
    },
    "/unsubscribe-from-topic": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { userId, topic } = JSON.parse(body);
                const tokens = getUserTokens(userId);

                admin.messaging().unsubscribeFromTopic(tokens, topic)
                    .then((response) => {
                        unsubscribeUserFromTopic(userId, topic);
                        console.log('Successfully unsubscribed from topic:', response);
                        response.writeHead(200, { 'Content-Type': 'text/plain' });
                        response.end('Successfully unsubscribed from topic');
                    })
                    .catch((error) => {
                        console.log('Error unsubscribing from topic:', error);
                        response.writeHead(500, { 'Content-Type': 'text/plain' });
                        response.end('Error unsubscribing from topic');
                    });
            });
        }
    },
    "/send-notification": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { title, body, recipientUserId } = JSON.parse(body);
                const tokens = getUserTokens(recipientUserId);

                const message = {
                    notification: { title, body },
                    tokens
                };

                admin.messaging().sendMulticast(message)
                    .then((response) => {
                        console.log('Successfully sent message:', response);
                        response.writeHead(200, { 'Content-Type': 'text/plain' });
                        response.end('Notification sent successfully');
                    })
                    .catch((error) => {
                        console.log('Error sending message:', error);
                        response.writeHead(500, { 'Content-Type': 'text/plain' });
                        response.end('Error sending notification');
                    });
            });
        }
    },
    "/schedule-notification": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { userId, topic, title, body, time } = JSON.parse(body);
                const notificationId = scheduleNotification(userId, topic, title, body, new Date(time).toISOString());

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(`Notification scheduled successfully with ID: ${notificationId}`);
            });
        }
    },
    "/schedule-and-subscribe": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { userId, topic, title, body, time } = JSON.parse(body);
                if (!topicSubscriptions[topic]) {
                    const notificationId = scheduleNotification(userId, topic, title, body, new Date(time).toISOString());
                    response.writeHead(200, { 'Content-Type': 'text/plain' });
                    response.end(`Notification scheduled successfully with ID: ${notificationId}`);
                } else {
                    subscribeUserToTopic(userId, topic);
                    response.writeHead(200, { 'Content-Type': 'text/plain' });
                    response.end('Successfully subscribed to existing topic');
                }
            });
        }
    },
    "/delete-scheduled-notification": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { notificationId } = JSON.parse(body);
                deleteScheduledNotification(notificationId);

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end('Scheduled notification deleted successfully');
            });
        }
    },
    "/get-scheduled-notifications": {
        POST: (request, response, cfg) => {
            let body = '';
            request.on('data', chunk => {
                body += chunk.toString();
            });
            request.on('end', () => {
                const { userId, topic } = JSON.parse(body);
                const notifications = getScheduledNotifications({ userId, topic });
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ notifications }));
            });
        }
    }
};

// Function to handle incoming requests
function onRequest(request, response, cfg) {
    let requestURL = '.' + request.url;

    if (requestURL === './') {
        requestURL += cfg.startpage;
    }

    // Generalized route handling
    const route = routes[request.url];
    if (route) {
        const methodHandler = route[request.method];
        if (methodHandler) {
            methodHandler(request, response, cfg);
            return;
        } else {
            response.writeHead(405, { 'Content-Type': 'text/html' });
            response.end('Method Not Allowed');
            return;
        }
    }

    let headers = {}; // 200 response

    if (cfg.headers) {
        Object.assign(headers, cfg.headers);
    }

    // Read the file on the server
    if (fs.existsSync(requestURL)) {
        fs.readFile(requestURL, (error, content) => {
            if (error) {
                response.writeHead(500);
                response.end('Internal Server Error');
            } else {
                const extname = String(path.extname(requestURL)).toLowerCase();
                const contentType = mimeTypes[extname] || 'application/octet-stream';
                Object.assign(headers, { 'Content-Type': contentType });
                response.writeHead(200, headers);
                response.end(content, 'utf-8');
            }
        });
    } else {
        response.writeHead(404, { 'Content-Type': 'text/html' });
        response.end('404 Not Found', 'utf-8');
    }
}

// Function to create and start the server
function createServer(cfg) {
    if (cfg.protocol === 'http') {
        return http.createServer((request, response) => onRequest(request, response, cfg));
    } else if (cfg.protocol === 'https') {
        const options = {
            key: fs.readFileSync(cfg.keypath),
            cert: fs.readFileSync(cfg.certpath)
        };
        return https.createServer(options, (request, response) => onRequest(request, response, cfg));
    }
    throw new Error('Invalid protocol specified');
}

// Start the server
function startServer(cfg = defaultServer) {
    cfg.port = getEnvVar('PORT', cfg.port);

    let server = createServer(cfg);
    server.listen(cfg.port, cfg.host, () => {
        console.log(`Server running at ${cfg.protocol}://${cfg.host}:${cfg.port}/`);
    });

    return server;
}

// Load configuration and start server
SERVERCONFIG = startServer();
