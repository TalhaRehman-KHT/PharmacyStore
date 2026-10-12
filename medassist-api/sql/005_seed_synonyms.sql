-- 005_seed_synonyms.sql
-- Starter brand mapping. Check every row against YOUR products table and add your own.
-- us_name = the name used on US FDA labels (what openFDA understands).
-- Safe to run more than once (on conflict do nothing).

insert into public.drug_synonyms (brand_name, generic_name, us_name) values
  ('Panadol',    'paracetamol',              'acetaminophen'),
  ('Calpol',     'paracetamol',              'acetaminophen'),
  ('Brufen',     'ibuprofen',                'ibuprofen'),
  ('Augmentin',  'amoxicillin + clavulanate', 'amoxicillin and clavulanate potassium'),
  ('Amoxil',     'amoxicillin',              'amoxicillin'),
  ('Glucophage', 'metformin',                'metformin hydrochloride'),
  ('Zyrtec',     'cetirizine',               'cetirizine hydrochloride'),
  ('Risek',      'omeprazole',               'omeprazole'),
  ('Nexum',      'esomeprazole',             'esomeprazole magnesium'),
  ('Flagyl',     'metronidazole',            'metronidazole'),
  ('Ponstan',    'mefenamic acid',           'mefenamic acid'),
  ('Disprin',    'aspirin',                  'aspirin'),
  ('Ventolin',   'salbutamol',               'albuterol'),
  ('Ciproxin',   'ciprofloxacin',            'ciprofloxacin'),
  ('Klaricid',   'clarithromycin',           'clarithromycin'),
  ('Caflam',     'diclofenac potassium',     'diclofenac potassium'),
  ('Softin',     'loratadine',               'loratadine')
on conflict (brand_name, generic_name) do nothing;
