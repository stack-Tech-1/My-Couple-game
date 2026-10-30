-- Fix Am: a link for each photo's credit (the photo's source page, where free licences ask
-- for one). Additive: existing pictures keep working without it.
alter table public.fixam_pictures
  add column if not exists credit_url text check (credit_url is null or (char_length(credit_url) <= 300 and credit_url ~ '^https://'));
