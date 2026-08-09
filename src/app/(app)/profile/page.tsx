"use client";

import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function ProfilePage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [connectionsCount, setConnectionsCount] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      if (!userProfile?.uid) return;
      
      // Wait, connections table has initiator_uid or connector_uid?
      // In the earlier schema snippet, it was connector_uid!
      const { count } = await supabase
        .from("connections")
        .select("*", { count: "exact", head: true })
        .eq("from_uid", userProfile.uid)
        .eq("status", "verified");
      
      if (count) {
        setConnectionsCount(count);
      }
    }
    fetchStats();
  }, [supabase, userProfile]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="px-4 pt-8 pb-safe-bottom bg-bg-alt min-h-dvh">
      <h1 className="text-4xl tracking-tighter mb-8 font-black uppercase text-text">
        Profile
      </h1>

      {/* Profile Card */}
      <Card className="p-6 mb-6 bg-white border-thicker">
        <div className="flex items-center gap-5">
          {userProfile?.photoUrl ? (
            <img
              src={userProfile.photoUrl}
              alt={userProfile.displayName || "Avatar"}
              className="w-16 h-16 rounded-full border-4 border-text object-cover shadow-[2px_2px_0px_#000]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-4 border-text shadow-[2px_2px_0px_#000]">
              <span className="text-3xl font-black text-white uppercase">
                {userProfile?.displayName?.charAt(0) || "?"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-text truncate uppercase">
              {userProfile?.displayName}
            </h2>
            <p className="text-sm font-bold text-text-muted truncate mb-2">{userProfile?.email}</p>
            <Badge variant={userProfile?.role === "admin" ? "warning" : "primary"} className="shadow-[2px_2px_0px_#000]">
              {userProfile?.role === "admin" ? "🛡️ Admin" : "👤 Participant"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-4xl font-black text-primary">{connectionsCount}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-1">Connections</p>
        </Card>
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-4xl font-black text-text">—</p>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-1">Rank</p>
        </Card>
      </div>

      {/* Admin Link */}
      {userProfile?.role === "admin" && (
        <Button
          onClick={() => router.push("/admin")}
          className="w-full mb-4 justify-center text-lg py-4 border-thicker"
          id="admin-dashboard-link"
        >
          🛡️ Admin Dashboard
        </Button>
      )}

      {/* Sign Out */}
      <Button
        variant="secondary"
        onClick={handleSignOut}
        className="w-full justify-center text-lg py-4 border-thicker bg-error text-white hover:bg-red-700 hover:shadow-hard-hover active:shadow-none"
        id="sign-out-btn"
      >
        Sign Out
      </Button>
    </div>
  );
}
