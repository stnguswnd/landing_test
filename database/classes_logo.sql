alter table classes
  add column if not exists logo_url text,
  add column if not exists logo_storage_path text,
  add column if not exists logo_file_name text;
