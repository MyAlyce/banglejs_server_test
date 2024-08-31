import { workers } from "device-decoder";
import { stateHandler } from './state'
import { Sensors, client } from "./streamclient";
import { WebRTCclient } from './streamclient'

import gsworker from './csv.worker'

import { RTCCallInfo } from "./streamclient";
import { WorkerInfo } from "graphscript-workers";
import { parseCSVData, toISOLocal } from "../scripts/data_util/csv";

stateHandler.setState({
    isRecording:false,
    recordingPPG:false,
    recordingEMG:false,
    recordingAccel:false,
    recordingEnv:false
});

let recordingSubs = {} as any;

let fileNames = {} as any;

export const csvworkers = {} as {[key:string]:WorkerInfo};

export const terminateCSVWorkers = () => {
    for(const key in csvworkers) {
        csvworkers[key].terminate();
    }
}


export async function recordAlert(alert:{message:string,timestamp:number, value:any, from:string, [key:string]:any}, streamId?) {

    const workername = streamId ? streamId+'alerts' : 'alerts';
    
    //if(state.data[streamId ? streamId + 'isRecording' : 'isRecording']) {
        if(!csvworkers[workername]) {
            csvworkers[workername] =  workers.addWorker({ url: gsworker });
            await csvworkers[workername].run('createCSV', [
                `${alert.from}/Alerts_${alert.from}.csv`,
                [
                    'timestamp','message','value','from'
                ]
            ]);
        }
        await csvworkers[workername].run('appendCSV',alert);
    //}

}


export const recordEvent = async (from, event, streamId?) => {
    const name = streamId ? streamId+'events' : 'events';
    
    //if(state.data[streamId ? streamId + 'isRecording' : 'isRecording']) {
        if(!csvworkers[name]) {
            csvworkers[name] =  workers.addWorker({ url: gsworker });
            await csvworkers[name].run('createCSV', [
                `${from}/Events_${from}.csv`,
                [
                    'timestamp','from', 'event', 'notes', 'grade', 'value', 'units', 'location', 'startTime', 'endTime'
                ]
            ]);
        }
        await csvworkers[name].run('appendCSV', event);
    //}

    stateHandler.setValue(streamId ? streamId+'event' : 'event', event);
}

export const recordChat = async (from,message,streamId?) => {
    const name = streamId ? streamId+'chat' : 'chat';
    if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) {
        if(!csvworkers[name]) {
            csvworkers[name] =  workers.addWorker({ url: gsworker });
            await csvworkers[name].run('createCSV', [
                `${from}/Chat_${from}${toISOLocal(Date.now())}.csv`,
                [
                    'timestamp','from','message'
                ]
            ]);
        }
        await csvworkers[name].run('appendCSV', message)
    }
}



