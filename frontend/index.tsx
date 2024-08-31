import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.js';
import { makeSocket } from './scripts/streamclient.js';
import { initDriveConfig } from './scripts/fetch.js';

const main = async () => {

    await initDriveConfig();

    // Create a root element
    const rootElement = document.getElementById('app');

    let root = createRoot(rootElement);
    // Render the Login component
    root.render(
        <App />
    );

}

//run the app sequence
main();