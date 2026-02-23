-- Fix reminders table schema for Supabase
-- Run this in Supabase Dashboard: SQL Editor
-- 
-- This ensures the reminders table has the correct columns:
-- id, user_id, title, description, reminder_date, created_at

-- Step 1: Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reminder_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: If your table has 'name' but not 'title', rename it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.reminders RENAME COLUMN name TO title;
  END IF;
END $$;

-- Option B: If 'title' column doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.reminders ADD COLUMN title VARCHAR(255);
    -- Copy from 'name' if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'name'
    ) THEN
      UPDATE public.reminders SET title = name WHERE title IS NULL;
      ALTER TABLE public.reminders DROP COLUMN name;
    END IF;
    ALTER TABLE public.reminders ALTER COLUMN title SET NOT NULL;
  END IF;
END $$;

-- Step 3: Ensure reminder_date column exists (rename common alternatives or add new)
DO $$
BEGIN
  -- If reminder_date doesn't exist, rename from common alternatives or add
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'reminder_date'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'date') THEN
      ALTER TABLE public.reminders RENAME COLUMN date TO reminder_date;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'reminder_time') THEN
      ALTER TABLE public.reminders RENAME COLUMN reminder_time TO reminder_date;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'scheduled_at') THEN
      ALTER TABLE public.reminders RENAME COLUMN scheduled_at TO reminder_date;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'reminder_datetime') THEN
      ALTER TABLE public.reminders RENAME COLUMN reminder_datetime TO reminder_date;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'datetime') THEN
      ALTER TABLE public.reminders RENAME COLUMN datetime TO reminder_date;
    ELSE
      ALTER TABLE public.reminders ADD COLUMN reminder_date TIMESTAMPTZ DEFAULT now();
      ALTER TABLE public.reminders ALTER COLUMN reminder_date SET NOT NULL;
    END IF;
  END IF;
END $$;
