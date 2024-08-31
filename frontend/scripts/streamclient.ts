import { Router } from 'graphscript-router'

import { defaultServer, dataServerConfig as config } from '../../backend/serverconfig'

import { 
    WSSfrontend, 
    WebRTCfrontend, 
    WebRTCProps, 
    WebRTCInfo, 
    WebSocketProps, 
    WebSocketInfo
} from "graphscript-frontend";

import { stateHandler } from "./state";
import { getCurrentLocation } from './gps';
import { ZenFsRoutes } from './data_util/zenfsUtils';
// import { initDriveConfig } from './fetch';
import { StructFrontend } from 'graphscript-database'//'../../../graphscript-database/index'//'graphscript-database';

export const WSclient = new WSSfrontend({state:stateHandler});
export const WebRTCclient = new WebRTCfrontend({state:stateHandler}); //set custom iceServers in second argument
export const DataBase = new StructFrontend({
    state:stateHandler, 
    useAccessTokens:true //gotten from google in our case, else you could generate it yourself
    //useRefreshTokens:true //this would be a token that times out every x minutes, todo add timeout on backend to clear tokens held in-memory
});

export type Sensors = 'emg'|'ppg'|'breath'|'hr'|'compass'|'accel'|'env'|'ecg'|'emg2';
export type Stream = 'emg'|'ppg'|'breath'|'hr'|'compass'|'accel'|'env'|'ecg'|'emg2'|'event'|'alert'|'message'|'audiovideo';

export type Streams = ('emg'|'ppg'|'breath'|'hr'|'compass'|'accel'|'env'|'ecg'|'emg2'|'event'|'alert'|'message'|'audiovideo')[];

export const SensorDefaults = ['ppg','hr','breath','accel','compass','env'] as Sensors[];
export const StreamDefaults = ['ppg','hr','breath','accel','compass','env','event','alert','message','audiovideo'] as any as Streams[];

export const alerts = [] as {message:string,value:any, from:string, timestamp:number|string}[]; //session alerts
export const events = [] as {message:string, from:string, timestamp:number|string}[]; //session events


export let defaultProfilePic = './assets/person.jpg';
//TODO:
// this could all be consolidated more intuitively

export const webrtcData = {
    webrtcStream:undefined, //current active stream
    availableStreams:WebRTCclient.rtc as {[key:string]:any}, //list of accepted calls
    unansweredCalls:WebRTCclient.unanswered as {[key:string]:WebRTCProps & {caller:string, firstName?:string, lastName?: string}}
}

export const client = new Router({
    state:stateHandler,
    services:{
        sockets: WSclient,
        webrtc: WebRTCclient,
        db:DataBase
    },
    roots:{
        cleanupCallInfo:(callId)=>{ //for webrtc
            delete WebRTCclient.unanswered[callId];
            delete newCalls[callId];
            stateHandler.setState({
                unansweredCalls:WebRTCclient.unanswered
            }); //update this event for the app
        },
        getCurrentLocation:getCurrentLocation
    }
});



export let newCalls = {} as any;

WebRTCclient.subscribe('receiveCallInformation', (id) => {
   
    //console.log('received call information:', id);

    //console.log(graph.__node.state, state, graph.__node.stateHandler.data.receiveCallInformation, stateHandler.data.receiveCallInformation);
        
    let call = WebRTCclient.unanswered[id] as WebRTCProps & {caller:string, firstName:string, lastName:string, socketId:string};

    if(call) {
    
        if(!newCalls[id]) {
            newCalls[id] = true;
            stateHandler.setState({
                triggerPageRerender:true,
                unansweredCalls:WebRTCclient.unanswered
            }); //update this event for the app
        } else {
            stateHandler.setState({
                unansweredCalls:WebRTCclient.unanswered
            }); //update this event for the app
        }

    }
});

export let DataServer:{socket:WebSocketInfo} = {
    socket:undefined as any
};

