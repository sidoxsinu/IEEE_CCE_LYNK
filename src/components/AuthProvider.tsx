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
  eventActive: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  eventActive: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventActive, setEventActive] = useState(true);

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

        const { data: configData } = await supabase
          .from("config")
          .select("event_active")
          .eq("id", "main")
          .single();

        if (mounted) {
          if (configData) {
            setEventActive(configData.event_active);
          }
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
        const [userRes, configRes] = await Promise.all([
          supabase.from("users").select("uid").eq("uid", user.id).single(),
          supabase.from("config").select("event_active").eq("id", "main").single()
        ]);

        if (configRes.data) {
          setEventActive(configRes.data.event_active);
        }

        if (userRes.error || !userRes.data) {
          // Profile was deleted (e.g., blocked by admin), sign them out immediately
          await supabase.auth.signOut();
          setUser(null);
          setUserProfile(null);
          window.location.href = "/?error=Blocked";
        }
      }
    };

    const intervalId = setInterval(() => {
      handleVisibilityChange();
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, supabase]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error, eventActive }}>
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
