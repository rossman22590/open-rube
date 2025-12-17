import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { getComposio } from '../../../utils/composio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolkitSlug, scheme, credentials } = body || {};

    if (!toolkitSlug || !scheme || !credentials) {
      return NextResponse.json({ error: 'toolkitSlug, scheme, and credentials are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized - Please sign in' }, { status: 401 });
    }

    const composio = getComposio();

    // Find an authConfig for this toolkit; for credential schemes Composio often exposes an auth config too.
    const authConfigs = await composio.authConfigs.list({ toolkit: toolkitSlug });
    const authConfigId = authConfigs?.items?.[0]?.id;
    if (!authConfigId) {
      return NextResponse.json({ error: 'No authConfig found for toolkit; ask an admin to enable it.' }, { status: 400 });
    }

    // Normalize credential field names to common Composio expectations
    let normalized: Record<string, string> = {};
    const lower = Object.fromEntries(Object.entries(credentials || {}).map(([k, v]) => [k.toLowerCase(), v]));
    if (scheme === 'API_KEY') {
      normalized = { api_key: (lower.api_key as string) || (lower.apikey as string) || (lower['api key'] as string) || (credentials.apiKey as string) };
    } else if (scheme === 'BEARER_TOKEN') {
      normalized = { bearer_token: (lower.bearer_token as string) || (lower.token as string) || (credentials.token as string) };
    } else if (scheme === 'BASIC') {
      normalized = { username: (credentials.username as string) || (lower.username as string), password: (credentials.password as string) || (lower.password as string) };
    } else {
      normalized = credentials;
    }

    // Attempt credential-based link using the same link API with credentials payload (supported by Composio for non-OAuth schemes).
    const linkOptions: { callbackUrl?: string } & Record<string, unknown> = { credentials: normalized };
    const res = await composio.connectedAccounts.link(user.email, authConfigId, linkOptions);

    return NextResponse.json({ success: true, result: res });
  } catch (error) {
    console.error('Error creating credentials connection:', error);
    return NextResponse.json({ error: 'Failed to connect with credentials' }, { status: 500 });
  }
}
