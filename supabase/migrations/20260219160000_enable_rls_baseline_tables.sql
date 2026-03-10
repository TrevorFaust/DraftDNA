-- Enable RLS on baseline tables so they are not unrestricted.
-- Future reference: when creating new tables, add at the end of the migration:
--
--   ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "Allow public read access" ON your_table_name FOR SELECT USING (true);
--
-- Allows public read access; INSERT/UPDATE/DELETE restricted (use service role for migrations).

-- baseline_community_rankings
ALTER TABLE public.baseline_community_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON public.baseline_community_rankings FOR SELECT
USING (true);

-- baseline_rookies
ALTER TABLE public.baseline_rookies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON public.baseline_rookies FOR SELECT
USING (true);
