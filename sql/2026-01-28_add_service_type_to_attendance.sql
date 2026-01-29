-- Add service_type column to attendance table for Sunday service vs Tuesday Bible study
-- This allows tracking attendance for both services separately

-- Add service_type column with default value
alter table attendance 
add column if not exists service_type text not null default 'sunday' 
check (service_type in ('sunday', 'bible-study'));

-- Drop old unique constraint
alter table attendance 
drop constraint if exists attendance_class_number_attendance_date_key;

-- Add new unique constraint that includes service_type
alter table attendance 
add constraint attendance_class_number_attendance_date_service_type_key 
unique (class_number, attendance_date, service_type);

-- Update comment
comment on column attendance.service_type is 'Type of service: sunday (Sunday service) or bible-study (Tuesday Bible study)';
