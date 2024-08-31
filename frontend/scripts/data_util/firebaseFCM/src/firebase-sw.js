const version = '1.0'; // Increment this version to update all caches
const cacheNamePrefix = 'pwa-assets-';
const cacheName = `${cacheNamePrefix}${version}`;
const assets = [
  "/",
  "/index.html",
  "/dist/index.css",
  "/dist/index.js",
  "/assets"
];

let cacheExpiration = 1000 * 60 * // seconds 
  60 * // minutes
  24 * // hours
  (4/24); // days (4 hours in this case)

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        return cache.addAll(assets).catch(error => {
          console.error('Failed to cache assets during install:', error);
          throw error;
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name.startsWith(cacheNamePrefix) && !isValidCacheName(name))
          .map(invalidCacheName => caches.delete(invalidCacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (!navigator.onLine) {
        return cachedResponse;
      }
      return caches.keys().then(cacheNames => {
        const relevantCacheName = cacheNames.find(name => name.startsWith(cacheNamePrefix));
        if (relevantCacheName && isValidCacheName(relevantCacheName)) {
          return cachedResponse || fetchAndUpdateCache(event.request, relevantCacheName);
        } else {
          return fetchAndUpdateCache(event.request, cacheName);
        }
      });
    })
  );
});

function fetchAndUpdateCache(request, cacheName) {
  return fetch(request).then(response => {
    if (request.method === 'GET' && assets.includes(new URL(request.url).pathname)) {
      const responseToCache = response.clone();
      caches.open(cacheName).then(cache => {
        cache.put(request, responseToCache);
      });
    }
    return response;
  }).catch(error => {
    console.error('Fetch failed; returning cached page instead.', error);
    return caches.match(request);
  });
}

let isValidCacheName = function(cacheName) {
  const cacheTimestamp = parseInt(cacheName.split('-').pop());
  const currentTime = new Date().getTime();
  return currentTime < cacheTimestamp + cacheExpiration;
};

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INITIALIZE_FIREBASE') {
    initializeFirebase(event.data.config);
  }
});

import './firebase-app'
import './firebase-messaging'

function initializeFirebase(firebaseConfig) {

  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/firebase-logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Fetch Firebase config and initialize Firebase
if (navigator.onLine) {
  fetch('/config')
    .then(response => response.json())
    .then(config => {
      if (config && config.firebaseConfig) {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'INITIALIZE_FIREBASE',
              config: config.firebaseConfig
            });
          });
        });
      } else {
        console.error('Failed to load Firebase configuration');
      }
    })
    .catch(error => {
      console.error('Error fetching Firebase configuration:', error);
    });
}
