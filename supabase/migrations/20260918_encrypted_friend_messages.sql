-- The service stores delivery envelopes only: message contents are AES-GCM ciphertext.
create table if not exists public.friend_message_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_key text not null,
  updated_at timestamptz not null default now()
);
alter table public.friend_message_keys enable row level security;
revoke all on public.friend_message_keys from authenticated;
grant select, insert, update on public.friend_message_keys to authenticated;
drop policy if exists "friends read message keys" on public.friend_message_keys;
create policy "friends read message keys" on public.friend_message_keys for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=friend_message_keys.user_id)
);
drop policy if exists "users publish own message key" on public.friend_message_keys;
create policy "users publish own message key" on public.friend_message_keys for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users rotate own message key" on public.friend_message_keys;
create policy "users rotate own message key" on public.friend_message_keys for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

alter table public.friend_messages add column if not exists ciphertext text;
alter table public.friend_messages add column if not exists iv text;
alter table public.friend_messages add column if not exists delivered_at timestamptz;
alter table public.friend_messages add column if not exists deleted_by_sender_at timestamptz;
alter table public.friend_messages add column if not exists deleted_by_receiver_at timestamptz;
-- Existing plaintext rows cannot be migrated into an end-to-end encrypted format.
-- Remove them rather than copying plaintext into an envelope that was never encrypted.
delete from public.friend_messages where ciphertext is null;
alter table public.friend_messages alter column ciphertext set not null;
alter table public.friend_messages alter column iv set not null;
alter table public.friend_messages drop column if exists body;
drop function if exists public.send_friend_message(uuid,text);
drop function if exists public.get_friend_messages(uuid);

create or replace function public.send_encrypted_friend_message(p_receiver uuid,p_ciphertext text,p_iv text) returns uuid
language plpgsql security definer set search_path='' as $$
declare message_id uuid;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only message friends'; end if;
  if char_length(p_ciphertext)>10000 or char_length(p_iv)>100 then raise exception 'Invalid encrypted message'; end if;
  insert into public.friend_messages(sender_id,receiver_id,ciphertext,iv) values(auth.uid(),p_receiver,p_ciphertext,p_iv) returning id into message_id;
  return message_id;
end $$;

create or replace function public.get_encrypted_friend_messages(p_friend uuid) returns table(id uuid,sender_id uuid,receiver_id uuid,ciphertext text,iv text,created_at timestamptz,delivered_at timestamptz,read_at timestamptz,deleted_by_sender_at timestamptz,deleted_by_receiver_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_friend) then raise exception 'You can only view messages with friends'; end if;
  return query select m.id,m.sender_id,m.receiver_id,m.ciphertext,m.iv,m.created_at,m.delivered_at,m.read_at,m.deleted_by_sender_at,m.deleted_by_receiver_at from public.friend_messages m where ((m.sender_id=auth.uid() and m.receiver_id=p_friend and m.deleted_by_sender_at is null) or (m.sender_id=p_friend and m.receiver_id=auth.uid() and m.deleted_by_receiver_at is null) or (m.deleted_by_sender_at is not null and m.deleted_by_receiver_at is not null)) order by m.created_at;
end $$;

create or replace function public.mark_friend_messages_read(p_friend uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_friend) then raise exception 'You can only read messages with friends'; end if;
  update public.friend_messages as fm
  set delivered_at=coalesce(fm.delivered_at,now()),read_at=coalesce(fm.read_at,now())
  where fm.sender_id=p_friend and fm.receiver_id=auth.uid() and fm.deleted_by_receiver_at is null;
end $$;

create or replace function public.delete_encrypted_friend_message(p_message uuid,p_everyone boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare message_row public.friend_messages;
begin
  select * into message_row from public.friend_messages where id=p_message for update;
  if message_row.id is null or auth.uid() not in (message_row.sender_id,message_row.receiver_id) then raise exception 'Message not found'; end if;
  if p_everyone then
    if message_row.sender_id<>auth.uid() then raise exception 'Only the sender can delete for everyone'; end if;
    update public.friend_messages set deleted_by_sender_at=now(),deleted_by_receiver_at=now(),ciphertext='',iv='' where id=p_message;
  elsif message_row.sender_id=auth.uid() then update public.friend_messages set deleted_by_sender_at=now() where id=p_message;
  else update public.friend_messages set deleted_by_receiver_at=now() where id=p_message;
  end if;
end $$;
grant execute on function public.send_encrypted_friend_message(uuid,text,text),public.get_encrypted_friend_messages(uuid),public.mark_friend_messages_read(uuid),public.delete_encrypted_friend_message(uuid,boolean) to authenticated;

create or replace function public.get_unread_friend_message_counts()
returns table(friend_id uuid, unread_count bigint)
language sql
security definer
set search_path=''
as $$
  select sender_id, count(*)::bigint
  from public.friend_messages
  where receiver_id=auth.uid()
    and read_at is null
    and deleted_by_receiver_at is null
  group by sender_id;
$$;

grant execute on function public.get_unread_friend_message_counts() to authenticated;
