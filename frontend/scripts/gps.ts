
export let getCurrentLocation = (
    options:PositionOptions={enableHighAccuracy:true}):Promise<{ 
    accuracy:number, 
    latitude:number, 
    longitude:number, 
    altitudeAccuracy:any, 
    altitude:any, 
    speed:any, 
    heading:any, 
    timestamp:number
}|undefined> => {
    return new Promise((res,rej) => {
        if(!navigator.geolocation) rej('Geolocation not found in window.navigator');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                res({ 
                    accuracy:position.coords.accuracy, 
                    latitude:position.coords.latitude, 
                    longitude:position.coords.longitude, 
                    altitudeAccuracy:position.coords.altitudeAccuracy, 
                    altitude:position.coords.altitude, 
                    speed:position.coords.speed, 
                    heading:position.coords.heading, 
                    timestamp:position.timestamp
                });
            },
            rej,
            options
        )
    });
}

// //initialize on app load
// getCurrentLocation().then((position) => {
//     console.log('Test:: current position:', position);
// }); //run on init to get permission