export async function recordCSV(
    streamId?:string, 
    sensors?:Sensors[], 
    subTitle?:string, 
    dir='data'
) { 
    if(!sensors || sensors.includes('emg')) csvworkers[streamId ? streamId+'emg' : 'emg'] =  workers.addWorker({ url: gsworker });
    if(!sensors || sensors.includes('ecg')) csvworkers[streamId ? streamId+'ecg' : 'ecg'] =  workers.addWorker({ url: gsworker });
    if(!sensors || sensors.includes('ppg')) csvworkers[streamId ? streamId+'ppg' : 'ppg'] =  workers.addWorker({ url: gsworker });
    if(!sensors || sensors.includes('hr')) csvworkers[streamId ? streamId+'hr' : 'hr'] =  workers.addWorker({ url: gsworker });
    if(!sensors || sensors.includes('breath')) csvworkers[streamId ? streamId+'breath' : 'breath'] =  workers.addWorker({ url: gsworker });
    if(!sensors || sensors.includes('accel')) csvworkers[streamId ? streamId+'accel' : 'accel'] =  workers.addWorker({ url: gsworker });
    if(!sensors || sensors.includes('env')) csvworkers[streamId ? streamId+'env' : 'env'] =  workers.addWorker({ url: gsworker });
    //csvworkers[streamId ? streamId+'emg2' : 'emg2'] =  workers.addWorker({ url: gsworker })

    stateHandler.setState({[streamId ? streamId + 'isRecording' : 'isRecording']:true});

    if(!sensors || sensors.includes('ppg')) {
        let makeCSV = async () => {
            let filename = dir+`/PPG_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
            fileNames['ppg'] = filename;
            if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
                await csvworkers[streamId ? streamId+'ppg' : 'ppg']?.run('createCSV', [
                filename,
                [
                    'timestamp', 
                    'raw', 'filtered'
                ],
                0,
                100
            ]);
        }
        if(stateHandler.data[streamId ? streamId+'detectedPPG' : 'detectedPPG']) {
            await makeCSV();
        } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedPPG' : 'detectedPPG', makeCSV);
        recordingSubs[`${streamId ? streamId : ''}ppg`] = stateHandler.subscribeEvent(streamId ? streamId+'ppg' :'ppg', (ppg) => {
            csvworkers[streamId ? streamId+'ppg' : 'ppg'].post('appendCSV',[ppg, fileNames['ppg']]);
        });
    }

    if(!sensors || sensors.includes('breath')) {
        let makeCSV = async () => {
            let filename =  dir+`/BRE_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
            fileNames['breath'] = filename;
            
            if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
                await csvworkers[streamId ? streamId+'breath' : 'breath']?.run(
                    'createCSV', [
                    filename,
                    [
                        'timestamp', 'breath', 'brv'
                    ],
                    3,
                    0
                ]);
        }
        if(stateHandler.data[streamId ? streamId+'detectedPPG' : 'detectedPPG']) {
            await makeCSV();
        } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedPPG' : 'detectedPPG', makeCSV);
        recordingSubs[`${streamId ? streamId : ''}breath`] = stateHandler.subscribeEvent(streamId ? streamId+'breath' :'breath', (breath) => {
            csvworkers[streamId ? streamId+'breath' : 'breath'].post(
                'appendCSV',
                [breath, fileNames['breath']]
            );
        });
    }

    if(!sensors || sensors.includes('hr')) {
        let makeCSV = async () => {
            let filename =  dir+`/HRV_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
            fileNames['hr'] = filename;
            if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
                await csvworkers[streamId ? streamId+'hr' : 'hr']?.run(
                    'createCSV', [
                    filename,
                    [
                        'timestamp', 'hr', 'hrv', 'confidence'
                    ],
                    3,
                    0
                ]);
        }
        if(stateHandler.data[streamId ? streamId+'detectedPPG' : 'detectedPPG']) {
            await makeCSV();
        } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedPPG' : '``detectedPPG```', makeCSV);
        recordingSubs[`${streamId ? streamId : ''}hr`] = stateHandler.subscribeEvent(streamId ? streamId+'hr' : 'hr', (hr) => {
            csvworkers[streamId ? streamId+'hr' : 'hr'].post('appendCSV',[hr, fileNames['hr']]);
        });
    }


    // if(!sensors || sensors.includes('emg')) {
    //     let makeCSV = () => {
    //         let header = ['timestamp','0','1','2','3','4'];
    //         // if(state.data[streamId ? streamId+'emg' : 'emg'].leds) {
    //         //     header.push('leds');
    //         // }
    //         let filename =  dir+`/EMG_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
    //         fileNames['emg'] = filename;
    //         if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
    //             csvworkers[streamId ? streamId+'emg' : 'emg']?.run(
    //                 'createCSV', [
    //                 filename,
    //                 header,
    //                 5,
    //                 250
    //             ]);
    //     }
    //     if(stateHandler.data[streamId ? streamId+'detectedEMG' : 'detectedEMG']) {
    //         makeCSV();
    //     } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedEMG' : 'detectedEMG', makeCSV);
    //     recordingSubs[`${streamId ? streamId : ''}emg`] = stateHandler.subscribeEvent(streamId ? streamId+'emg' : 'emg', (data) => {
    //         csvworkers[streamId ? streamId+'emg' : 'emg'].post(
    //             'appendCSV',
    //             [data, fileNames['emg']]
    //         );
    //     });
    // }

    // if(!sensors || sensors.includes('ecg')) {
    //     let makeCSV = () => {
    //         let header = ['timestamp','5'];
    //         // if(state.data[streamId ? streamId+'emg' : 'emg'].leds) {
    //         //     header.push('leds');
    //         // }
    //         let filename =  dir+`/ECG_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
    //         fileNames['ecg'] = filename;
    //         if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
    //             csvworkers[streamId ? streamId+'ecg' : 'ecg']?.run(
    //                 'createCSV', [
    //                 filename,
    //                 header,
    //                 5,
    //                 250
    //             ]);
    //     }
    //     if(stateHandler.data[streamId ? streamId+'detectedEMG' : 'detectedEMG']) {
    //         makeCSV();
    //     } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedEMG' : 'detectedEMG', makeCSV);
    //     recordingSubs[`${streamId ? streamId : ''}ecg`] = stateHandler.subscribeEvent(streamId ? streamId+'emg' : 'emg', (data) => {
    //         csvworkers[streamId ? streamId+'ecg' : 'ecg'].post(
    //             'appendCSV',
    //             [data, fileNames['ecg']]
    //         );
    //     });
    // }

    if(!sensors || sensors?.includes('accel')) {
        let makeCSV = async () => {
            let filename =  dir+`/accel_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
            fileNames['accel'] = filename;
            if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
                await csvworkers[streamId ? streamId+'accel' : 'accel']?.run(
                    'createCSV', [
                    filename,
                    [
                        'timestamp',
                        'ax', 'ay', 'az', 'gx', 'gy', 'gz'
                    ],
                    0,
                    100
                ]);
        }
        if(stateHandler.data[streamId ? streamId+'detectedAccel' : 'detectedAccel']) {
            await makeCSV();
        } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedAccel' : 'detectedAccel', makeCSV);
        
        recordingSubs[`${streamId ? streamId : ''}accel`] = stateHandler.subscribeEvent(streamId ? streamId+'accel' :'accel', (accel) => {
            csvworkers[streamId ? streamId+'accel' : 'accel'].post('appendCSV',[accel,fileNames['accel']]);
        });
    }

    if(!sensors || sensors?.includes('compass')) {
        let makeCSV = async () => {
            let filename =  dir+`/compass_${subTitle ? subTitle : streamId ? '_'+streamId : ''}${toISOLocal(Date.now())}.csv`;
            fileNames['compass'] = filename;
            if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
                await csvworkers[streamId ? streamId+'compass' : 'compass']?.run(
                    'createCSV', [
                    filename,
                    [
                        'timestamp',
                        'x', 'y', 'z', 'dx', 'dy', 'dz', 'heading'
                    ],
                    0,
                    100
                ]);
        }
        if(stateHandler.data[streamId ? streamId+'detectedCompass' : 'detectedCompass']) {
            await makeCSV();
        } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedCompass' : 'detectedCompass', makeCSV);
        
        recordingSubs[`${streamId ? streamId : ''}accel`] = stateHandler.subscribeEvent(streamId ? streamId+'accel' :'accel', (accel) => {
            csvworkers[streamId ? streamId+'accel' : 'accel'].post('appendCSV',[accel,fileNames['accel']]);
        });
    }

    if(!sensors || sensors?.includes('env')) {
        let makeCSV = async () => {
            let filename =  dir+`/ENV_${toISOLocal(Date.now())}${subTitle ? subTitle : streamId ? '_'+streamId : ''}.csv`;
            fileNames['env'] = filename;
            if(stateHandler.data[streamId ? streamId + 'isRecording' : 'isRecording']) 
                await csvworkers[streamId ? streamId+'env' : 'env']?.run('createCSV', [
                filename,
                [
                    'timestamp',
                    'temperature', 'pressure', 'humidity', 'altitude'
                ],
                4
            ]);
        }
        if(stateHandler.data[streamId ? streamId+'detectedEnv' : 'detectedEnv']) {
            await makeCSV();
        } else stateHandler.subscribeEventOnce(streamId ? streamId+'detectedEnv' : 'detectedEnv', makeCSV);
        
        recordingSubs[`${streamId ? streamId : ''}env`] = stateHandler.subscribeEvent(streamId ? streamId+'env' :'env', (env) => {
            csvworkers[streamId ? streamId+'env' : 'env'].post('appendCSV', [env,fileNames['env']]);
        });
    }
}

export async function stopRecording(streamId?:string, dir='data', folderListDir='data') {
    stateHandler.setState({[streamId ? streamId + 'isRecording' : 'isRecording']:false});

    let promises = [] as any[];

    let name;
    if(streamId) {
        let ses = WebRTCclient.rtc[streamId] as RTCCallInfo;
        if(ses) {
            name = ses.firstName + '_' + ses.lastName;
        }
    } else if(client.currentUser?.firstName) {
        name = client.currentUser.firstName + '_' + client.currentUser.lastName;
    }
    
    if(`${streamId ? streamId : ''}emg` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}emg`, recordingSubs[`${streamId ? streamId : ''}emg`]);
    }
    if(`${streamId ? streamId : ''}ecg` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}emg`, recordingSubs[`${streamId ? streamId : ''}ecg`]);
    }
    if(`${streamId ? streamId : ''}compass` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}compass`, recordingSubs[`${streamId ? streamId : ''}compass`]);
    }
    if(`${streamId ? streamId : ''}ppg` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}ppg`, recordingSubs[`${streamId ? streamId : ''}ppg`]);
    }
    if(`${streamId ? streamId : ''}accel` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}accel`, recordingSubs[`${streamId ? streamId : ''}accel`]);
    }
    if(`${streamId ? streamId : ''}env` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}env`, recordingSubs[`${streamId ? streamId : ''}env`]);
    }
    if(`${streamId ? streamId : ''}hr` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}hr`, recordingSubs[`${streamId ? streamId : ''}hr`]);
        
        let filename1 = dir+'/HRV_Session';
        
        if(streamId) {
            let ses = WebRTCclient.rtc[streamId] as RTCCallInfo;
            if(ses) {
                filename1 += '_' + name;
            }
        } else if(client.currentUser?.firstName) {
            filename1 += '_' + name;
        }

        csvworkers[streamId ? streamId+'hrses' : 'hrses'] =  workers.addWorker({ url: gsworker });
        promises.push(csvworkers[streamId ? streamId+'hrses' : 'hrses'].run('processHRSession',[fileNames['hr'],filename1]));

    }
    if(`${streamId ? streamId : ''}breath` in recordingSubs) {
        stateHandler.unsubscribeEvent(`${streamId ? streamId : ''}breath`, recordingSubs[`${streamId ? streamId : ''}breath`]);

          
        let filename2 = dir+'/Breathing_Session';
        
        if(streamId) {
            let ses = WebRTCclient.rtc[streamId] as RTCCallInfo;
            if(ses) {
                filename2 += '_' + name;
            }
        } else if(client.currentUser?.firstName) {
            filename2 += '_' + name;
        }

        csvworkers[streamId ? streamId+'brses' : 'brses'] =  workers.addWorker({ url: gsworker });
        promises.push(csvworkers[streamId ? streamId+'brses' : 'brses'].run('processBRSession',[fileNames['breath'],filename2]));
    }

    //heartrate session average
    if(promises.length > 0) await Promise.all(promises);

    let tempworker = workers.addWorker({ url: gsworker });
    await tempworker.run('checkFolderList',[folderListDir+'/folderList', name]);

    csvworkers[streamId+'chat']?.terminate();
    csvworkers[streamId+'alerts']?.terminate();
    csvworkers[streamId ? streamId+'emg' : 'emg']?.terminate();
    csvworkers[streamId ? streamId+'ecg' : 'ecg']?.terminate();
    csvworkers[streamId ? streamId+'ppg' : 'ppg']?.terminate();
    csvworkers[streamId ? streamId+'hr' : 'hr']?.terminate();
    csvworkers[streamId ? streamId+'breath' : 'breath']?.terminate();
    csvworkers[streamId ? streamId+'accel' : 'accel']?.terminate();
    csvworkers[streamId ? streamId+'compass' : 'compass']?.terminate();
    csvworkers[streamId ? streamId+'env' : 'env']?.terminate();
    //csvworkers[streamId ? streamId+'emg2' : 'emg2']?.terminate();
    
    // csvworkers[streamId ? streamId+'hrses' : 'hrses']?.terminate();
    // csvworkers[streamId ? streamId+'brses' : 'brses']?.terminate();

    //breath session average

}





