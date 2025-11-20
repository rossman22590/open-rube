'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RubeGraphic } from './components/RubeGraphic';
import { Navigation } from './components/Navigation';
import { ChatPage } from './components/ChatPageWithAuth';
import { AppsPage } from './components/AppsPageWithAuth';
import { MarketplacePage } from './components/MarketplacePageWithAuth';
import { ActivityLogs } from './components/ActivityLogs';
import { Settings } from './components/Settings';
import { AuthWrapper } from './components/AuthWrapper';
import { UserMenu } from './components/UserMenu';

function HomeContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('chat');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obStep, setObStep] = useState(0);
  const steps = [
    {
      title: 'Build faster with MCP Chat',
      blurb: 'Connect your apps, chat with your code, and ship changes safely with a guided review flow.',
      bullets: [
        'Use Marketplace to connect Gmail, Google Drive, Jira, Slack, and more',
        'Apps shows your connected accounts and lets you disconnect with one click',
        'Chat helps you explore code, create patches, and run tests with confidence',
      ],
      cta: { label: 'Open Marketplace', tab: 'marketplace' as const },
    },
    {
      title: 'Connect your tools',
      blurb: 'Search the Marketplace and press Connect. We handle OAuth or API keys securely on your device.',
      bullets: [
        'OAuth apps open a secure provider window; return here when done',
        'API key apps show a secure modal; keys are sent only to Composio, not stored',
        'No‑auth apps work instantly with no setup',
      ],
      cta: { label: 'Browse Apps', tab: 'marketplace' as const },
    },
    {
      title: 'Work in Chat',
      blurb: 'Ask for code changes, reviews, or investigations. Approve diffs before anything is applied.',
      bullets: [
        'Start with: “Analyze this repo and summarize the architecture”',
        'Then: “Add logging around X, include a feature flag, and write tests”',
        'Approve or reject proposed changes with a clear diff view',
      ],
      cta: { label: 'Go to Chat', tab: 'chat' as const },
    },
    {
      title: 'Stay in control',
      blurb: 'Security-first design: no secrets logged, transparent diffs, and easy rollbacks.',
      bullets: [
        'Apps tab shows exactly which accounts are connected',
        'Disconnect any time; re-connect when needed',
        'Review every change before it lands',
      ],
      cta: { label: 'Get Started', tab: null as unknown as 'chat' },
    },
  ];

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['chat', 'marketplace', 'apps', 'activity', 'settings'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    try {
      const seen = document.cookie.split('; ').find((c) => c.startsWith('onboarding_seen_v='));
      if (!seen) setShowOnboarding(true);
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    // 1 year expiry
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `onboarding_seen_v=2; path=/; expires=${expires.toUTCString()}`;
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (!showOnboarding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return dismissOnboarding();
      if (e.key === 'ArrowRight') return setObStep((s) => Math.min(s + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') return setObStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showOnboarding, steps.length]);

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPage />;
      case 'marketplace':
        return <MarketplacePage />;
      case 'apps':
        return <AppsPage />;
      case 'activity':
        return <ActivityLogs />;
      case 'settings':
        return <Settings />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <AuthWrapper>
      {(user, loading) => (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fcfaf9' }}>
          <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-3 text-black">
                <RubeGraphic />
                <span className="text-xl font-semibold text-gray-900">MCP Chat</span>
              </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setObStep(0); setShowOnboarding(true); }} className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-neutral-700 hover:bg-stone-50">Help</button>
              {user && <UserMenu user={user} />}
            </div>
            </div>
            <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
          </header>
          
          <main className="flex-1 flex flex-col">
            {renderContent()}
          </main>
          {showOnboarding && (
            <div className="fixed inset-0 z-[60]" onClick={dismissOnboarding}>
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
              <div className="relative z-[61] h-full w-full flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-b from-white to-stone-50 border border-stone-200 rounded-2xl shadow-2xl max-w-3xl w-full p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-6 pt-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center">✨</div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900">Welcome to MCP Chat</h2>
                        <p className="text-sm text-neutral-600">Your accelerated path from idea → working code</p>
                      </div>
                    </div>
                    <button onClick={dismissOnboarding} className="text-neutral-500 hover:text-neutral-700">✕</button>
                  </div>

                  <div className="px-6 pb-2 pt-4">
                    <div className="rounded-xl border border-stone-200 bg-white p-5">
                      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{steps[obStep].title}</h3>
                      <p className="text-neutral-700 mb-4">{steps[obStep].blurb}</p>
                      <div className="grid sm:grid-cols-2 gap-3 mb-4">
                        {steps[obStep].bullets.map((b, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span aria-hidden className="mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full bg-pink-600 text-white text-[12px] font-semibold leading-none shrink-0">{i+1}</span>
                            <span className="text-sm text-neutral-700">{b}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {steps.map((_, i) => (
                            <button key={i} aria-label={`Step ${i+1}`} onClick={() => setObStep(i)} className={`h-2.5 rounded-full transition-all ${i===obStep ? 'w-6 bg-pink-600' : 'w-2.5 bg-pink-200'}`} />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          {obStep > 0 && (
                            <button onClick={() => setObStep((s)=>Math.max(0,s-1))} className="px-3 py-2 text-neutral-700">Back</button>
                          )}
                          {obStep < steps.length - 1 ? (
                            <button onClick={() => setObStep((s)=>Math.min(steps.length-1,s+1))} className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white">Next</button>
                          ) : (
                            <button onClick={() => { if (steps[obStep].cta.tab) setActiveTab(steps[obStep].cta.tab); dismissOnboarding(); }} className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white">{steps[obStep].cta.label}</button>
                          )}
                          {obStep < steps.length - 1 && (
                            <button onClick={() => { if (steps[obStep].cta.tab) setActiveTab(steps[obStep].cta.tab); dismissOnboarding(); }} className="px-4 py-2 rounded-lg bg-stone-900/5 hover:bg-stone-900/10 text-neutral-900">{steps[obStep].cta.label}</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AuthWrapper>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fcfaf9' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
