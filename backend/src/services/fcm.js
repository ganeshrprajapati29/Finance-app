import fetch from 'node-fetch';

/**
 * Sends a push notification via Firebase Cloud Messaging (FCM)
 * Requires FCM_SERVER_KEY in .env
 * Supports either:
 *  - topic: broadcast to subscribers (e.g., "news" or "offers")
 *  - token: send to specific device
 */
export async function sendFcmNotification({ title, body, topic, token }) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.warn('⚠️ FCM_SERVER_KEY missing in .env — using mock mode.');
    console.log(`Mock push: ${title} - ${body}`);
    return { success: true, mock: true };
  }

  // ✅ Build target
  let to = '/topics/general';
  if (token) to = token;
  else if (topic) to = `/topics/${topic}`;

  const message = {
    to,
    notification: {
      title,
      body,
      sound: 'default',
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      screen: 'home',
    },
  };

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(message),
    });

    const result = await res.json();
    console.log('📢 FCM Result:', result);
    return { success: true, fcm: result };
  } catch (err) {
    console.error('❌ FCM Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendFCMToToken(token, notification, data = {}) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key || !token) return false;
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `key=${key}` },
    body: JSON.stringify({ to: token, notification, data })
  });
  return res.ok;
}