export let makeSocket = async () => {

    return new Promise((res,rej) => {
        DataServer.socket = WSclient.open({
            protocol:'ws' as any,
            host:defaultServer.host,//config.socket_protocol === 'wss' ? config.domain : config.host,
            port:config.socketport, //for whatever reason we don't define this on 
            path:'wss',
            onopen:() => {
                console.log('port opened!');
            },
            onerror:() => {
                rej(false);
            },
            debug:true
        }); 

        const ws = DataServer.socket.socket;

        //for when the server pairs the user's id with the socket connection
        const evl = (ev) => {
            if(ev.data.includes('setId')) {
                ws.removeEventListener('message', evl);
                res(true); //resolve when the connection is ready to associate with the user
            }
        };
        
        ws.addEventListener('message',evl);

        ws.addEventListener('message', (ev) => {
            if(ev.data.includes('{') && !ev.data.substring(0,20).includes("route")) {
                const input = JSON.parse(ev.data);
                DataBase.baseServerCallback(input);
            }
        })
    });
}


type RTCAppProps = {
    caller:string, 
    firstName:string, 
    lastName:string,
    pictureUrl:string, 
    socketId:string,  //hosted endpoint from server (as opposed to the RTC p2p route)

    unreadMessages:number,
    messages:{message:string, from:string, timestamp:number, streamId?:string}[],
    newEvents:boolean,
    events:{message:string, from:string, timestamp:number, streamId?:string}[], 
    newAlerts:boolean,
    alerts:{message:string, from:string, value:any, timestamp:number, streamId?:string}[], 
    
    //set by rtc peer
    hasVideo?:boolean,
    hasAudio?:boolean,

    //for ui controls
    viewingVideo?:boolean,
    viewingAudio?:boolean,

    recordingVideo?:boolean,
    recordingAudio?:boolean,

    videoSender?:boolean, 
    audioSender?:boolean,

    //for audio controls
    srcNode?:any,
    filterNode?:any
    gainNode?:any
}

//the way these types are redundantly written just helps with the hints in VSCode fyi, no need to go digging
export type RTCCallProps = WebRTCProps & RTCAppProps;
export type RTCCallInfo = WebRTCInfo & RTCAppProps;

export function getCallLocation(call:RTCCallInfo):Promise<{ 
    accuracy:number, 
    latitude:number, 
    longitude:number, 
    altitudeAccuracy:any, 
    altitude:any, 
    speed:any, 
    heading:any, 
    timestamp:number
}|undefined> {
    return call.run('getCurrentLocation'); //run geolocation at endpoint
}



export function sendMessage(call:RTCCallInfo, message:any) {
            
    if(!call.messages) call.messages = [] as any;
    
    let result = {message:message, timestamp:Date.now(), from:client.currentUser.firstName + client.currentUser.lastName};

    call.messages.push(result);
    call.send({message:result});

    return result;
}



let tStart = performance.now();

//required for data streaming
export function BufferAndSend(
    data:any, 
    bufKey:string, 
    stream:WebRTCInfo, 
    buffers:{[key:string]:any[]}={}, 
    bufferInterval=333
) {
    let now = performance.now();

    if(!buffers[bufKey]) buffers[bufKey] = {} as any;
    for(const key in data) {
        if(!(key in buffers[bufKey])) {
            if(Array.isArray(data[key]))
                buffers[bufKey][key] = [...data[key]];
            else buffers[bufKey][key] = [data[key]];
        }
        else {
            if(Array.isArray((data[key])))
                buffers[bufKey][key].push(...data[key]);
            else
                buffers[bufKey][key].push(data[key]);
        }
    }

    if(now > tStart + bufferInterval) {
        if((stream.channels?.['data'] as RTCDataChannel).readyState === 'open')
            stream.send({...buffers});

        //console.log({...buffers});
        tStart = now;
        for (const key in buffers) delete buffers[key];
    }

    return buffers;
}

export let streamSubscriptions = {};

