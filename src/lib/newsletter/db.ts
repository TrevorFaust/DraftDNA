import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Newsletter tables are not in the generated Database types. */
export const newsletterDb = supabase as unknown as SupabaseClient;
