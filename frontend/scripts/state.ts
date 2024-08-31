import { EventHandler } from 'graphscript-core';
import { ZenFsRoutes } from './data_util/zenfsUtils';
import { ProfileStruct } from 'graphscript-database/src/services/struct/datastructures/types';

//this will maintain a persistent state for the application
export const stateHandler = new EventHandler();

stateHandler.setState({
    
    isLoggedIn: false,     //logged in?
    loggingIn: false,       //loading login?
    appInitialized: false, //initialized app?
    loggedInId: undefined, //id of the current user
    viewingId: undefined,  //id of the user currently being viewed
    savedEventOptions:[] as any, //list of event tags saved
    savedUnits:[] as any,
    selectedFolder:'',

    alertsEnabled:true,
    useHRAlert:true,
    useBreathAlert:true,
    useFallAlert:true,
    viewVitals:true,
})



//subscribe to the state so any and all changes are saved, can store multiple states (e.g. particular for pages or components)
export function backupState(
    filename='state.json', 
    backup=[
        'route',
        'viewVitals',
        'selectedVideo',
        'selectedAudioIn',
        'selectedAudioOut',
        'savedEventOptions',
        'savedUnits',
        'demoing',
        'alertsEnabled',
        'selectedFolder',
        'loggedInId',
        //'viewingId',
    ], //back these values up from the state object
    dir='data'
){
    //read initial data, now setup subscription to save the state every time it updates

    let lastState = {} as any;
    let hasUpdate = false;

    backup.forEach((v) => {
        lastState[v] = stateHandler.data[v];
        stateHandler.subscribeEvent(v, (newValue) => {
            lastState[v] = newValue;
            hasUpdate = true;    
        });
    });

    lastState.__timestamp = Date.now();

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
    u:Partial<ProfileStruct>|undefined,
    filename='state.json', //state file
    dir='data'
) {
    //make sure the indexeddb directory is initialized

    let exists = await ZenFsRoutes.exists(dir+'/'+filename);

    let read;
    if(exists) {
        read = await ZenFsRoutes.readFileAsText(
            dir+'/'+filename,
        )
        try {
            if(read) {
                let restored = JSON.parse(read);
                if(typeof restored === 'object') {
                    if(restored.loggedInId && restored.loggedInId === u?._id || !restored.loggedInId) {
                        
                        if(restored.accessToken && (Date.now() - restored.__timestamp > 1*24*60*60*1000))
                            delete restored.accessToken;
                        //e.g. delete the saved accessToken
                        
                        stateHandler.setState(restored);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
      
    backupState(filename, undefined, dir);

    return read;

}


