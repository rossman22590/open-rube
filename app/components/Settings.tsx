'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  date: string;
  total: number;
  user: number;
  assistant: number;
}

interface Analytics {
  usageByDay: UsageData[];
  totals: {
    messages: number;
    userMessages: number;
    assistantMessages: number;
  };
}

export function Settings() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics');
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      console.log('Analytics data:', data);
      console.log('Usage by day:', data.usageByDay);
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const maxValue = analytics 
    ? Math.max(...analytics.usageByDay.map(d => d.total), 1)
    : 1;

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

        {/* Account Management */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Management</h2>
          <p className="text-gray-600 mb-4">
            Manage your subscription, billing, and account settings.
          </p>
          <a
            href="https://account.myapps.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <span>Manage Account</span>
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Usage Analytics */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Usage Analytics</h2>
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Retry
              </button>
            </div>
          ) : analytics ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-600 font-medium mb-1">Total Messages</div>
                  <div className="text-3xl font-bold text-blue-900">{analytics.totals.messages}</div>
                  <div className="text-xs text-blue-600 mt-1">Last 30 days</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 font-medium mb-1">Your Messages</div>
                  <div className="text-3xl font-bold text-green-900">{analytics.totals.userMessages}</div>
                  <div className="text-xs text-green-600 mt-1">Questions asked</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-purple-600 font-medium mb-1">AI Responses</div>
                  <div className="text-3xl font-bold text-purple-900">{analytics.totals.assistantMessages}</div>
                  <div className="text-xs text-purple-600 mt-1">Responses received</div>
                </div>
              </div>

              {/* Usage Chart */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Daily Usage (Last 30 Days)
                  <span className="ml-2 text-xs text-gray-500">
                    (Data points: {analytics.usageByDay.length}, Max: {maxValue})
                  </span>
                </h3>
                {analytics.totals.messages === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No messages yet. Start chatting to see your usage analytics!
                  </div>
                ) : (
                  <>
                    <div className="relative bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-end justify-between gap-1 h-64">
                        {analytics.usageByDay.map((day, index) => {
                          const heightPercentage = day.total > 0 
                            ? Math.max((day.total / maxValue) * 100, 5)
                            : 0;
                          const isToday = new Date(day.date).toDateString() === new Date().toDateString();
                          
                          return (
                            <div key={day.date} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                              {/* Tooltip */}
                              {day.total > 0 && (
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10">
                                  <div className="font-semibold">{formatDate(day.date)}</div>
                                  <div className="mt-1">Total: {day.total}</div>
                                  <div>User: {day.user}</div>
                                  <div>AI: {day.assistant}</div>
                                </div>
                              )}
                              
                              {/* Bar */}
                              <div 
                                className={`w-full rounded-t transition-all duration-300 ${
                                  day.total > 0
                                    ? isToday 
                                      ? 'bg-orange-500 hover:bg-orange-600' 
                                      : 'bg-blue-500 hover:bg-blue-600'
                                    : 'bg-transparent'
                                }`}
                                style={{ height: `${heightPercentage}%`, minHeight: day.total > 0 ? '4px' : '0' }}
                              />
                              
                              {/* Date label - show every 5th day */}
                              {index % 5 === 0 && (
                                <div className="absolute -bottom-8 text-xs text-gray-500">
                                  {formatDate(day.date)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-center space-x-6 text-sm">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                        <span className="text-gray-600">Today</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                        <span className="text-gray-600">Previous days</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
