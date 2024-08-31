import { initializeApp } from './firebase-app.js';
import { getMessaging, getToken, onMessage } from "./firebase-messaging.js"

import './index.css'

// Generate a unique session ID
function generateSessionId() {
  return 'user_' + Math.random().toString(36).substring(2, 9);
}

let userId = generateSessionId();

async function fetchFirebaseConfig() {
  const response = await fetch('/config');
  return response.json();
}

//service worker init script also engages notification permissions on user device
async function initializeFirebase() {
  const config = await fetchFirebaseConfig();

  if (config && config.firebaseConfig) {
    const app = initializeApp(config.firebaseConfig);
    const messaging = getMessaging(app);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/dist/firebase-sw.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
          //messaging.useServiceWorker(registration);

          // Get the registration token using VAPID key
          getToken(messaging, { 
            serviceWorkerRegistration: registration,
            vapidKey: config.firebaseConfig.vapidKey //this will register notifications when the app is closed, equivalent to pushManager
          }).then(async (currentToken) => {
            if (currentToken) {
              console.log('FCM Token:', currentToken);
              const existingUserId = await getUserIdByToken(currentToken);
              if (existingUserId) {
                userId = existingUserId;
              }
              sendTokenToServer(currentToken);
            } else {
              console.log('No registration token available. Request permission to generate one.');
            }
          }).catch((err) => {
            console.log('An error occurred while retrieving token. ', err);
          });
        })
        .catch((err) => {
          console.log('Service Worker registration failed:', err);
        });
    }

    async function checkNotificationPermission() {
      if(Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          return true;
        } else {
          console.log('Unable to get permission to notify.');
          return false;
        }
      }
      return true;
    }

    

    onMessage(messaging, async (payload) => {
      console.log('Message received. ', payload);
      // Customize notification here
      if(await checkNotificationPermission()) {
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
          body: payload.notification.body,
          icon: payload.notification.icon
        };
        new Notification(notificationTitle, notificationOptions);
      }
    });
  } else {
    console.error('Failed to load Firebase configuration');
  }
}

async function getUserIdByToken(token) {
  const response = await fetch('/get-user-id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });
  const data = await response.json();
  return data.userId;
}

function sendTokenToServer(token) {
  fetch('/save-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId: userId, token })
  });
}

function revokeToken(userId, token) {
  fetch('/revoke-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, token })
  });
}

function subscribeToTopic(topic) {
  fetch('/subscribe-to-topic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, topic })
  }).then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error('Error subscribing to topic:', error));
}

function unsubscribeFromTopic(topic) {
  fetch('/unsubscribe-from-topic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, topic })
  }).then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error('Error unsubscribing from topic:', error));
}

//can send direct
function sendMessageToUser(title, body, recipientUserId) {
  fetch('/send-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body, recipientUserId })
  });
}

function scheduleNotification(title, body, time, topic) {
  fetch('/schedule-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, topic, title, body, time })
  });
}

function scheduleAndSubscribe(title, body, time, topic) {
  fetch('/schedule-and-subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, topic, title, body, time })
  }).then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error('Error scheduling and subscribing to topic:', error));
}

function deleteScheduledNotification(notificationId) {
  fetch('/delete-scheduled-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ notificationId })
  });
}

function getScheduledNotifications({ userId, topic }) {
  fetch('/get-scheduled-notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, topic })
  }).then(response => response.json())
    .then(data => displayNotifications(data.notifications))
    .catch(error => console.error('Error fetching scheduled notifications:', error));
}

function displayNotifications(notifications) {
  const notificationsList = document.getElementById('notificationsList');
  notificationsList.innerHTML = '';
  notifications.forEach(notification => {
    const listItem = document.createElement('li');
    listItem.textContent = `ID: ${notification.notificationId}, Topic: ${notification.topic}, Title: ${notification.title}, Body: ${notification.body}, Time: ${notification.time}`;
    notificationsList.appendChild(listItem);
  });
}

document.body.insertAdjacentHTML('beforeend',`
  <h1>Firebase Messaging Example</h1>
  <input type="text" id="topicInput" placeholder="Enter topic">
  <input type="text" id="titleInput" placeholder="Enter title">
  <input type="text" id="bodyInput" placeholder="Enter body">
  <input type="datetime-local" id="timeInput">
  <button id="subscribeButton">Subscribe to Topic</button>
  <button id="unsubscribeButton">Unsubscribe from Topic</button>
  <button id="scheduleButton">Schedule Notification</button>
  <button id="scheduleAndSubscribeButton">Schedule and Subscribe</button>
  <button id="getNotificationsButton">Get Scheduled Notifications</button>
  <button id="deleteNotificationsButton">Delete Scheduled Notifications</button>
  <ul id="notificationsList"></ul>
`);

// Example usage
document.getElementById('subscribeButton').addEventListener('click', () => {
  const topic = document.getElementById('topicInput').value;
  subscribeToTopic(topic);
});

document.getElementById('unsubscribeButton').addEventListener('click', () => {
  const topic = document.getElementById('topicInput').value;
  unsubscribeFromTopic(topic);
});

document.getElementById('scheduleButton').addEventListener('click', () => {
  const topic = document.getElementById('topicInput').value;
  const title = document.getElementById('titleInput').value;
  const body = document.getElementById('bodyInput').value;
  const time = document.getElementById('timeInput').value;
  scheduleNotification(title, body, time, topic);
});

document.getElementById('scheduleAndSubscribeButton').addEventListener('click', () => {
  const topic = document.getElementById('topicInput').value;
  const title = document.getElementById('titleInput').value;
  const body = document.getElementById('bodyInput').value;
  const time = document.getElementById('timeInput').value;
  scheduleAndSubscribe(title, body, time, topic);
});

document.getElementById('getNotificationsButton').addEventListener('click', () => {
  getScheduledNotifications({ userId });
});

document.getElementById('deleteNotificationsButton').addEventListener('click', () => {
  
  const topic = document.getElementById('topicInput').value;
  deleteScheduledNotification(`${userId}_${topic}`);
});

initializeFirebase();
