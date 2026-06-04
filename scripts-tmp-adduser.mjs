import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.auth.admin.createUser({
  email: 'a@a.com',
  password: 'a@a.com',
  email_confirm: true,
});
if (error) { console.error(error); process.exit(1); }
const uid = data.user.id;
console.log('Created', uid);
const { error: e2 } = await sb.from('profiles').update({ approval_status: 'approved' }).eq('id', uid);
if (e2) console.error('profile', e2);
const { error: e3 } = await sb.from('signup_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('user_id', uid);
if (e3) console.error('signup', e3);
console.log('done');