export function enableDeviceStream(streamId, bufferInterval=333) { //enable sending data to a given RTC channel
    
    let stream = WebRTCclient.rtc[streamId as string] as WebRTCInfo;

    let buffers = {
        emg:undefined,
        ecg:undefined,
        ppg:undefined,
        hr:undefined,
        breath:undefined,
        accel:undefined,
        env:undefined //etc
    } as any;

    if(stream) {

        //the bufferandsend will make sure buffers are staggered out as we cannot stream like 1000 packets per second it needs to be bundled to make the most of the bandwidth
        streamSubscriptions[streamId] = {
            emg:stateHandler.subscribeEvent('emg', (emg) => {
                buffers = BufferAndSend(emg,'emg',stream,buffers,bufferInterval);
            }),
            ecg:stateHandler.subscribeEvent('ecg', (ecg) => {
                buffers = BufferAndSend(ecg,'ecg',stream,buffers,bufferInterval);
            }),
            ppg:stateHandler.subscribeEvent('ppg', (ppg) => {
                buffers = BufferAndSend(ppg,'ppg',stream,buffers,bufferInterval);
            }),
            hr:stateHandler.subscribeEvent('hr', (hr) => {
                buffers = BufferAndSend(hr,'hr',stream,buffers,bufferInterval);
            }),
            breath:stateHandler.subscribeEvent('breath', (breath) => {
                buffers = BufferAndSend(breath,'breath',stream,buffers,bufferInterval);
            }),
            accel:stateHandler.subscribeEvent('accel', (accel) => {
                buffers = BufferAndSend(accel,'accel',stream,buffers,bufferInterval);
            }),
            compass:stateHandler.subscribeEvent('compass', (compass) => {
                buffers = BufferAndSend(compass,'compass',stream,buffers,bufferInterval);
            }),
            env:stateHandler.subscribeEvent('env', (env) => {
                buffers = BufferAndSend(env,'env',stream,buffers,bufferInterval);
            })
        };

        let oldonclose;
        if(stream.onclose) oldonclose = stream.onclose; 
        stream.onclose = () => {
            if(streamSubscriptions[streamId]) for(const key in streamSubscriptions[streamId]) {
                stateHandler.unsubscribeEvent(key, streamSubscriptions[streamId]?.[key]);
            }
            delete streamSubscriptions[streamId];
            if(oldonclose) oldonclose();
        }    
        
        return streamSubscriptions[streamId];
    }
    
}

export function disableDeviceStream(streamId) {

    if(streamSubscriptions[streamId]) for(const key in streamSubscriptions[streamId]) {
        stateHandler.unsubscribeEvent(key, streamSubscriptions[streamId]?.[key]);
    }
    delete streamSubscriptions[streamId];

}


