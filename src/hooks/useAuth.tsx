import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'admin' | 'agent';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  profile: { full_name: string | null; is_active: boolean } | null;
  loading: boolean;
  switchRole: (role: AppRole) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: AppRole
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    is_active: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase
        .from('profiles')
        .select('full_name, is_active')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    // ── is_active enforcement ───────────────────────────────────────────────
    // If the profile row exists and is_active is explicitly false, sign out.
    if (profileRes.data && profileRes.data.is_active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
      setRoles([]);
      setProfile(null);
      setLoading(false);
      return;
    }

    const userRoles = (roleRes.data ?? []).map((r) => r.role as AppRole);
    setRoles(userRoles);

    const savedRole = localStorage.getItem(
      `leaddial_role_${userId}`
    ) as AppRole | null;
    const activeRole =
      savedRole && userRoles.includes(savedRole)
        ? savedRole
        : userRoles.includes('admin')
        ? 'admin'
        : userRoles[0] ?? null;

    setRole(activeRole);
    setProfile(
      profileRes.data
        ? { full_name: profileRes.data.full_name, is_active: profileRes.data.is_active ?? true }
        : null
    );
  };

  const switchRole = (newRole: AppRole) => {
    if (roles.includes(newRole) && user) {
      setRole(newRole);
      localStorage.setItem(`leaddial_role_${user.id}`, newRole);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setRole(null);
        setRoles([]);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: AppRole
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error as Error };
    if (data.user) {
      // Always insert as 'agent' from public signup; admins are assigned manually
      await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: 'agent' });
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        roles,
        profile,
        loading,
        switchRole,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
