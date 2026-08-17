importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBd0fdBzverxO97NOQ5GCTyTkmpII6zhho",
    authDomain: "jaipurio-ab04a.firebaseapp.com",
    projectId: "jaipurio-ab04a",
    storageBucket: "jaipurio-ab04a.firebasestorage.app",
    messagingSenderId: "303213414487",
    appId: "1:303213414487:web:409fd7d6816ce336657b12",
    measurementId: "G-GJR2N1SJ24"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload?.notification?.title || payload?.data?.title || 'Jaipurio';
    const notificationOptions = {
        body: payload?.notification?.body || payload?.data?.body || 'You have a new notification.',
        icon: '/jaipurio-logo.png',
        badge: '/jaipurio-logo.png',
        data: {
            url: payload?.data?.click_action || '/'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification?.data?.url || '/';
    event.waitUntil(clients.openWindow(targetUrl));
});
