ALTER TABLE meter_readings
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS cropped_photo_url TEXT;
