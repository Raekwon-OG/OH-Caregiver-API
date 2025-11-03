#!/usr/bin/env ts-node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env automatically so the script can be run without manual exports
dotenv.config();

const url = process.env.SUPABASE_URL;
// Prefer publishable key for client-like signup/login flows. Fallback to anon or service role if publishable missing.
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Please set SUPABASE_URL and one of SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in env or .env file');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function signup(email: string, password: string) {
  const res = await supabase.auth.signUp({ email, password });
  // concise error handling
  if ((res as any)?.error) {
    console.error('Signup failed:', (res as any).error.message || (res as any).error);
    return null;
  }

  // Log full response at debug level when DEBUG env var set
  if (process.env.DEBUG) console.log('signup response', JSON.stringify(res, null, 2));

  // if session available, return access token
  const token = (res as any)?.data?.session?.access_token || (res as any)?.data?.access_token;
  return token || null;
}

async function login(email: string, password: string) {
  const res = await supabase.auth.signInWithPassword({ email, password });
  if ((res as any)?.error) {
    console.error('Login failed:', (res as any).error.message || (res as any).error);
    return null;
  }

  if (process.env.DEBUG) console.log('login response', JSON.stringify(res, null, 2));
  return (res as any)?.data?.session?.access_token || null;
}

async function main() {
  const cmd = process.argv[2];
  const email = process.argv[3] || `test+${Date.now()}@example.com`;
  const password = process.argv[4] || 'Password123!';

  if (cmd === 'signup') {
    const token = await signup(email, password);
    if (!token) process.exit(1);
    if (process.argv.includes('--token-only') || process.argv.includes('-t')) {
      console.log(token);
    } else {
      console.log('accessToken:', token);
    }
    return;
  }

  if (cmd === 'login') {
    const token = await login(email, password);
    if (!token) process.exit(1);
    if (process.argv.includes('--token-only') || process.argv.includes('-t')) {
      console.log(token);
    } else {
      console.log('accessToken:', token);
    }
    return;
  }

  console.log('Usage: ts-node scripts/supabase-client.ts <signup|login> [email] [password]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
