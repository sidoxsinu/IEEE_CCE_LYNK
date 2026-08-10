"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          if (mounted) setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          if (mounted) {
            setUser(null);
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error("Auth error:", err);
        if (mounted) setError("Failed to check authentication.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function fetchProfile(uid: string) {
      try {
        const { data, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("uid", uid)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (mounted) {
          if (data) {
            setUserProfile({
              uid: data.uid,
              displayName: data.display_name,
              email: data.email,
              photoUrl: data.photo_url,
              participantId: data.participant_id,
              role: data.role,
              createdAt: data.created_at,
            });
          } else {
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        if (mounted) setError("Failed to load your profile.");
      }
    }

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          if (mounted) setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          if (mounted) {
            setUser(null);
            setUserProfile(null);
          }
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Add visibility listener to re-verify profile if they switch tabs
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { data, error } = await supabase
          .from("users")
          .select("uid")
          .eq("uid", user.id)
          .single();

        if (error || !data) {
          // Profile was deleted (e.g., blocked by admin), sign them out immediately
          await supabase.auth.signOut();
          setUser(null);
          setUserProfile(null);
          window.location.href = "/?error=Blocked";
        }
      }
    };

    let lastCheck = Date.now();
    const handleClick = () => {
      const now = Date.now();
      if (now - lastCheck > 15000) { // Check at most every 15 seconds on click
        lastCheck = now;
        handleVisibilityChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("click", handleClick);
    };
  }, [user, supabase]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
