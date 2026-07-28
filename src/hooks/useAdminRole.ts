import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_EMAILS = [
  'lucianoalonso2000@gmail.com',
  'luciano@scouttech.lat',
  'contacto@scouttech.lat',
];

export interface AdminRoleState {
  isAdmin: boolean;
  role: string | null;
  loading: boolean;
}

export function useAdminRole(): AdminRoleState {
  const [state, setState] = useState<AdminRoleState>({ isAdmin: false, role: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = (session?.user?.email ?? '').toLowerCase();
      const userMeta = session?.user?.user_metadata?.role;
      const appMeta = session?.user?.app_metadata?.role;

      const isLegacy = ADMIN_EMAILS.includes(email) || email.endsWith('@scouttech.lat') || email.includes('admin');
      const isRoleAdmin = userMeta === 'admin' || appMeta === 'admin';

      try {
        const { data, error } = await supabase.rpc('get_my_admin_role');
        if (cancelled) return;

        if (!error && data) {
          const d = data as { is_admin?: boolean; role?: string | null };
          const isAdmin = Boolean(d.is_admin) || isLegacy || isRoleAdmin;
          setState({
            isAdmin,
            role: d.role ?? (isLegacy ? 'owner' : (isRoleAdmin ? 'admin' : null)),
            loading: false,
          });
          return;
        }
      } catch (_e) {
        // RPC fallback
      }

      if (cancelled) return;
      const isAdmin = isLegacy || isRoleAdmin;
      setState({
        isAdmin,
        role: isAdmin ? 'owner' : null,
        loading: false,
      });
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
