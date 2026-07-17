"use client";

import { useEffect, useMemo, useState } from "react";

import { type AccessSection, type MemberRole } from "@/lib/access-control";
import { loadLocalDevSession } from "@/lib/local-dev-auth";
import { getSupabaseClient } from "@/lib/supabase/client";

type MemberAccessResponse = {
  member?: {
    accessSections?: AccessSection[];
    displayName?: string;
    loginId?: string;
    authEmail?: string;
    phone?: string;
    role?: string;
  } | null;
  canManageMembers?: boolean;
};

export function useMemberAccess() {
  const [sections, setSections] = useState<AccessSection[] | null>(null);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [isLocalDevSession, setIsLocalDevSession] = useState(false);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAccess() {
      const supabase = getSupabaseClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

      if (!data.session?.access_token) {
        const localSession = loadLocalDevSession();

        if (isMounted) {
          if (localSession) {
            setSections(localSession.accessSections);
            setCanManageMembers(true);
            setDisplayName(localSession.displayName);
            setPhone(null);
            setIsLocalDevSession(true);
            setRole(localSession.role);
            setHasSession(true);
          } else {
            setSections(null);
            setCanManageMembers(false);
            setDisplayName(null);
            setPhone(null);
            setIsLocalDevSession(false);
            setRole(null);
            setHasSession(false);
          }
        }
        return;
      }

      const response = await fetch("/api/admin/me", {
        headers: {
          authorization: `Bearer ${data.session.access_token}`
        }
      });
      const result = (await response.json().catch(() => ({}))) as MemberAccessResponse;

      if (isMounted) {
        setSections(result.member?.accessSections ?? null);
        setCanManageMembers(Boolean(result.canManageMembers));
        setDisplayName(result.member?.displayName ?? result.member?.loginId ?? result.member?.authEmail ?? null);
        setPhone(result.member?.phone ?? null);
        setIsLocalDevSession(false);
        setRole((result.member?.role as MemberRole | undefined) ?? null);
        setHasSession(true);
      }
    }

    void loadAccess();

    const supabase = getSupabaseClient();
    const { data: listener } =
      supabase?.auth.onAuthStateChange(() => {
        void loadAccess();
      }) ?? { data: null };

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  return useMemo(
    () => ({
      canManageMembers,
      displayName,
      hasSession,
      isLocalDevSession,
      phone,
      role,
      canAccess: (section: AccessSection) => !sections || sections.includes(section)
    }),
    [canManageMembers, displayName, hasSession, isLocalDevSession, phone, role, sections]
  );
}
