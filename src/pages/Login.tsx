import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar el magic link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-black text-teal-400">V</span>
          </div>
          <h1 className="text-2xl font-black text-white">Developer Portal</h1>
          <p className="text-sm text-gray-400 mt-1">Validus RaaS API</p>
        </div>

        {sent ? (
          <div className="bg-[#12121A] border border-white/5 rounded-2xl p-6 text-center">
            <p className="text-white font-semibold mb-2">Revisa tu email</p>
            <p className="text-sm text-gray-400">
              Enviamos un magic link a <span className="text-teal-400">{email}</span>.
              Haz clic en el enlace para acceder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="bg-[#12121A] border border-white/5 rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                autoFocus
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
