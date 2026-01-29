-- Add unique constraint to member_attendance table
-- This ensures each member can only have one attendance record per attendance session

alter table member_attendance 
add constraint member_attendance_attendance_member_unique 
unique (attendance_id, member_id);