export const onrtcdata = (call:RTCCallInfo, from:string, data:any) => { 

    //console.log( 'received',data);

    //some data structures for the app
    if(data.alert) {

        //onAlert(data.alert, call._id);

        //state.setValue(call._id+'alert',data.alert);
    }
    if(data.event) {

        if(!(call as RTCCallInfo).events) (call as RTCCallInfo).events = [] as any;
        data.event.streamId = call._id; //for marking that its a remote message (for styling mainly)
        call.newEvents = true;
        (call as RTCCallInfo).events.push(data.event);
        
        //recordEvent(from, data.event, call._id);

        //state.setValue(call._id+'event', data.event);
    }
    if(data.message) {

        if(!(call as RTCCallInfo).messages) (call as RTCCallInfo).messages = [] as any;
        data.message.from = from;
        data.message.streamId = call._id; //for marking that its a remote message (for styling mainly)
        (call as RTCCallInfo).messages.push(data.message);
        
        if(stateHandler.data.isRecording) {
            //recordChat(from, data.message, call._id);
        }

        if(!call.unreadMessages) call.unreadMessages = 0;
        call.unreadMessages++;

        stateHandler.setValue(call._id+'message',data.message);
    }

    //sensor data
    if(data.emg) {
        if(!stateHandler.data[call._id+'detectedEMG']) stateHandler.setState({[call._id+'detectedEMG']:true});
        stateHandler.setValue(call._id+'emg', data.emg);
    } 
    if(data.ecg) {
        if(!stateHandler.data[call._id+'detectedEMG']) stateHandler.setState({[call._id+'detectedEMG']:true});
        stateHandler.setValue(call._id+'ecg', data.ecg);
    } 
    if (data.ppg) {
        if(!stateHandler.data[call._id+'detectedPPG']) stateHandler.setState({[call._id+'detectedPPG']:true});
        stateHandler.setValue(call._id+'ppg', data.ppg);
    } 
    if (data.hr) {
        if(!stateHandler.data[call._id+'detectedPPG']) stateHandler.setState({[call._id+'detectedPPG']:true});
        stateHandler.setValue(call._id+'hr', data.hr);
    }  
    if (data.breath) {
        if(!stateHandler.data[call._id+'detectedPPG']) stateHandler.setState({[call._id+'detectedPPG']:true});
        stateHandler.setValue(call._id+'breath', data.breath);
    } 
    if (data.imu) {
        if(!stateHandler.data[call._id+'detectedIMU']) stateHandler.setState({[call._id+'detectedIMU']:true});
        stateHandler.setValue(call._id+'imu', data.imu);
    } 
    if (data.env) {
        if(!stateHandler.data[call._id+'detectedENV']) stateHandler.setState({[call._id+'detectedENV']:true});
        stateHandler.setValue(call._id+'env', data.env);
    } //else if (ev.data.emg2) {}
    if (data.media) {
        if('hasVideo' in data.media) {
            call.hasVideo = data.media.hasVideo;
            call.viewingVideo = data.media.hasVideo;
            stateHandler.setState({[call._id+'hasVideo']:data.media.hasVideo, triggerPageRerender:true}); //use ontrack event to set to true
        }
        if('hasAudio' in data.media) {
            call.hasAudio = data.media.hasAudio;
            call.viewingVideo = data.media.hasAudio;
            stateHandler.setState({[call._id+'hasAudio']:data.media.hasAudio, triggerPageRerender:true}); //use ontrack event to set to true
        }
    }
}


