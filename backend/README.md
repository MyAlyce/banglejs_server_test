Simple production server for a multi-user application state system, including websockets, MongoDB, and Google credentials for an in-app Drive backup system.

Create a .env file with the following keys required to run the backend login system. Place this in /backend

```
MONGODB_URI=
GOOGLE_CLIENT_ID=
GOOGLE_API_KEY=
GOOGLE_MAPS_KEY=
```

The MongoDB URI is created by making a cluster through MongoDB Cloud and getting credentials by finding the Connect button after cluster creation: https://account.mongodb.com/

The Google Keys are create with google credentials: https://console.cloud.google.com/apis/credentials 

Make sure you add the localhost urls to the OAuth2 Client ID, for API Keys you can restrict to urls and users but they are not allowed to be published as apps without clearance from google.
