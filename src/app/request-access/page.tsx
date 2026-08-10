"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function RequestAccessPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    department: "",
    paperTitle: "",
    clueText: ""
  });

  // Redirect if already fully registered
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in at all, go to login
        router.push("/");
      } else if (userProfile) {
        // Fully registered
        router.push("/home");
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading || !user || userProfile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-alt">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Unknown";
    const photoUrl = user.user_metadata?.avatar_url || "";

    try {
      const { error: insertError } = await supabase.from('join_requests').insert({
        email: user.email,
        name: displayName,
        photo_url: photoUrl,
        department: formData.department,
        paper_title: formData.paperTitle,
        clue_text: formData.clueText
      });

      if (insertError) {
        throw insertError;
      }

      await supabase.auth.signOut();
      router.push("/?error=RequestSubmitted");
    } catch (err: any) {
      console.error("Error submitting request:", err);
      setError(err.message || "Failed to submit request. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-alt flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-4 border-text shadow-[8px_8px_0px_#000] p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text uppercase">Request Access</h1>
          <p className="text-text/70 mt-2">
            Your email ({user.email}) is not registered. Please fill out the details below to request access from the admin.
          </p>
        </div>

        {error && (
          <div className="bg-warning/20 border-l-4 border-warning p-3 text-sm text-text">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
          <div className="space-y-1">
            <label className="text-sm font-bold text-text uppercase">Department *</label>
            <input 
              type="text" 
              required
              className="w-full border-2 border-text p-2 rounded-none focus:outline-none focus:ring-2 focus:ring-primary bg-bg"
              value={formData.department}
              onChange={e => setFormData(d => ({ ...d, department: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-text uppercase">Paper Title / Interest</label>
            <input 
              type="text" 
              className="w-full border-2 border-text p-2 rounded-none focus:outline-none focus:ring-2 focus:ring-primary bg-bg"
              value={formData.paperTitle}
              onChange={e => setFormData(d => ({ ...d, paperTitle: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-text uppercase">Personal Clue *</label>
            <p className="text-xs text-text/60 mb-2">A fun fact or hint about yourself for others to find you in the bingo.</p>
            <textarea 
              required
              rows={3}
              className="w-full border-2 border-text p-2 rounded-none focus:outline-none focus:ring-2 focus:ring-primary bg-bg resize-none"
              value={formData.clueText}
              onChange={e => setFormData(d => ({ ...d, clueText: e.target.value }))}
            />
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            className="w-full justify-center mt-4" 
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
          
          <Button 
            type="button" 
            variant="secondary" 
            className="w-full justify-center mt-2" 
            disabled={submitting}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/");
            }}
          >
            Cancel & Sign Out
          </Button>
        </form>
      </Card>
    </div>
  );
}
