import React from 'react';
import { Cookie, Settings, ShieldCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function CookiePolicy() {
  return (
    <PublicInfoPage
      eyebrow="Cookies"
      icon={Cookie}
      title="Cookie"
      accent="policy"
      copy="Khatu Pay may use essential cookies and local storage to support login, navigation, preferences and website reliability."
      primaryAction={{ to: '/', label: 'Back home' }}
      secondaryAction={{ to: '/privacy-policy', label: 'Privacy policy' }}
      checklist={['Essential website function', 'Login session support', 'Preference storage']}
      cards={[
        { icon: Cookie, title: 'Essential cookies', text: 'Used for website operation, routing and customer login sessions.', color: '#0f766e' },
        { icon: Settings, title: 'Preferences', text: 'Some browser storage may remember customer session or UI choices.', color: '#2563eb' },
        { icon: ShieldCheck, title: 'Control', text: 'Users can manage cookies from browser settings.', color: '#f59e0b' },
      ]}
      sections={[
        { title: 'What Cookies Do', text: 'Cookies are small files or browser storage entries that help a website function correctly.' },
        { title: 'Why We Use Them', text: 'Khatu Pay may use them for session handling, navigation, reliability and account experience.' },
        { title: 'Managing Cookies', text: 'Users can clear or block cookies from their browser settings. Some features may need essential storage to work.' },
      ]}
    />
  );
}
