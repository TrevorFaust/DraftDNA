-- DELETE realtime events only include PK columns with default replica identity,
-- so filtered subscriptions on draft_id never fire for kicks. FULL includes draft_id.

ALTER TABLE public.multiplayer_draft_participants
  REPLICA IDENTITY FULL;
