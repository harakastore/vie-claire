import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        if (event === "TOKEN_REFRESHED" && !session) {
          // refresh failed → force redirect
          supabase.auth.signOut();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setSession(null);
      } else {
        setSession(session);
      }
      setLoading(false);
    });

    // Listen for JWT expired errors globally
    const handleJwtExpired = (e: any) => {
      const msg = e?.reason?.message || e?.message || "";
      if (typeof msg === "string" && (msg.includes("JWT expired") || msg.includes("invalid JWT"))) {
        supabase.auth.signOut();
      }
    };
    window.addEventListener("unhandledrejection", handleJwtExpired);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleJwtExpired);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
