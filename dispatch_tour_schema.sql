-- ============================================================
--  DISPATCH — Persistance véhicule, date tournée, snapshots
--  Exécuter dans : Supabase → SQL Editor
-- ============================================================

-- ── Transports : véhicule + date planifiée ─────────────────
ALTER TABLE transport_orders_simple
    ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES vehicules(id) ON DELETE SET NULL;
ALTER TABLE transport_orders_simple
    ADD COLUMN IF NOT EXISTS tour_planned_date date;

CREATE INDEX IF NOT EXISTS idx_tos_vehicle_date
    ON transport_orders_simple(vehicle_id, tour_planned_date)
    WHERE tour_id IS NOT NULL;

-- ── Coût chauffeur / jour (optionnel, lu par dispatch) ─────
ALTER TABLE vehicules
    ADD COLUMN IF NOT EXISTS cout_chauffeur_jour numeric(10,2) DEFAULT 0;

-- ── Historique rentabilité tournées (au moment de « Sauver ») ─
CREATE TABLE IF NOT EXISTS dispatch_tour_snapshots (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id           text NOT NULL,
    tour_planned_date date NOT NULL,
    vehicle_id        uuid REFERENCES vehicules(id) ON DELETE SET NULL,
    driver_id         uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
    total_km          numeric(10,2),
    duration_text     text,
    revenue_chf       numeric(12,2) DEFAULT 0,
    cost_chf          numeric(12,2) DEFAULT 0,
    margin_chf        numeric(12,2) DEFAULT 0,
    margin_pct        numeric(8,2) DEFAULT 0,
    nb_stops          integer DEFAULT 0,
    created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dts_vehicle_date ON dispatch_tour_snapshots(vehicle_id, tour_planned_date);
CREATE INDEX IF NOT EXISTS idx_dts_tour ON dispatch_tour_snapshots(tour_id);
CREATE INDEX IF NOT EXISTS idx_dts_planned_date ON dispatch_tour_snapshots(tour_planned_date DESC);

ALTER TABLE dispatch_tour_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispatch_snapshots_admin" ON dispatch_tour_snapshots;
CREATE POLICY "dispatch_snapshots_admin" ON dispatch_tour_snapshots
    FOR ALL TO authenticated
    USING ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'))
    WITH CHECK ((SELECT role FROM utilisateurs WHERE id = auth.uid()) IN ('admin','super_admin'));
