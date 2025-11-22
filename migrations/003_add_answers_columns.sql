-- Migration: Add correct and code columns to answers table
-- Run this for all themes (HENG36, MAX56, JEED24)

-- Add correct column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'answers' 
    AND column_name = 'correct'
  ) THEN
    ALTER TABLE answers ADD COLUMN correct BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add code column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'answers' 
    AND column_name = 'code'
  ) THEN
    ALTER TABLE answers ADD COLUMN code VARCHAR(255);
  END IF;
END $$;

-- Create index on correct column for faster queries
CREATE INDEX IF NOT EXISTS idx_answers_correct ON answers(correct);
CREATE INDEX IF NOT EXISTS idx_answers_code ON answers(code) WHERE code IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added correct and code columns to answers table!';
END $$;

