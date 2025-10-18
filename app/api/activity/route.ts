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

    // Fetch all messages with conversation info for the user
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        role,
        created_at,
        conversation_id,
        conversations (
          id,
          title
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (messagesError) {
      console.error('Error fetching activity logs:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch activity logs' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ activities: messages || [] });
  } catch (error) {
    console.error('Error in activity endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' }, 
      { status: 500 }
    );
  }
}
