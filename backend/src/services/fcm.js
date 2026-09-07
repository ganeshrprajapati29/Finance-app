import { getFirebaseAdmin } from '../config/firebaseAdmin.js';

function normalizeFcmData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ])
  );
}

function buildMessage({ title, body, data = {} }) {
  return {
    notification: { title, body },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      screen: 'notifications',
      sound: 'default',
      ...normalizeFcmData(data),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'khatupay_alerts',
        sound: 'default',
        priority: 'high',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  };
}

export async function sendFcmNotification({ title, body, topic, token, data = {} }) {
  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) {
    console.log(`Mock push: ${title} - ${body}`);
    return { success: true, mock: true };
  }

  const message = buildMessage({ title, body, data });
  if (token) message.token = token;
  else message.topic = topic || 'general';

  try {
    const messageId = await firebaseAdmin.messaging().send(message);
    return { success: true, messageId };
  } catch (err) {
    console.error('FCM Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendFCMToToken(token, notification, data = {}) {
  const result = await sendFCMToTokenDetailed(token, notification, data);
  return result.success;
}

export async function sendFCMToTokenDetailed(token, notification, data = {}) {
  if (!token) return { success: false, invalid: false, error: 'Missing token' };

  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) {
    console.log(`Mock push to token: ${notification.title} - ${notification.body}`);
    return { success: true, mock: true };
  }

  try {
    const messageId = await firebaseAdmin.messaging().send({
      ...buildMessage({
        title: notification.title,
        body: notification.body,
        data,
      }),
      token,
    });
    return { success: true, messageId };
  } catch (err) {
    console.error('FCM token send failed:', err.message);
    const code = err?.errorInfo?.code || err?.code || '';
    const invalid = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
      'messaging/mismatched-credential',
      'messaging/sender-id-mismatch',
    ].includes(code) || /notregistered|registration-token-not-registered|invalid|senderid mismatch|mismatched-credential/i.test(err.message || '');
    return { success: false, invalid, code, error: err.message };
  }
}
