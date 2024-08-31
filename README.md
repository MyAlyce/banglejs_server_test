## Build and run

With `tinybuild` installed globally (`npm i -g tinybuild`): `npm start`

The backend is standalone with 2 ports, one for a content server another for a data server so you can have separate endpoints. Make sure you npm install in /backend as well, see the README in backend for env setup.

## Configuration

See [`./tinybuild.config.js`](./tinybuild.config.js) for settings. 

Add build:true for build-only, add serve:true for serve-only, or set bundle or server to false alternatively.


### WebRTC Notes

You need your own ICE servers for a production application, see: https://www.metered.ca/tools/openrelay/