-- Enable the unaccent extension for accent-insensitive searches
-- This extension removes diacritics from characters, allowing searches like "albónico" to match "Albónico"
CREATE EXTENSION IF NOT EXISTS unaccent;
