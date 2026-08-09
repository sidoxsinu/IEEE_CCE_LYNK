"use client";

import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";

interface ScrapbookEntry {
  id: string;
  target_name: string;
  target_department: string;
  fact_text: string;
  selfie_url: string;
  created_at: string;
}

export default function ScrapbookPage() {
  const { userProfile } = useAuth();
  const [entries, setEntries] = useState<ScrapbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    
    const fetchScrapbook = async () => {
      try {
        // Attempt to fetch scrapbook (assuming an RPC exists, or fallback to empty array if it fails)
        const { data, error } = await supabase.rpc("get_scrapbook");
        if (error) {
          console.warn("Could not fetch scrapbook:", error);
          // If RPC doesn't exist, we just leave it empty for now
        } else if (mounted && data) {
          setEntries(data);
        }
      } catch (err) {
        console.error("Error fetching scrapbook", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchScrapbook();
    
    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="px-4 pt-8 pb-safe-bottom bg-bg-alt min-h-dvh">
        <div className="skeleton h-10 w-48 mb-2 border-4 border-text" />
        <div className="skeleton h-4 w-64 mb-8 border-2 border-text" />
        <div className="grid grid-cols-1 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-80 w-full border-4 border-text bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-safe-bottom bg-bg-alt min-h-dvh">
      <h1 className="text-4xl tracking-tighter mb-2 font-black uppercase text-text">
        Scrapbook
      </h1>
      <p className="text-text-muted font-bold text-sm mb-8 uppercase tracking-widest">
        Your event memories, all in one place.
      </p>

      {entries.length === 0 ? (
        <Card className="p-8 text-center bg-white border-thicker border-dashed">
          <div className="w-16 h-16 rounded-full border-4 border-text bg-warning flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_#000]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          <h3 className="text-xl font-black uppercase mb-2">No memories yet</h3>
          <p className="text-text-muted font-bold text-sm leading-relaxed max-w-[280px] mx-auto">
            Your selfies and connection stories will appear here as you make connections. Go discover some clue cards!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {entries.map((entry) => (
            <Card key={entry.id} className="overflow-hidden bg-white border-thicker flex flex-col shadow-[4px_4px_0px_#000]">
              <div className="w-full aspect-square border-b-4 border-text bg-bg-alt relative">
                {entry.selfie_url ? (
                  <img 
                    src={entry.selfie_url} 
                    alt={`Selfie with ${entry.target_name}`} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-text-muted">
                    No image
                  </div>
                )}
                <Badge variant="primary" className="absolute top-4 left-4 shadow-[2px_2px_0px_#000]">
                  {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Badge>
              </div>
              <div className="p-5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-black uppercase truncate">{entry.target_name}</h3>
                  <Badge variant="default" className="shrink-0 ml-2 border-2 border-text text-xs uppercase">{entry.target_department}</Badge>
                </div>
                <div className="bg-bg-alt p-3 border-2 border-text text-sm font-bold text-text mt-2">
                  "{entry.fact_text}"
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
