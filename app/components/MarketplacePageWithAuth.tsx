"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthWrapper } from "./AuthWrapper";
import { User } from "@supabase/supabase-js";

interface ToolkitItem {
  slug: string;
  name: string;
  meta?: { description?: string; logo?: string };
  auth_schemes?: string[];
  composio_managed_auth_schemes?: string[];
}

interface ConnectedAccount {
  id: string;
  status: string;
  toolkit?: { slug?: string };
  email?: string;
}

interface AuthConfig {
  id: string;
  name?: string;
  toolkit: string | { slug: string };
}

export function MarketplacePageContent({ user }: { user: User }) {
  const [allToolkits, setAllToolkits] = useState<ToolkitItem[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [authConfigs, setAuthConfigs] = useState<AuthConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [credModal, setCredModal] = useState<{ open: boolean; slug: string | null; scheme: string | null }>({ open: false, slug: null, scheme: null });
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [noAuthLocal, setNoAuthLocal] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [tkRes, connRes, cfgRes] = await Promise.all([
          fetch("/api/toolkits"),
          fetch("/api/apps/connection"),
          fetch("/api/authConfig/all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
        ]);

        if (tkRes.ok) {
          const t = await tkRes.json();
          const items = Array.isArray(t?.items) ? t.items : Array.isArray(t) ? t : [];
          setAllToolkits(items);
        }
        if (connRes.ok) {
          const c = await connRes.json();
          setConnectedAccounts(c.connectedAccounts || []);
        }
        if (cfgRes.ok) {
          const a = await cfgRes.json();
          setAuthConfigs(a.items || []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const connectedSlugs = useMemo(
    () => new Set((connectedAccounts || []).map((a) => (a.toolkit?.slug || "").toLowerCase())),
    [connectedAccounts]
  );

  const authConfigBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const cfg of authConfigs || []) {
      const slug = typeof cfg.toolkit === "string" ? cfg.toolkit : cfg.toolkit?.slug;
      if (slug && !map.has(slug)) map.set(slug, cfg.id);
    }
    return map;
  }, [authConfigs]);

  const filtered = useMemo(
    () =>
      (allToolkits || []).filter((t) =>
        (t.name || t.slug || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.meta?.description || "").toLowerCase().includes(search.toLowerCase())
      ),
    [allToolkits, search]
  );

  const openCredentials = (slug: string, scheme: string) => {
    setCredValues({});
    setCredModal({ open: true, slug, scheme });
  };

  const submitCredentials = async () => {
    if (!credModal.slug || !credModal.scheme) return;
    setConnectingSlug(credModal.slug);
    try {
      const res = await fetch('/api/apps/credentials-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkitSlug: credModal.slug, scheme: credModal.scheme, credentials: credValues })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      // refresh connections
      const r = await fetch('/api/apps/connection');
      if (r.ok) {
        const c = await r.json();
        setConnectedAccounts(c.connectedAccounts || []);
      }
      // short poll up to ~10s for activation
      let tries = 0;
      const poll = async () => {
        tries += 1;
        const rr = await fetch('/api/apps/connection');
        if (rr.ok) {
          const cc = await rr.json();
          setConnectedAccounts(cc.connectedAccounts || []);
          const active = (cc.connectedAccounts || []).some((a: any) => (a.toolkit?.slug || '').toLowerCase() === (credModal.slug || '').toLowerCase() && (a.status === 'ACTIVE'));
          if (active || tries >= 5) return;
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 2000);
      setCredModal({ open: false, slug: null, scheme: null });
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setConnectingSlug(null);
    }
  };

  const handleConnect = async (slug: string) => {
    let authConfigId = authConfigBySlug.get(slug);
    // Lazy fetch authConfig by toolkit if not cached
    if (!authConfigId) {
      try {
        const r = await fetch('/api/authConfig/byToolkit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolkit: slug })
        });
        if (r.ok) {
          const j = await r.json();
          const items: AuthConfig[] = j.items || [];
          if (items.length > 0) {
            authConfigId = items[0].id;
          }
        }
      } catch {}
    }
    if (!authConfigId) {
      // Check if non-OAuth schemes exist; if so, prompt credentials instead of failing.
      const tk = allToolkits.find((x) => x.slug === slug);
      const schemes = tk?.auth_schemes || [];
      if (schemes.includes('NO_AUTH')) {
        // No auth required; mark locally as connected for a uniform UX
        setNoAuthLocal((prev) => ({ ...prev, [slug.toLowerCase()]: true }));
        return;
      }
      const hasCred = schemes.some((s) => ['API_KEY', 'BEARER_TOKEN', 'BASIC'].includes(s));
      if (hasCred) {
        // Prefer API_KEY or BEARER_TOKEN; otherwise BASIC
        const scheme = schemes.includes('API_KEY') ? 'API_KEY' : schemes.includes('BEARER_TOKEN') ? 'BEARER_TOKEN' : 'BASIC';
        openCredentials(slug, scheme);
        return;
      }
      alert("This app is not available to connect in this workspace.");
      return;
    }
    setConnectingSlug(slug);
    try {
      const res = await fetch("/api/apps/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authConfigId, toolkitSlug: slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create auth link (${res.status})`);
      }
      const data = await res.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
        setTimeout(async () => {
          const r = await fetch("/api/apps/connection");
          if (r.ok) {
            const c = await r.json();
            setConnectedAccounts(c.connectedAccounts || []);
          }
        }, 2000);
      }
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setConnectingSlug(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1" style={{ backgroundColor: "#fcfaf9" }}>
        <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-2xl font-semibold text-neutral-700 mb-6">Marketplace</h1>
          <div className="flex items-center justify-center h-64 text-neutral-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1" style={{ backgroundColor: "#fcfaf9" }}>
      <div className="max-w-6xl mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-8 gap-3 sm:gap-4">
          <h1 className="text-lg sm:text-2xl font-semibold text-neutral-700">Marketplace</h1>
          <div className="relative">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps"
              className="w-full sm:w-auto pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-stone-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-transparent outline-none text-sm bg-white text-neutral-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filtered.map((t) => {
            const slugLower = (t.slug || "").toLowerCase();
            const isConnected = connectedSlugs.has(slugLower) || !!noAuthLocal[slugLower];
            const logo = t.meta?.logo;
            const description = t.meta?.description || "";
            const canOAuth = !!authConfigBySlug.get(t.slug);
            const credSchemes = (t.auth_schemes || []).filter((s) => ['API_KEY', 'BEARER_TOKEN', 'BASIC'].includes(s));
            const pending = (connectedAccounts || []).some(a => (a.toolkit?.slug || '').toLowerCase() === slugLower && a.status && a.status !== 'ACTIVE');
            return (
              <div key={t.slug} className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 hover:shadow-sm transition-shadow flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                    {logo ? (
                      <img src={logo} alt={t.name} className="w-7 h-7 object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <span className="text-orange-500 font-semibold text-lg">{(t.name || t.slug || "?").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-neutral-900 truncate">{t.name || t.slug}</div>
                    <div className="text-xs text-neutral-500 truncate">{t.slug}</div>
                  </div>
                </div>
                <div className="text-sm text-neutral-600 line-clamp-3 flex-1">{description}</div>
                <div className="mt-4 flex items-center justify-between">
                  <div className={`text-xs ${isConnected ? "text-green-600" : "text-neutral-500"}`}>
                    {isConnected ? "Connected" : "Not connected"}
                  </div>
                  <div>
                    {isConnected ? (
                      <button disabled className="text-neutral-400 text-sm font-medium cursor-not-allowed">Connected</button>
                    ) : pending ? (
                      <button disabled className="text-neutral-400 text-sm font-medium cursor-not-allowed">Pending...</button>
                    ) : (
                      <button
                        onClick={() => handleConnect(t.slug)}
                        disabled={connectingSlug === t.slug}
                        className="bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg"
                      >
                        {connectingSlug === t.slug ? "Connecting..." : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {credModal.open && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl border border-stone-200 w-full max-w-md p-5">
              <h3 className="text-lg font-semibold text-neutral-900 mb-3">Connect with {credModal.scheme}</h3>
              {credModal.scheme === 'API_KEY' && (
                <input
                  type="password"
                  className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="API Key"
                  value={credValues.apiKey || ''}
                  onChange={(e) => setCredValues((v) => ({ ...v, apiKey: e.target.value }))}
                />
              )}
              {credModal.scheme === 'BEARER_TOKEN' && (
                <input
                  type="password"
                  className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="Bearer Token"
                  value={credValues.token || ''}
                  onChange={(e) => setCredValues((v) => ({ ...v, token: e.target.value }))}
                />
              )}
              {credModal.scheme === 'BASIC' && (
                <>
                  <input
                    className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg"
                    placeholder="Username"
                    value={credValues.username || ''}
                    onChange={(e) => setCredValues((v) => ({ ...v, username: e.target.value }))}
                  />
                  <input
                    type="password"
                    className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg"
                    placeholder="Password"
                    value={credValues.password || ''}
                    onChange={(e) => setCredValues((v) => ({ ...v, password: e.target.value }))}
                  />
                </>
              )}
              {/* Optional advanced fields */}
              <details className="mb-2">
                <summary className="text-sm text-neutral-600 cursor-pointer">Advanced</summary>
                <input
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="Base URL (optional)"
                  value={credValues.base_url || ''}
                  onChange={(e) => setCredValues((v) => ({ ...v, base_url: e.target.value }))}
                />
                <input
                  className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder="Header Name (optional, e.g. X-API-Key)"
                  value={credValues.header_name || ''}
                  onChange={(e) => setCredValues((v) => ({ ...v, header_name: e.target.value }))}
                />
              </details>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button onClick={() => setCredModal({ open: false, slug: null, scheme: null })} className="text-neutral-600 px-3 py-2">Cancel</button>
                <button onClick={submitCredentials} className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg">Save & Connect</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MarketplacePage() {
  return (
    <AuthWrapper>
      {(user, loading) => {
        if (loading) {
          return (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#fcfaf9" }}>
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
          );
        }
        if (!user) {
          return (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#fcfaf9" }}>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to continue</h2>
                <a href="/auth" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-700">Sign In</a>
              </div>
            </div>
          );
        }
        return <MarketplacePageContent user={user} />;
      }}
    </AuthWrapper>
  );
}
