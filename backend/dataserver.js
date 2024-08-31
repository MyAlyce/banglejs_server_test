import http from 'http';
import https from 'https';
import fs from 'fs';
import mongoose from 'mongoose';
import { dataServerConfig, defaultServer } from './serverconfig.js';

import dotenv from 'dotenv';
dotenv.config();

import {
    Router,
    WSSbackend, //this will handle our RTC relay and other communications
    StructBackend
    // ConnectionInfo, 
    // SocketServerProps
} from 'graphscript-node'//'../../graphscript-node/dist/index.node.js'//

let SERVERCONFIG = {};

// Utility to read environment variables
function getEnvVar(name, defaultValue) {
    return process.env[name] || defaultValue;
}


let accessTokens = {};



const getConfig = () => {
    return {
        clientId: getEnvVar('GOOGLE_CLIENT_ID', ''),
        apiKey: getEnvVar('GOOGLE_API_KEY', ''),
        mapsKey: getEnvVar('GOOGLE_MAPS_KEY', '')
    };
}


//wont truncate
let log = (data) => {
    process.stdout.write(JSON.stringify(data) + '\n');
}

// Define a hash table for routes
const routes = {
    "/config": {
        GET: {
            handler: (request, response, cfg) => {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(getConfig()));
            }
        }
    },
   
};


if(process.env.MONGODB_URI)
mongoose.connect(process.env.MONGODB_URI).then(async (result) => {

    console.log("MongoDB connected!", process.env.MONGODB_URI);


    const onRequest = (req, res, cfg) => {
        let headers = {}; // 200 response

        if (cfg.headers) {
            Object.assign(headers, cfg.headers);
        }

        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(204, headers);
            res.end();
            return;
        }

        // Generalized route handling
        const route = routes[req.url];
        if (route) {
            const method = route[req.method];
            if (method) {
                if (method.headers) {
                    Object.assign(headers, method.headers);
                }
                method.handler(req, res, { ...cfg, headers });
            } else {
                res.writeHead(405, headers);
                res.end('Method Not Allowed');
            }
        } else {
            res.writeHead(404, headers);
            res.end('Not Found');
        }
    };

    // Function to create and start the server
    function createServer(cfg, contentCfg) {
        if (contentCfg.protocol === 'http') {
            return http.createServer((request, response) => onRequest(request, response, cfg));
        } else if (contentCfg.protocol === 'https') {
            const options = {
                key: fs.readFileSync(contentCfg.keypath),
                cert: fs.readFileSync(contentCfg.certpath)
            };
            return https.createServer(options, (request, response) => onRequest(request, response, cfg));
        }
        throw new Error('Invalid protocol specified');
    }

    async function createDataServer(server, cfg, contentcfg) {
        const DataServer = new Router({
            graph:{
                'wss':WSSbackend,
                'db':new StructBackend({}, { //the user reference on the router should get attached by the router 
                    mode:'mongo', //'local'
                    db: mongoose.connections[0].db, //set database
                    useAuths:true, //bypass our permissions system for users to be able to view each other
                    useAccessTokens:true,
                    debug:true
                    //useRefreshTokens:true
                })
            },
            roots:{
                //match the html fetch
                '/config':getConfig,
                userIsOnline:function(userId, requestingUser, token) {
                    
                    if (!accessTokens[requestingUser] || accessTokens[requestingUser] !== token) {
                        return false;
                    }

                    return DataServer.users[userId] !== undefined; //check who is online
                
                },
                usersAreOnline:function(userIds=[], requestingUser, token) {

                    if (!accessTokens[requestingUser] || accessTokens[requestingUser] !== token) {
                        return false;
                    }
                    
                    return userIds.map((userId) => {
                        return DataServer.users[userId] !== undefined; //check who is online
                    });
                },
                getAllOnlineUsers:function(userIds, requestingUser, token) { //dev

                    if (!accessTokens[requestingUser] || accessTokens[requestingUser] !== token) {
                        return false;
                    }
                    
                    if(userIds) {
                        let res = [];
                        for(const key of userIds) {
                            if(DataServer.users[key]) res.push(key);
                        }
                        return res;
                    }
                    return Object.keys(DataServer.users);
                }
            }
        });


        
        await DataServer.run('wipeDB'); //for testing: kill database

        //TODO: Add restricT {} function to WSS graph to prevent users accessing backend entirely
        //      Create second socket port that requires admin credentials that does work unfiltered. We need a process for managing this
        //creates the websocket server //once hosting we probably need to re-adopt the http proxy
        DataServer.openConnection('wss',{
            server,
            protocol: cfg.socket_protocol,
            host: cfg.domain || cfg.host,
            port: cfg.socketport,
            //debug:true,
            onconnection:(ws,req,serverinfo,id)=>{
                //ws
                ws.send('{ "route":"log", "args":"Websocket connected"}');
            
            },
            onconnectionclosed:(code,reason,ws,serverInfo) => {
                // setTimeout(() => {
                //     console.log(Object.keys(serverInfo.graph.__node.state.data),Object.keys(serverInfo.graph.__node.state.triggers));
                // },100);
                //the router will take care of cleaning up references 
            }
        });


        return DataServer;
    }

    // Start the server
    function startServer(cfg = dataServerConfig, contentCfg = defaultServer) {
        cfg.port = getEnvVar('PORT', cfg.port);

        let server = createServer(cfg, contentCfg);
        server.listen(cfg.port, contentCfg.domain || contentCfg.host, async () => {
            console.log(`Server running at ${contentCfg.protocol}://${contentCfg.host}:${cfg.port}/`);

            await createDataServer(server, cfg, contentCfg);
            
        });

        return server;
    }

    // Load configuration and start server
    SERVERCONFIG = startServer();

}).catch((err) => {
    console.error(err);
});
