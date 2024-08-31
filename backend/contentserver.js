import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { defaultServer, mimeTypes } from './serverconfig.js';

import dotenv from 'dotenv';
dotenv.config();

let SERVERCONFIG = {};

// Utility to read environment variables
function getEnvVar(name, defaultValue) {
    return process.env[name] || defaultValue;
}

// Define a hash table for routes
const routes = {
    "/config": {
        GET: (request, response, cfg) => {
            const config = {
                clientId: getEnvVar('GOOGLE_CLIENT_ID', ''),
                apiKey: getEnvVar('GOOGLE_API_KEY', ''),
                mapsKey: getEnvVar('GOOGLE_MAPS_KEY', '')
            };
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(config));
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
