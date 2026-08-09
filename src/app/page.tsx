"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function LoginContent() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signingIn, setSigningIn] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('desc');

    if (errorParam) {
      if (errorParam === 'NotRegistered') {
        setMatchError("Your email is not registered for this event. Please contact the event organizer.");
      } else if (errorParam === 'AlreadyClaimed') {
        setMatchError("This participant account has already been claimed by another login. Please contact the admin.");
      } else {
        setMatchError(`Sign-in failed: ${errorParam} ${errorDesc ? '(' + errorDesc + ')' : ''}`);
      }
    }
  }, [searchParams]);

  // Redirect if already logged in with profile
  useEffect(() => {
    if (!loading && user && userProfile) {
      if (userProfile.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/home");
      }
    }
  }, [user, userProfile, loading, router]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setMatchError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setMatchError("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMatchError(null);
  }

  // Show loading skeleton
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-text border-t-primary animate-spin" />
          <p className="text-text font-bold font-heading">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden bg-bg-alt">

      {/* Neo-brutalist geometric decorations */}
      <div className="absolute top-10 left-10 w-32 h-32 border-4 border-text bg-warning rotate-12 -z-10" />
      <div className="absolute bottom-20 right-10 w-48 h-12 border-4 border-text bg-success -rotate-6 -z-10" />
      <div className="absolute top-1/4 right-1/4 w-16 h-16 rounded-full border-4 border-text bg-primary -z-10" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">

        {/* Badge */}
        <Badge variant="primary" className="text-sm px-4 py-1.5 shadow-[2px_2px_0px_#000]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          IEEE CCE
        </Badge>

        {/* Logo & Title */}
        <div className="text-center">
          <h1 className="text-6xl font-black mb-4 uppercase tracking-tighter">
            <span className="text-primary" style={{ textShadow: "4px 4px 0px #000" }}>CONNECT</span>
          </h1>
          <p className="text-text font-medium text-base leading-relaxed max-w-[280px] mx-auto border-2 border-text bg-white p-3 shadow-[2px_2px_0px_#000]">
            Discover, connect, and build meaningful relationships at the event.
          </p>
        </div>

        {/* Sign-in Card */}
        <Card className="w-full p-8 flex flex-col items-center border-thicker shadow-hard text-center bg-white">

          {/* Error state */}
          {matchError && (
            <div className="mb-6 w-full text-left">
              <div className="bg-error text-white border-2 border-text p-4">
                <p className="text-sm font-bold">{matchError}</p>
              </div>
              {user && (
                <button
                  onClick={handleSignOut}
                  className="mt-4 w-full text-sm font-bold text-text hover:underline transition-all py-2"
                >
                  Sign out and try a different account
                </button>
              )}
            </div>
          )}

          {/* Sign-in button */}
          {!user && (
            <>
              <h2 className="text-xl font-black text-text mb-2 uppercase">
                Welcome
              </h2>
              <p className="text-sm text-text-muted font-medium mb-8">
                Sign in with your registered Google account to start networking.
              </p>

              <Button
                variant="secondary"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                isLoading={signingIn}
                className="w-full justify-center !py-4 text-lg border-thicker hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-1 active:translate-x-1 active:shadow-none"
              >
                {!signingIn && (
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                {signingIn ? "Redirecting..." : "Continue with Google"}
              </Button>
            </>
          )}
        </Card>

        {/* Footer */}
        <p className="text-xs text-text-muted font-bold max-w-[250px] text-center border-b-2 border-transparent">
          By signing in, you agree to participate in the event networking challenge.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-bg-alt">
        <div className="w-12 h-12 rounded-full border-4 border-text border-t-primary animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
