'use client';

import { useState, useEffect } from 'react';
import { AuthWrapper } from './AuthWrapper';
import { User } from '@supabase/supabase-js';

interface Toolkit {
  slug: string;
  name: string;
  meta: {
    description: string;
    logo: string;
  };
}

interface AuthConfig {
  id: string;
  name: string;
  toolkit: string | { slug: string };
}

interface ConnectedToolkit {
  toolkit: Toolkit;
  authConfig: AuthConfig;
}

interface AuthConfigResponse {
  items: AuthConfig[];
}

interface ConnectedAccount {
  id: string;
  toolkit: {
    slug: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  email?: string;
}

function AppsPageContent({ user }: { user: User }) {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [toolkitLogos, setToolkitLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectedAccounts();
    // Also fetch toolkit metadata (logos) once
    (async () => {
      try {
        const res = await fetch('/api/toolkits');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          const map: Record<string, string> = {};
          for (const tk of items) {
            if (tk?.slug && tk?.meta?.logo) map[tk.slug.toLowerCase()] = tk.meta.logo;
          }
          setToolkitLogos(map);
        }
      } catch {}
    })();
  }, []);

  // Refresh connection data when component mounts (e.g., after OAuth callback)
  useEffect(() => {
    const refreshConnections = () => {
      console.log('Refreshing connection status...');
      fetchConnectedAccounts();
    };

    // Refresh immediately when component mounts
    refreshConnections();

    // Listen for connection success events from callback page
    const handleConnectionSuccess = (event: CustomEvent) => {
      console.log('Connection success event received:', event.detail);
      setTimeout(() => {
        refreshConnections();
      }, 1000); // Small delay to ensure backend is updated
    };

    // Also refresh when the window gains focus (user returns from OAuth popup)
    window.addEventListener('focus', refreshConnections);
    window.addEventListener('connectionSuccess', handleConnectionSuccess as EventListener);
    
    return () => {
      window.removeEventListener('focus', refreshConnections);
      window.removeEventListener('connectionSuccess', handleConnectionSuccess as EventListener);
    };
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const response = await fetch('/api/apps/connection');
      if (response.ok) {
        const data = await response.json();
        setConnectedAccounts(data.connectedAccounts || []);
      } else {
        console.warn('Failed to fetch connected accounts');
      }
    } catch (error) {
      console.error('Error fetching connected accounts:', error);
    }
    finally {
      setLoading(false);
    }
  };
  // Disconnect a specific connected account
  const handleDisconnectAccount = async (connectedAccount: ConnectedAccount) => {
    setConnecting(connectedAccount.toolkit?.slug || null);
    try {
      const response = await fetch('/api/connectedAccounts/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectedAccount.id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to disconnect: ${response.status}`);
      }
      // Optimistically remove from list
      setConnectedAccounts(prev => prev.filter(a => a.id !== connectedAccount.id));
      setTimeout(() => {
        fetchConnectedAccounts();
      }, 500);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      alert(`Failed to disconnect: ${error}`);
    } finally {
      setConnecting(null);
    }
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // No connect button needed in connected-only view

  if (loading) {
    return (
      <div className="flex-1" style={{ backgroundColor: '#fcfaf9' }}>
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-700">Your Apps</h1>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-600">Loading apps...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: '#fcfaf9' }}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-3 py-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-8 gap-3 sm:gap-4">
            <h1 className="text-lg sm:text-2xl font-semibold text-neutral-700">Your Apps</h1>
            <div className="relative">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search apps"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-auto pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-stone-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-transparent outline-none text-sm bg-white text-neutral-700"
              />
            </div>
          </div>

          <div className="mb-3 sm:mb-6" />

          <div className="bg-white rounded-lg sm:rounded-xl border border-stone-200 mb-6" style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
            {connectedAccounts.length > 0 ? (
              <div className="divide-y divide-stone-200">
                {connectedAccounts
                  .filter((a) =>
                    (a.toolkit?.slug || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((account) => (
                    <div key={account.id} className="p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-stone-50 transition-colors gap-3 sm:gap-0">
                      <div className="flex items-start sm:items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white border border-gray-200 rounded-md sm:rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {(() => {
                            const slug = (account.toolkit?.slug || 'app').toLowerCase();
                            const logo = toolkitLogos[slug];
                            return logo ? (
                              <img
                                src={logo}
                                alt={account.toolkit?.slug || 'App'}
                                className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = 'none';
                                  const fallback = img.nextElementSibling as HTMLSpanElement | null;
                                  if (fallback) fallback.classList.remove('hidden');
                                }}
                              />
                            ) : null;
                          })()}
                          {(() => {
                            const slug = (account.toolkit?.slug || '').toLowerCase();
                            const hasLogo = !!toolkitLogos[slug];
                            return (
                              <span className={`text-orange-500 text-sm sm:text-lg font-semibold ${hasLogo ? 'hidden' : ''}`}>
                                {getInitial(account.toolkit?.slug || 'App')}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-lg font-semibold text-neutral-900 mb-0.5 sm:mb-1">
                            {account.toolkit?.slug || 'Connected App'}
                          </h3>
                          <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed break-words">
                            Status: {account.status || 'ACTIVE'} • {account.email ? `Account: ${account.email}` : 'Connected'}
                          </p>
                          {account.status && account.status !== 'ACTIVE' && (
                            <p className="text-xs text-amber-600 mt-0.5">Pending activation — refresh after a few seconds.</p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 self-start sm:self-center">
                        <button 
                          onClick={() => handleDisconnectAccount(account)}
                          className="text-neutral-400 hover:text-neutral-600 text-sm font-medium flex items-center gap-1"
                        >
                          Disconnect
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-6 sm:p-12 text-center">
                <div className="text-neutral-500 text-sm sm:text-base">No connected apps found</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppsPage() {
  return (
    <AuthWrapper>
      {(user, loading) => {
        if (loading) {
          return (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#fcfaf9' }}>
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
          );
        }

        if (!user) {
          return (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#fcfaf9' }}>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to continue</h2>
                <a 
                  href="/auth" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-700"
                >
                  Sign In
                </a>
              </div>
            </div>
          );
        }

        return <AppsPageContent user={user} />;
      }}
    </AuthWrapper>
  );
}