export function genCallSettings(userId, rtcId, alertNodes?) {

    return {
        onicecandidate:async (ev) => {
            if(ev.candidate) { //we need to pass our candidates to the other endpoint, then they need to accept the call and return their ice candidates
                let cid = `candidate${Math.floor(Math.random()*1000000000000000)}`;
                DataServer.socket.run(
                    'runConnection', //run this function on the backend router
                    [
                        userId, //run this connection 
                        'runAll',  //use this function (e.g. run, post, subscribe, etc. see User type)
                        [ //and pass these arguments
                            'receiveCallInformation', //run this function on the user's end
                            {
                                _id:rtcId, 
                                candidates:{[cid]:ev.candidate}
                            }
                        ]
                    ]
                ).then((id) => {
                    //console.log('call information echoed from peer:', id);
                });
            }
        },
        ondatachannel: (ev) => {
            console.log('Call started with', (WebRTCclient.rtc[rtcId] as RTCCallInfo).firstName, (WebRTCclient.rtc[rtcId] as RTCCallInfo).lastName);

            //we can run callbacks directly on the other user's graph. Todo: add restrictions
            WebRTCclient.rtc[rtcId as string].run('ping').then((res) => {
                console.log('ping result should be pong. Result:', res);//test to validate connection, should ping the other's console.
            });

            //if(!alertNodes) alertNodes = setupAlerts(rtcId); //just leave alerts on client end rn, add a toggle in the app instead

            //the webrtc.rtc[rtcId] is now live, add tracks
            //data channel streams the device data
            enableDeviceStream(rtcId); //enable my device to stream data to this endpoint

            stateHandler.setState({ activeStream:rtcId, deviceMode:rtcId, triggerPageRerender:true }); //switch over to new call
        },
        ondata: (mev, channel) => {
            let data = JSON.parse(mev.data);
            //onrtcdata(webrtc.rtc[rtcId] as RTCCallInfo, (webrtc.rtc[rtcId] as RTCCallInfo).firstName+(webrtc.rtc[rtcId] as RTCCallInfo).lastName, data);

            //stock functions for the webrtc service, e.g. you can webrtc.rtc[rtcId] anything on each other's endpoints
            WebRTCclient.receive(mev.data, channel, WebRTCclient.rtc[rtcId]);
            WebRTCclient.setState({[rtcId]:mev.data});
        },
        onnegotiationneeded: async (ev, description) => {//both ends need to set this function up when adding audio and video tracks freshly
    
            //console.log('negotiating');

            DataServer.socket.run(
                'runConnection', //run this function on the backend router
                [
                    (WebRTCclient.rtc[rtcId] as RTCCallInfo).caller, //run this connection 
                    'run',  //use this function (e.g. run, post, subscribe, etc. see User type)
                    [ //and pass these arguments
                        'negotiateCall', //run this function on the user's end
                        [rtcId, encodeURIComponent(JSON.stringify(description))]
                    ],
                    (WebRTCclient.rtc[rtcId] as RTCCallInfo).socketId
                ]
            ).then((description) => {
                //if(description) console.log('remote description returned');
                //else console.log('caller renegotiated');
                
                if(description) WebRTCclient.negotiateCall(rtcId as string, description);
            });
        },
        ontrack:(ev) => {
            //console.log('\n\n\nreceived track\n\n\n', ev);

            setTimeout(() => {
                if(ev.track.kind === 'audio') {
                    (WebRTCclient.rtc[rtcId] as RTCCallInfo).hasAudio = true;
                    (WebRTCclient.rtc[rtcId] as RTCCallInfo).viewingAudio = true;
                    stateHandler.setState({ [rtcId+'hasAudio']:true, triggerPageRerender:true });
                }
                if(ev.track.kind === 'video') {
                    (WebRTCclient.rtc[rtcId] as RTCCallInfo).hasVideo = true;
                    (WebRTCclient.rtc[rtcId] as RTCCallInfo).viewingVideo = true;
                    stateHandler.setState({ [rtcId+'hasVideo']:true, triggerPageRerender:true });
                }

            }, 500);
        },
        onclose:() => {
            if(alertNodes)
                for(const key in alertNodes) {
                    client.remove(key,true);
                }
            delete WebRTCclient.rtc[(WebRTCclient.rtc[rtcId] as RTCCallInfo)._id];
            stateHandler.setState({activeStream:undefined, availableStreams:WebRTCclient.rtc, triggerPageRerender:true});
        }
    } as Partial<WebRTCProps>
}

//started from host end, see answerCall for peer end
export async function startCall(userId) {
    //send handshake
    let rtcId = `room${Math.floor(Math.random()*1000000000000000)}`;

    let call = await WebRTCclient.openRTC({ 
        _id:rtcId,
        ...genCallSettings(userId,rtcId)
    });

    DataServer.socket.post(
        'runConnection', //run this function on the backend router
        [
            userId, //run this connection 
            'postAll',  //use this function (e.g. run, post, subscribe, etc. see User type)
            [ //and pass these arguments
                'receiveCallInformation', //run this function on the user's end
                {
                    _id:rtcId, 
                    description:encodeURIComponent(JSON.stringify(call.rtc.localDescription)), //the peer needs to accept this
                    caller:client.currentUser._id,
                    socketId:DataServer.socket._id,
                    firstName:client.currentUser.firstName,
                    lastName:client.currentUser.lastName,
                    pictureUrl:client.currentUser.pictureUrl
                }
            ]
        ]
    );

    return call;
}

