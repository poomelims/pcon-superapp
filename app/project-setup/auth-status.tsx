"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clearLocalDevSession, loadLocalDevSession } from "@/lib/local-dev-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthState = {
  email: string | null;
  isLocalDevSession: boolean;
  loading: boolean;
};

export function AuthStatus() {
  const [authState, setAuthState] = useState<AuthState>({
    email: typeof window === "undefined" || isSupabaseConfigured ? null : loadLocalDevSession()?.loginId ?? null,
    isLocalDevSession: typeof window !== "undefined" && !isSupabaseConfigured ? Boolean(loadLocalDevSession()) : false,
    loading: isSupabaseConfigured
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase || !isSupabaseConfigured) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuthState({ email: data.session?.user.email ?? null, isLocalDevSession: false, loading: false });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({ email: session?.user.email ?? null, isLocalDevSession: false, loading: false });
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseClient();

    if (supabase) {
      await supabase.auth.signOut();
    }

    clearLocalDevSession();
    setAuthState({ email: null, isLocalDevSession: false, loading: false });
    window.location.assign("/login");
  }

  if (authState.loading) {
    return (
      <div className="min-w-0 max-w-full truncate rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-500 shadow-sm">
        Auth...
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    if (authState.email && authState.isLocalDevSession) {
      return (
        <div className="contents sm:flex sm:min-w-0 sm:max-w-full sm:flex-wrap sm:items-center sm:gap-2">
          <Link
            href="/login"
            className="min-w-0 max-w-full truncate rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 shadow-sm sm:max-w-[220px]"
            title={authState.email}
          >
            {authState.email}
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      );
    }

    return (
      <div className="min-w-0 max-w-full truncate rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 shadow-sm">
        Login env missing
      </div>
    );
  }

  if (!authState.email) {
    return (
      <Link
        href="/login"
        className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
      >
        Login
      </Link>
    );
  }

  return (
    <div className="contents sm:flex sm:min-w-0 sm:max-w-full sm:flex-wrap sm:items-center sm:gap-2">
      <Link
        href="/login"
        className="min-w-0 max-w-full truncate rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 shadow-sm sm:max-w-[220px]"
        title={authState.email}
      >
        {authState.email}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        Sign Out
      </button>
    </div>
  );
}
