create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(), read_at timestamptz,
  check (sender_id <> receiver_id)
);
create index if not exists friend_messages_conversation_idx on public.friend_messages (sender_id, receiver_id, created_at);
alter table public.friend_messages enable row level security;
revoke all on public.friend_messages from authenticated;
grant select on public.friend_messages to authenticated;
create policy "participants read friend messages" on public.friend_messages for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());

create or replace function public.send_friend_message(p_receiver uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare message_id uuid;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only message friends'; end if;
  insert into public.friend_messages(sender_id,receiver_id,body) values(auth.uid(),p_receiver,trim(p_body)) returning id into message_id;
  return message_id;
end $$;

create or replace function public.get_friend_messages(p_friend uuid) returns table(id uuid,sender_id uuid,receiver_id uuid,body text,created_at timestamptz,read_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_friend) then raise exception 'You can only view messages with friends'; end if;
  update public.friend_messages set read_at=now() where sender_id=p_friend and receiver_id=auth.uid() and read_at is null;
  return query select m.id,m.sender_id,m.receiver_id,m.body,m.created_at,m.read_at from public.friend_messages m where (m.sender_id=auth.uid() and m.receiver_id=p_friend) or (m.sender_id=p_friend and m.receiver_id=auth.uid()) order by m.created_at;
end $$;
grant execute on function public.send_friend_message(uuid,text),public.get_friend_messages(uuid) to authenticated;
do $$ begin alter publication supabase_realtime add table public.friend_messages; exception when duplicate_object then null; end $$;
