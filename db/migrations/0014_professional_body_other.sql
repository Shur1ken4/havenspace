-- Sign-up: the name of a professional organisation that isn't in our list ("Other").
alter table therapists add column professional_body_other text check (char_length(professional_body_other) <= 120);
