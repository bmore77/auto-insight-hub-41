-- action_plans
drop policy if exists "Anyone can read action plans" on public.action_plans;
drop policy if exists "Anyone can create action plans" on public.action_plans;
drop policy if exists "Anyone can update action plans" on public.action_plans;
drop policy if exists "Anyone can delete action plans" on public.action_plans;

create policy "Authenticated users can read action plans"
  on public.action_plans for select to authenticated using (true);
create policy "Authenticated users can create action plans"
  on public.action_plans for insert to authenticated with check (true);
create policy "Authenticated users can update action plans"
  on public.action_plans for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete action plans"
  on public.action_plans for delete to authenticated using (true);

revoke all on public.action_plans from anon;
grant select, insert, update, delete on public.action_plans to authenticated;
grant all on public.action_plans to service_role;

-- snapshots
drop policy if exists "Anyone can read snapshots" on public.snapshots;
drop policy if exists "Anyone can create snapshots" on public.snapshots;
drop policy if exists "Anyone can update snapshots" on public.snapshots;
drop policy if exists "Anyone can delete snapshots" on public.snapshots;

create policy "Authenticated users can read snapshots"
  on public.snapshots for select to authenticated using (true);
create policy "Authenticated users can create snapshots"
  on public.snapshots for insert to authenticated with check (true);
create policy "Authenticated users can update snapshots"
  on public.snapshots for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete snapshots"
  on public.snapshots for delete to authenticated using (true);

revoke all on public.snapshots from anon;
grant select, insert, update, delete on public.snapshots to authenticated;
grant all on public.snapshots to service_role;

-- snapshot_metrics
drop policy if exists "Anyone can read snapshot metrics" on public.snapshot_metrics;
drop policy if exists "Anyone can create snapshot metrics" on public.snapshot_metrics;
drop policy if exists "Anyone can update snapshot metrics" on public.snapshot_metrics;
drop policy if exists "Anyone can delete snapshot metrics" on public.snapshot_metrics;

create policy "Authenticated users can read snapshot metrics"
  on public.snapshot_metrics for select to authenticated using (true);
create policy "Authenticated users can create snapshot metrics"
  on public.snapshot_metrics for insert to authenticated with check (true);
create policy "Authenticated users can update snapshot metrics"
  on public.snapshot_metrics for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete snapshot metrics"
  on public.snapshot_metrics for delete to authenticated using (true);

revoke all on public.snapshot_metrics from anon;
grant select, insert, update, delete on public.snapshot_metrics to authenticated;
grant all on public.snapshot_metrics to service_role;

-- storage: tableau screenshots (private bucket)
drop policy if exists "Anyone can read tableau screenshots" on storage.objects;
drop policy if exists "Anyone can upload tableau screenshots" on storage.objects;
drop policy if exists "Anyone can update tableau screenshots" on storage.objects;
drop policy if exists "Anyone can delete tableau screenshots" on storage.objects;

create policy "Authenticated users can read tableau screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'tableau-screenshots');
create policy "Authenticated users can upload tableau screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tableau-screenshots');
create policy "Authenticated users can update tableau screenshots"
  on storage.objects for update to authenticated
  using (bucket_id = 'tableau-screenshots')
  with check (bucket_id = 'tableau-screenshots');
create policy "Authenticated users can delete tableau screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tableau-screenshots');
