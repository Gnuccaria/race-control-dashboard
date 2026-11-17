-- Ruolo Discord dell'equipaggio (facoltativo, es. il ruolo "#16 Vez Team Lime"): chi ha questo ruolo appartiene
-- all'equipaggio per ticket e proteste del sito, qualunque sia il nome del ruolo. È l'ID del ruolo (17–20 cifre),
-- come normalizeDiscordRoleId in shared/crewRules.ts; un ruolo può appartenere a un solo equipaggio.
-- Senza ruolo collegato l'equipaggio si riconosce ancora dal nome del ruolo ("#N ...").
ALTER TABLE crews ADD COLUMN discord_role_id TEXT
  CHECK (discord_role_id IS NULL OR (length(discord_role_id) BETWEEN 17 AND 20 AND discord_role_id NOT GLOB '*[^0-9]*'));

CREATE UNIQUE INDEX crews_discord_role_id ON crews (discord_role_id) WHERE discord_role_id IS NOT NULL;