export let answerCall = async (call:RTCCallProps) => {
    if(!call) return;
    
    //let nodes = setupAlerts(call._id, ['hr','breath','fall']);

    Object.assign(call,{
        ...genCallSettings(call.caller, call._id)//, nodes)
    });

    let rtc = await WebRTCclient.answerCall(call as any);

    DataServer.socket.run(
        'runConnection', //run this function on the backend router
        [
            client.currentUser._id, //run this connection 
            'postAll',  //use this function (e.g. run, post, subscribe, etc. see User type)
            [ //and pass these arguments
                'cleanupCallInfo', //run this function on the user's end
                call._id
            ]
        ]
    )
    
    DataServer.socket.run(
        'runConnection', //run this function on the backend router
        [
            call.caller, //run this connection 
            'run',  //use this function (e.g. run, post, subscribe, etc. see User type)
            [ //and pass these arguments
                'answerPeer', //run this function on the user's end
                [
                    rtc._id,
                    {
                        description:encodeURIComponent(JSON.stringify(rtc.rtc.localDescription)), //the host needs this
                        caller:client.currentUser._id,
                        socketId:DataServer.socket._id,
                        firstName:client.currentUser.firstName,
                        lastName:client.currentUser.lastName,
                        pictureUrl:client.currentUser.pictureUrl
                    }
                ]
            ],
            call.socketId
        ]
    );

    delete newCalls[call._id as string];

    stateHandler.setState({
        //activeStream:call._id,
        availableStreams:WebRTCclient.rtc,
        //deviceMode:call._id,
    });
}

export function rejectCall(callId:string){
    delete newCalls[callId as string];
}

export function subscribeToStream(
    stream:Stream, 
    onchange:(result:any)=>void, 
    streamId?:string
) {
    return stateHandler.subscribeEvent(
        streamId ? streamId+stream : stream, 
        onchange
    );
}

export function unsubscribeFromStream(
    stream:Stream,
    sub:number|undefined, 
    streamId?:string
) {
    return stateHandler.unsubscribeEvent(
        streamId ? streamId+stream : stream, 
        sub
    );
}

export function getActiveStreamDir() {
    let dir = stateHandler.data.activeStream ? 
        (WebRTCclient.rtc[stateHandler.data.activeStream] as RTCCallInfo).firstName + (WebRTCclient.rtc[stateHandler.data.activeStream] as RTCCallInfo).lastName 
            : 
            stateHandler.data.selectedFolder ? stateHandler.data.selectedFolder 
            : 
        client.currentUser.firstName + client.currentUser.lastName
    return dir;
}

export function getActiveStream() {
    return stateHandler.data.activeStream ? WebRTCclient.rtc[stateHandler.data.activeStream] as RTCCallInfo : undefined;
}

export function getStreamById(streamId:string) {
    return WebRTCclient.rtc[streamId];
}

