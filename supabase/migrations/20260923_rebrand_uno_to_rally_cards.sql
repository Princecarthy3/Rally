-- User-facing rebrand: UNO → Rally Cards / Rally
-- Internal game_type remains 'uno' for compatibility with existing rooms and RPCs.
-- Client UI also maps any remaining "UNO" messages to "Rally".

-- Soft-update live public_state messages that still say UNO
update public.game_rooms
set public_state = jsonb_set(
  public_state,
  '{message}',
  to_jsonb(
    replace(
      replace(coalesce(public_state->>'message', ''), 'UNO', 'Rally'),
      'uno',
      'Rally'
    )
  ),
  true
)
where game_type = 'uno'
  and public_state ? 'message'
  and (public_state->>'message') ilike '%uno%';
