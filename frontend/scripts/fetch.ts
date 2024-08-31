import { stateHandler } from './state';
import { GDrive } from '../scripts/data_util/GDrive';
import { client, makeSocket, DataServer, DataBase } from './streamclient';

import { defaultServer, dataServerConfig } from '../../backend/serverconfig';

export const drive = new GDrive(undefined,undefined,'MyAlyce');

export const initializeDrive = async (apiKey: string, googleClientId: string) => {
    await drive.initGapi(apiKey, googleClientId);
};

type GSigninData = {
    name: string,
    email: string,
    id:string,
    picture: string
};

export const domain = `${defaultServer.protocol}://${defaultServer.domain || defaultServer.host}:${defaultServer.port}`


//sign in procedure:

//get google API credentials
//log in with google
//get google user info and access token
//supply to mongodb instance to establish the user on the server
//

//todo: move this, make it clearer
export const handleSignIn = async (buttonId: string, onSignInCallback: (result: any) => void) => {
    const button = document.getElementById(buttonId) as HTMLElement;

    const signInHandler = async () => {
        const resp = await drive.handleUserSignIn() as any; //just offloading sign in to google using the drive api we made following their documentation
        withSignInDetails(resp);
    };

    const withSignInDetails = async (resp) => {
        const resp2 = await drive.gapi.client.oauth2.userinfo.get() as {result:GSigninData}

        const googleUserData = resp2.result as any;
        googleUserData.accessToken = resp.access_token;
        googleUserData.pictureUrl = googleUserData.picture;
       
        ///successfully got google API, now establish a persistent socket connection.
        const result = await makeSocket();

        //shared with the DataBase class to point the user endpoint 
        client.currentUser = {
            ...DataServer.socket,
            ...googleUserData,
            pictureUrl:googleUserData.picture,
            _id:googleUserData.id
        };
        DataBase.currentUser = client.currentUser;
        //attaches this user to this socket on our server
        if(!result) {
            console.error("Websocket connection failed");
            return;
        }

        //make our backend know this user is tied to this socket (you can have multiple sockets for a single user on multiple endpoints or you can have multiple users on a single endpoint using multiple sockets)
        await DataServer.socket.run('addUser', [{_id:googleUserData.id}, {[DataServer.socket._id as string]:DataServer.socket._id}])
        
        //this sets up the mongodb connection and echos user data from server
        let userData = await DataBase.setupUser({ ...googleUserData }); //just use the google user id 
        //this will update the currentUser object


        if(userData) { //succesful result will echo the user profile

            stateHandler.setState({ isLoggedIn: true, user: googleUserData.id }); //propagates to sComponents 

            //handle biz after this
            onSignInCallback(googleUserData);
    
        }

        button.innerHTML = "Sign Out";
        button.onclick = () => {
            drive.deinit();
            button.innerHTML = "Sign In With Google";
            button.onclick = signInHandler;
            DataServer.socket.terminate();
            console.log('User signed out.');
            stateHandler.setState({ user: null, users: [], isLoggedIn: false });
        };
    }

    //this will attempt to use the existing session
    drive.restoreSignIn().then((resp) => {
        withSignInDetails(resp);
    }).catch(() => {
        button.onclick = signInHandler;
    })

};

export const signOut = async () => {    
    drive.deinit();
    DataServer.socket.terminate();
    console.log('User signed out.');
    stateHandler.setState({ user: null, users: [], isLoggedIn: false });
}

//run once
export const fetchConfig = async () => {
    const response = await fetch(`${domain}/config`);
    const config = await response.json();

    return config;
};

//held in memory
export const googleAPI = {
    apiKey:undefined,
    googleClientId:undefined,
    mapsKey:undefined //separate google maps key?
};

export const initDriveConfig = async () => {
    const config = DataServer.socket ? await DataServer.socket.run('/config') : await fetchConfig();
    if(config) {
        const apiKey = config.apiKey;
        const googleClientId = config.clientId;
        const mapsKey = config.mapsKey;

        Object.assign(googleAPI, {
            apiKey, googleClientId, mapsKey,
        })

        await initializeDrive(apiKey, googleClientId);
    } else console.error("Credentials not received");

}

export const fetchLogin = async (loginData: {
    accessToken: string,
    userId: string,
    name?: string,
    email?: string,
    picture?: string
}) => {
    if(DataServer.socket) {
        return await DataServer.socket.run('/login', loginData);
    }
    const response = await fetch(`${domain}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
    });
    return response.text();
};

export const fetchUserData = async (token: string, userId: string) => {
    if(DataServer.socket) {
        return await DataServer.socket.run('/users', [token, userId]);
    }
    const response = await fetch(`${domain}/users`, {
        method: 'GET',
        headers: {
            'Authorization': token,
            'UserId': userId
        }
    });
    return response.json();
};
