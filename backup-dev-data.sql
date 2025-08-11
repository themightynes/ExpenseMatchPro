-- Development Database Backup Export
-- Generated: August 11, 2025

-- Users data
INSERT INTO users (id, email, name, google_id, profile_picture, is_authorized, created_at, last_login_at) VALUES 
('64b056e1-a621-4155-a536-af4bf91615e6', 'ernesto.chapa@gmail.com', 'Ernesto Chapa', '110352993974558576159', 'https://lh3.googleusercontent.com/a/ACg8ocKOwAbayoda7k5woR_MaRtsi3I4SzHjoasZIbg9sSqFDalTCXKi=s96-c', true, '2025-08-10 18:13:23.733163', '2025-08-11 05:43:36.163');

-- AMEX Statements data
INSERT INTO amex_statements (id, period_name, start_date, end_date, is_active, created_at, user_notes) VALUES 
('9a3877be-a436-471f-8933-bcbda952a76d', '2025 - APR Statement', '2025-03-05 00:00:00', '2025-04-01 00:00:00', false, '2025-08-09 05:32:28.79402', null),
('a16e254f-8e35-4f44-be2d-1ee505c86490', '2025 - JUN Statement', '2025-05-06 00:00:00', '2025-05-28 00:00:00', false, '2025-08-09 05:32:48.317677', null),
('461295e2-c91e-4b20-b13d-1dbeb0a6914e', '2025 - JUL Statement', '2025-06-08 00:00:00', '2025-06-26 00:00:00', false, '2025-08-09 05:32:57.371666', null),
('0b9cd871-7e5f-42dc-93a0-e09e8c9b9929', '2025 - May Statement', '2025-04-03 00:00:00', '2025-04-30 00:00:00', false, '2025-08-09 05:15:12.923651', null),
('c2c54c3d-a3f5-4577-9b33-cb47da99f063', '2025 - AUG Statement', '2025-07-04 00:00:00', '2025-07-23 00:00:00', true, '2025-08-09 06:08:53.247629', null);

-- Note: Receipts and AMEX charges data will be exported separately due to volume