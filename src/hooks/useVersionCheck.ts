import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface VersionData {
  version: string;
  builtAt?: string;
}

export function useVersionCheck(intervalSeconds = 15) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const initialVersionRef = useRef<string | null>(
    typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : null
  );
  const notifiedRef = useRef(false);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) return;

      const data: VersionData = await res.json();
      if (!data || !data.version) return;

      // Si aún no tenemos versión inicial ref, la guardamos
      if (!initialVersionRef.current) {
        initialVersionRef.current = data.version;
        return;
      }

      // Si la versión del servidor difiere de la local, marcamos update y notificamos
      if (data.version !== initialVersionRef.current) {
        setHasUpdate(true);
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          toast.message('⚡ Nueva versión disponible', {
            description: 'Se ha publicado una actualización en producción. Haz clic para refrescar la página y cargar los cambios.',
            action: {
              label: 'Actualizar ahora',
              onClick: () => {
                if ('caches' in window) {
                  caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name));
                  });
                }
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.replace(url.toString());
              },
            },
            duration: 20000,
          });
        }
      }
    } catch (err) {
      // Si el fetch falla (ej: sin conexión momentánea), ignoramos en silencio
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, intervalSeconds * 1000);

    const handleActivity = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
    };
  }, [checkVersion, intervalSeconds]);

  const hardRefresh = useCallback(() => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
  }, []);

  return {
    hasUpdate,
    checkVersion,
    hardRefresh,
  };
}
