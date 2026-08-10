"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface GalleryItem {
  id: string;
  connection_id: string;
  selfie_url: string;
  created_at: string;
}

interface PhysicsNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export default function GalleryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const physicsRef = useRef<Map<string, PhysicsNode>>(new Map());
  const domRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("public_gallery")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);
      
    if (!error && data) {
      setItems(data);
      setTotalCount(prev => Math.max(prev, data.length)); 
    }
    setLoading(false);
  }, [supabase]);

  // Supabase Realtime logic
  useEffect(() => {
    fetchGallery();

    const channel = supabase.channel("gallery_changes");
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "public_gallery" },
      (payload) => {
        const newItem = payload.new as GalleryItem;
        setItems(current => {
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
      if (status === "SUBSCRIBED" && !loading) {
        fetchGallery();
      }
    });

    const handleOnline = () => fetchGallery();
    window.addEventListener("online", handleOnline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase, fetchGallery]);

  // Physics Initialization
  useEffect(() => {
    if (typeof window === "undefined") return;

    const scaleFactor = Math.max(0.3, Math.min(1.2, 4 / Math.sqrt(Math.max(1, items.length))));

    items.forEach(item => {
      const hash = item.id.split('-')[0];
      const intHash = parseInt(hash, 16);
      const targetSize = (60 + (intHash % 160)) * scaleFactor;
      
      if (!physicsRef.current.has(item.id)) {
        // Random start position within screen bounds
        const w = window.innerWidth;
        const h = window.innerHeight;
        // Keep within bounds
        const startX = Math.random() * Math.max(0, w - targetSize);
        const startY = Math.random() * Math.max(0, h - targetSize);

        // Very slow, relaxing drift (0.2 to 0.8 pixels per frame)
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + (Math.random() * 0.6);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        physicsRef.current.set(item.id, { id: item.id, x: startX, y: startY, vx, vy, size: targetSize });
      } else {
        // Update size for existing items so they shrink dynamically
        const node = physicsRef.current.get(item.id);
        if (node) node.size = targetSize;
      }
    });

    // Cleanup deleted items
    const currentIds = new Set(items.map(i => i.id));
    for (const id of Array.from(physicsRef.current.keys())) {
      if (!currentIds.has(id)) {
        physicsRef.current.delete(id);
        domRefs.current.delete(id);
      }
    }
  }, [items]);

  // Physics Animation Loop
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastTime = performance.now();

    const loop = (time: number) => {
      // Normalize dt so movement speed is consistent across screen refresh rates (e.g. 144hz vs 60hz)
      let dt = (time - lastTime) / 16.666;
      if (dt > 10) dt = 1; // Cap dt if tab was inactive to prevent huge jumps
      lastTime = time;

      const w = window.innerWidth;
      const h = window.innerHeight;

      physicsRef.current.forEach((node) => {
        node.x += node.vx * dt;
        node.y += node.vy * dt;

        // Boundary checks
        if (node.x <= 0) {
          node.x = 0;
          node.vx *= -1;
        } else if (node.x + node.size >= w) {
          node.x = w - node.size;
          node.vx *= -1;
        }

        if (node.y <= 0) {
          node.y = 0;
          node.vy *= -1;
        } else if (node.y + node.size >= h) {
          node.y = h - node.size;
          node.vy *= -1;
        }

        // Apply via ref
        const el = domRefs.current.get(node.id);
        if (el) {
          el.style.transform = `translate(${node.x}px, ${node.y}px)`;
        }
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  if (loading && items.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-alt">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg-alt overflow-hidden touch-none">
      
      {/* Header Overlay (Pointer events none so items pass underneath seamlessly, except for buttons) */}
      <div className="absolute top-4 left-4 right-4 z-50 flex flex-col md:flex-row justify-between items-center md:items-start pointer-events-none">
        <div className="flex flex-col items-center md:items-start mb-4 md:mb-0">
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest drop-shadow-md bg-bg-alt/50 px-2 rounded-lg inline-block backdrop-blur-sm mb-1">
            Shared Feed
          </p>
          <h1 className="text-3xl md:text-4xl font-black uppercase text-text bg-bg-alt/80 backdrop-blur-md px-4 py-1 rounded-lg pointer-events-auto border-2 border-text shadow-[2px_2px_0px_#000] inline-block text-center">
            Live Gallery
          </h1>
        </div>
        
        <div className="bg-white border-4 border-text shadow-[4px_4px_0px_#000] px-6 py-2 flex items-center justify-center gap-3 pointer-events-auto">
          <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
          <span className="font-black text-xl">{totalCount} Connections</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center flex-col z-10 pointer-events-none">
          <div className="bg-bg-alt/80 backdrop-blur-sm px-8 py-6 text-center border-4 border-text shadow-[4px_4px_0px_#000]">
            <h2 className="text-2xl font-black text-text-muted uppercase">No connections yet</h2>
            <p className="text-text font-bold">Be the first to make a match!</p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-0">
          {items.map((item) => {
            const hash = item.id.split('-')[0];
            const intHash = parseInt(hash, 16);
            
            const scaleFactor = Math.max(0.3, Math.min(1.2, 4 / Math.sqrt(Math.max(1, items.length))));
            const baseSize = 60 + (intHash % 160);
            const currentSize = baseSize * scaleFactor;
            
            const animDelay = (intHash % 20) * -0.3;

            return (
              <div
                key={item.id}
                ref={(el) => {
                  if (el) domRefs.current.set(item.id, el);
                  else domRefs.current.delete(item.id);
                }}
                className="absolute top-0 left-0 hover:z-[60]"
                style={{ 
                  width: `${currentSize}px`, 
                  height: `${currentSize}px`,
                }}
                onDragStart={(e) => e.preventDefault()}
              >
                <div className="w-full h-full opacity-0 animate-fade-in" style={{ animationDelay: `${Math.random() * 0.5}s` }}>
                  <div 
                    className="w-full h-full animate-droplet overflow-hidden border-4 border-text shadow-[4px_4px_0px_#000] bg-white hover:shadow-hard-hover cursor-pointer group"
                    style={{ animationDelay: `${animDelay * 1.5}s` }}
                  >
                    <img 
                      src={item.selfie_url} 
                      alt="Connection Selfie" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 pointer-events-none" 
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
