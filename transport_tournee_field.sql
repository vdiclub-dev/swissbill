-- Lier un transport à une tournée
ALTER TABLE transport_orders_simple
  ADD COLUMN IF NOT EXISTS tournee_id UUID REFERENCES tournees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tournee_position INTEGER DEFAULT 0;

-- RLS si pas encore fait
ALTER TABLE transport_orders_simple ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acces_total_transports" ON transport_orders_simple;
CREATE POLICY "acces_total_transports"
  ON transport_orders_simple FOR ALL USING (true) WITH CHECK (true);
