"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ShieldAlert, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Invalid password");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center p-8 relative overflow-hidden font-sans">
      {/* Visual background flair */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-64 -mt-64"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -ml-64 -mb-64"></div>
      
      <div className="w-full max-w-xl relative z-10">
        <div className="bg-[#16191d] border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden shadow-black/50">
          <div className="p-12 md:p-20">
            <div className="flex justify-center mb-10">
              <div className="h-20 w-20 bg-blue-600/10 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-xl shadow-blue-500/10">
                <Lock className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-3 uppercase tracking-tighter">
              ApexPlay Command
            </h1>
            <p className="text-gray-500 text-center mb-12 font-bold uppercase tracking-widest text-xs">
              Secure Management Authentication
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] pl-2">System Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black border border-white/5 rounded-2xl px-8 py-6 text-white placeholder-gray-800 focus:outline-none focus:border-blue-500 transition-all font-bold text-lg shadow-inner"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-4 text-red-500 bg-red-500/5 border border-red-500/10 rounded-2xl px-8 py-5 text-sm font-bold uppercase tracking-tight">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-6 rounded-2xl transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs active:scale-95"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Infiltrate Dashboard"
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-black/40 px-12 py-6 border-t border-white/5">
            <p className="text-[10px] text-gray-600 text-center font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Strategic Operations Center • Restricted
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
