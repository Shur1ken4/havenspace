-- Landing page: "Book a demo" or "Join the waiting list".
alter table pilot_signups add column interest text not null default 'waitlist' check (interest in ('demo','waitlist'));
alter table pilot_signups add column name text not null default '';
alter table pilot_signups add column practice_size text check (practice_size in ('solo','small_team','organisation','student'));
alter table pilot_signups add column language text not null default 'en';
create unique index pilot_signups_email_interest on pilot_signups (lower(email), interest);