export function splitCamelCase(string:string) {
    return string?.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function setCamelCase(string:string) {
    return string?.replace(/([a-z])([A-Z])/g, '$1$2');
}

//call streams from endpoint
export function getCallerAudioVideo(streamId:string) {
    let stream = getStreamById(streamId) as RTCCallInfo;


    let hasAudio; let hasVideo;
    let audioStream; let videoStream;

    videoStream = stream.streams?.find((s) => (s as MediaStream)?.getVideoTracks().length > 0);
    audioStream = stream.streams?.find((s) => (s as MediaStream)?.getAudioTracks().length > 0);
    
    hasVideo = videoStream !== undefined;
    hasAudio = audioStream !== undefined;

    return {
        hasAudio, hasVideo,
        audioStream, videoStream
    };

}



//subscribe to the state so any and all changes are saved, can store multiple states (e.g. particular for pages or components)
export function backupState(
    filename='stateHandler.json', 
    backup=[ //STATE KEYS TO MAINTAIN IN INDEXEDDB
        'route',
        'selectedVideo',
        'selectedAudioIn',
        'selectedAudioOut',
        'demoing', //use a fake data stream?
        'alertsEnabled',
        'selectedFolder'
    ], //back these values up from the state object
    dir='data'
){
    //read initial data, now setup subscription to save the state every time it updates

    let lastState = {};
    let hasUpdate = false;

    backup.forEach((v) => {
        lastState[v] = stateHandler.data[v];
        stateHandler.subscribeEvent(v, (newValue) => {
            lastState[v] = newValue;
            hasUpdate = true;    
        });
    });

    function backupLoop() {

        if(hasUpdate) {
            ZenFsRoutes.writeFile(
                dir+'/'+filename,
                JSON.stringify(lastState),
            );
            hasUpdate = false;
        }
           
        setTimeout(()=> {backupLoop()}, 500 );
    }

    backupLoop();
}

setTimeout(() => {
    backupState();
}, 100);

//should subscribe to the state then restore session to setup the app
export async function restoreSession(
    u:any,
    filename='stateHandler.json', //state file
    dir='data'
) {
    //make sure the indexeddb directory is initialized

    let exists = await ZenFsRoutes.exists(dir+'/'+filename);

    let read;
    if(exists) {
        read = await ZenFsRoutes.readFileAsText(
            dir+'/'+filename
        )
        try {
            if(read) {
                let restored = JSON.parse(read);
                if(typeof restored === 'object') {
                    if(restored.loggedInId && restored.loggedInId === u?._id || !restored.loggedInId) 
                        stateHandler.setState(restored);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
      
    backupState(filename, undefined, dir);

    return read;

}



//my local call streams
export async function callHasMyStreamMedia(streamId:string) {
    
    let stream = getStreamById(streamId) as RTCCallInfo;
    let hasAudio; let hasVideo;
    let videoEnabledInAudio;
    
    if(stream?.senders) {
        for(const s of stream.senders) {
            let videoEnabledInAudio = false;
            if(s?.track?.kind === 'audio') {
                hasAudio = true;
                if((s as any).deviceId && stateHandler.data.selectedAudioIn && (s as any).deviceId !== stateHandler.data.selectedAudioIn) {
                    disableAudio(stream);
                    if(hasVideo && stateHandler.data.selectedAudioIn === stateHandler.data.selectedVideo) {
                        disableVideo(stream);
                        await enableVideo(stream, stateHandler.data.selectedVideo ? {deviceId:stateHandler.data.selectedVideo} : undefined, true);
                        videoEnabledInAudio = true;
                    }
                    else enableAudio(stream, stateHandler.data.selectedAudioIn ? {deviceId:stateHandler.data.selectedAudioIn} : undefined);
                }
            }
            if(s?.track?.kind === 'video') {
                hasVideo = true;
                if((s as any).deviceId && stateHandler.data.selectedVideo && (s as any).deviceId !== stateHandler.data.selectedVideo && !videoEnabledInAudio) {
                    disableVideo(stream);
                    await enableVideo(stream, stateHandler.data.selectedVideo ? {deviceId:stateHandler.data.selectedVideo} : undefined); //todo: deal with case of using e.g. a webcam for both audio and video
                }
            }
        }
    }

    return {
        hasAudio, hasVideo, videoEnabledInAudio
    };
}



export async function enableAudio(call:RTCCallInfo, audioOptions:boolean|MediaTrackConstraints & {deviceId:string}=true) {
    let stream = await WebRTCclient.enableAudio(call as any, audioOptions) as MediaStream;

    //call.send({media:{hasAudio:true}});
    return stream;
}

export async function enableVideo(
    call:RTCCallInfo, 
    videoOptions:(MediaTrackConstraints & {deviceId?:string, optional?:{minWidth: number}[] })  = {
        //deviceId: 'abc' //or below default setting:
        optional:[
            {minWidth: 320},
            {minWidth: 640},
            {minWidth: 1024},
            {minWidth: 1280},
            {minWidth: 1920},
            {minWidth: 2560},
            {minWidth: 3840},
        ]
    } as MediaTrackConstraints  & { deviceId?:string, optional?:{minWidth: number}[] },
    includeAudio:boolean|(MediaTrackConstraints & {deviceId?:string})=false
) { //the maximum available resolution will be selected if not specified
    let stream = await WebRTCclient.enableVideo(call as any,videoOptions,includeAudio) as MediaStream;

    //let t = {hasVideo:true} as any;
    //if(includeAudio) t.hasAudio = true;
    //call.send({media:t});
    return stream;
}

export function disableAudio(call:RTCCallInfo) {
    WebRTCclient.disableAudio(call as any);
    call.send({media:{hasAudio:false}}); //ontrack events will handle the true case
}

export function disableVideo(call:RTCCallInfo) {
    WebRTCclient.disableVideo(call as any);
    call.send({media:{hasVideo:false}}); //ontrack events will handle the true case
}

