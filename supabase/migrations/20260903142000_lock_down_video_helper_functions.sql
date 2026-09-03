revoke all on function public.gen_hub_profile_default_video() from public, anon, authenticated;
revoke all on function public.gen_hub_set_default_onboarding_video(text) from public, anon, authenticated;
grant execute on function public.gen_hub_set_default_onboarding_video(text) to authenticated;
