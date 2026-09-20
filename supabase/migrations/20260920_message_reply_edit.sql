-- Optional reply metadata + edit support for friend DMs
alter table public.friend_messages
  add column if not exists reply_to_id uuid references public.friend_messages(id) on delete set null;

alter table public.friend_messages
  add column if not exists edited_at timestamptz;

create or replace function public.edit_encrypted_friend_message(
  p_message uuid,
  p_ciphertext text,
  p_iv text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.friend_messages
     set ciphertext = p_ciphertext,
         iv = p_iv,
         edited_at = now()
   where id = p_message
     and sender_id = auth.uid()
     and deleted_by_sender_at is null;
  if not found then
    raise exception 'Message not found or not editable';
  end if;
end;
$$;

grant execute on function public.edit_encrypted_friend_message(uuid, text, text) to authenticated;
