import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** When a new version of the app has been deployed, say so and let the player reload when they are ready, instead of
 * swapping the page under them. Tabs left open also check for a new version every few minutes. */
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => { registration.update().catch(() => { /* offline: try again next time */ }); }, CHECK_EVERY_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version of the app is available', {
      id: 'app-update',
      duration: Infinity,
      description: 'Reload when you are ready, ideally between turns. Your characters and combat turn are kept.',
      action: { label: 'Reload now', onClick: () => { void updateServiceWorker(true); } },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
