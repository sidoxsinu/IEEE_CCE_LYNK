import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg-alt p-6">
      <Card className="max-w-md w-full p-8 text-center bg-white border-thicker shadow-[8px_8px_0px_#000]">
        <div className="w-20 h-20 bg-error border-4 border-text rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_#000]">
          <h1 className="text-3xl font-black text-white">404</h1>
        </div>
        
        <h2 className="text-2xl font-black text-text mb-4 uppercase tracking-tight">Lost in the venue?</h2>
        
        <div className="bg-bg-alt border-2 border-text p-4 mb-8">
          <p className="text-text font-bold text-sm leading-relaxed">
            The page you're looking for doesn't exist or might have been moved.
          </p>
        </div>
        
        <Link 
          href="/home" 
          className="neo-button w-full"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back to Safety
        </Link>
      </Card>
    </div>
  );
}
