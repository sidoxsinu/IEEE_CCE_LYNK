"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface GalleryItem {
  id: string;
  connection_id: string;
  selfie_url: string;
  created_at: string;
}

export default function GalleryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("public_gallery")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);
      
    if (!error && data) {
      setItems(data);
      // Rough estimation of total count could be max(current array length, totalCount)
      setTotalCount(prev => Math.max(prev, data.length)); 
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchGallery();

    const channel = supabase.channel("gallery_changes");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "public_gallery" },
      (payload) => {
        const newItem = payload.new as GalleryItem;
        setItems(current => {
          // Prevent duplicates if already fetched during a reconnect race condition
          if (current.some(item => item.id === newItem.id)) return current;
          return [newItem, ...current].slice(0, 150);
        });
        setTotalCount(c => c + 1);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "public_gallery" },
      (payload) => {
        setItems(current => current.filter(item => item.id !== payload.old.id));
        setTotalCount(c => Math.max(0, c - 1));
      }
    )
    .subscribe((status) => {
      // Handle reconnections by refetching snapshot
      if (status === "SUBSCRIBED") {
        // Only refetch if not initial load to avoid double fetch
        if (!loading) fetchGallery();
      }
    });

    const handleOnline = () => {
      fetchGallery();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase, fetchGallery]);

  if (loading && items.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-alt">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg-alt pt-8 pb-12 px-4 relative">
      
      {/* Header & Live Counter */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 sticky top-4 z-10">
        <div>
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest text-center md:text-left">Shared Feed</p>
          <h1 className="text-3xl md:text-4xl font-black uppercase text-text bg-bg-alt/80 px-2 -ml-2 rounded-lg">
            Live Gallery
          </h1>
        </div>
        
        <div className="bg-white border-4 border-text shadow-[4px_4px_0px_#000] px-6 py-2 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
          <span className="font-black text-xl">{totalCount} Connections</span>
        </div>
      </div>

      {/* CSS Masonry Layout */}
      {items.length === 0 ? (
        <div className="text-center py-20">
          <h2 className="text-2xl font-black text-text-muted uppercase">No connections yet</h2>
          <p className="text-text font-bold">Be the first to make a match!</p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center items-center gap-2 py-10 max-w-7xl mx-auto">
          <AnimatePresence>
            {items.map((item, index) => {
              // Create deterministic pseudo-random values based on the item ID
              const hash = item.id.split('-')[0];
              const intHash = parseInt(hash, 16);
              
              // Randomize size between 60px and 220px to match the varied collage effect
              const baseSize = 60 + (intHash % 160);
              // Randomize vertical and horizontal offset slightly to break the grid feel
              const marginTop = (intHash % 60) - 30; 
              const marginLeft = ((intHash >> 4) % 40) - 20;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ 
                    opacity: 0, 
                    y: shouldReduceMotion ? 0 : -50,
                    scale: 0.8 
                  }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    scale: 1 
                  }}
                  exit={{ 
                    opacity: 0, 
                    scale: 0.5,
                    transition: { duration: 0.3 }
                  }}
                  transition={{
                    type: shouldReduceMotion ? "tween" : "spring",
                    stiffness: 300,
                    damping: 20
                  }}
                  style={{
                    width: `${baseSize}px`,
                    height: `${baseSize}px`,
                    marginTop: `${marginTop}px`,
                    marginLeft: `${marginLeft}px`,
                  }}
                  className="relative flex-shrink-0 z-0 hover:z-50"
                >
                  <div className="w-full h-full rounded-full overflow-hidden border-4 border-text shadow-[4px_4px_0px_#000] bg-white transition-transform hover:-translate-y-2 hover:shadow-hard-hover cursor-pointer group">
                    <img 
                      src={item.selfie_url} 
                      alt="Connection Selfie" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                      loading="lazy"
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
