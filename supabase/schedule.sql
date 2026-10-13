create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('leave2027-reminders','0 4 * * *', $job$
 select net.http_post(
   url := 'https://wgkifqdgdvwfyvbzwytv.supabase.co/functions/v1/leave-api',
   headers := '{"Content-Type":"application/json"}'::jsonb,
   body := jsonb_build_object('action','cron','key',
      (select value#>>'{}' from public.leave2027_settings where key='cron_key')),
   timeout_milliseconds := 15000
 );
$job$);
select cron.schedule('leave2027-delivery','*/15 * * * *', $job$
 select net.http_post(
   url := 'https://wgkifqdgdvwfyvbzwytv.supabase.co/functions/v1/leave-api',
   headers := '{"Content-Type":"application/json"}'::jsonb,
   body := jsonb_build_object('action','flush','key',
      (select value#>>'{}' from public.leave2027_settings where key='cron_key')),
   timeout_milliseconds := 15000
 );
$job$);
