import { useState, useEffect, useRef, useCallback } from 'react';

interface VersionData {
  version: string;
  builtAt?: string;
}

export function useVersionCheck(intervalSeconds = 30) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const initialVersionRef = useRef<string | null>(
    typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : null
  );

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

      // Si la versión del servidor difiere de la local, marcamos update
      if (data.version !== initialVersionRef.current) {
        setHasUpdate(true);
      }
    } catch (err) {
      // Si el fetch falla (ej: sin conexión momentánea), ignoramos en silencio
    }
  }, []);

  useEffect(() => {
    // Comprobar versión al inicio por si cambió mientras no estaba cargado
    checkVersion();

    // Comprobar periódicamente
    const interval = setInterval(checkVersion, intervalSeconds * 1000);

    // Comprobar cuando el usuario vuelve a la pestaña
    const handleFocus = () => {
      checkVersion();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkVersion, intervalSeconds]);

  const hardRefresh = useCallback(() => {
    // Limpiar service workers y cachés de almacenamiento estático
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // Recargar con cache-buster para forzar la bajada del nuevo index.html y assets
    const url = new URL(window.location.href);
    url.searchParams.set('refresh', Date.now().toString());
    window.location.href = url.toString();
  }, []);

  return {
    hasUpdate,
    checkVersion,
    hardRefresh,
  };
}
