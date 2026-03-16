-- Create functional indexes for accent-insensitive searches
-- These indexes optimize searches on nombre and apellido fields by storing unaccented versions

-- Composite index for name and surname searches (common pattern)
CREATE INDEX IF NOT EXISTS idx_socio_unaccent_nombre_apellido 
ON socio ((unaccent(nombre)), (unaccent(apellido)));

-- Note: The unaccent extension is already installed by the previous migration
-- These indexes are optional but highly recommended for performance
