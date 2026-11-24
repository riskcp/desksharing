import { createClient } from "@supabase/supabase-js";

// Zugangsdaten des Supabase-Projekts der Risikoabteilung
// (Supabase → Project Settings → API: "Project URL" und "Publishable key").
const SUPABASE_URL = "https://wglzcgnjfrfuseqhoipo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C-UXOLvVow5hT1lBdaZgEA_zbPOMFL3";

export const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
