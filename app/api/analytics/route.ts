import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/app/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Get usage data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('created_at, role')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching analytics:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics' }, 
        { status: 500 }
      );
    }

    // Group messages by day
    const usageByDay: { [key: string]: { total: number; user: number; assistant: number } } = {};
    
    // Initialize last 30 days with zero counts
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      usageByDay[dateKey] = { total: 0, user: 0, assistant: 0 };
    }

    // Count messages by day and role
    messages?.forEach(message => {
      const date = new Date(message.created_at);
      const dateKey = date.toISOString().split('T')[0];
      
      if (usageByDay[dateKey]) {
        usageByDay[dateKey].total++;
        if (message.role === 'user') {
          usageByDay[dateKey].user++;
        } else if (message.role === 'assistant') {
          usageByDay[dateKey].assistant++;
        }
      }
    });

    // Convert to array and sort by date
    const usageArray = Object.entries(usageByDay)
      .map(([date, counts]) => ({
        date,
        ...counts
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get total stats
    const totalMessages = messages?.length || 0;
    const totalUserMessages = messages?.filter(m => m.role === 'user').length || 0;
    const totalAssistantMessages = messages?.filter(m => m.role === 'assistant').length || 0;

    return NextResponse.json({
      usageByDay: usageArray,
      totals: {
        messages: totalMessages,
        userMessages: totalUserMessages,
        assistantMessages: totalAssistantMessages
      }
    });
  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' }, 
      { status: 500 }
    );
  }
}
