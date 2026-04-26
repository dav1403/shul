-- ============================================================
-- shul.fr — Données de seed pour développement
-- Synagogue Beth El (slug: bethel) → accessible sur /bethel
-- ============================================================

INSERT INTO synagogues (
  slug, name, address, city, postal_code, country,
  phone, email, rabbi_word,
  social_facebook, social_instagram,
  hebcal_geoname_id
) VALUES (
  'bethel',
  'Synagogue Beth El',
  '18 rue des Rosiers',
  'Paris',
  '75004',
  'FR',
  '+33142786060',
  'contact@synagogue-bethel.fr',
  'Chabbat chalom à toute la communauté ! Les offices de ce Chabbat auront lieu comme d''habitude. N''oubliez pas le kidouch communautaire samedi matin après l''office.',
  'https://facebook.com/synagogue.bethel',
  'https://instagram.com/synagogue_bethel',
  2988507  -- Paris geoname ID pour Hebcal
);

-- Numéro admin de la synagogue
INSERT INTO authorized_phones (synagogue_id, phone, role)
SELECT id, '+33612345678', 'admin'
FROM synagogues WHERE slug = 'bethel';

-- Horaires d'offices
INSERT INTO custom_schedules (synagogue_id, service_type, day_of_week, time)
SELECT id, 'shabbat_evening', 5, '19:30'
FROM synagogues WHERE slug = 'bethel';

INSERT INTO custom_schedules (synagogue_id, service_type, day_of_week, time)
SELECT id, 'shabbat_morning', 6, '09:00'
FROM synagogues WHERE slug = 'bethel';

INSERT INTO custom_schedules (synagogue_id, service_type, day_of_week, time)
SELECT id, 'shabbat_mincha', 6, '17:30'
FROM synagogues WHERE slug = 'bethel';

INSERT INTO custom_schedules (synagogue_id, service_type, day_of_week, time)
SELECT id, 'weekday_shaharit', NULL, '07:30'
FROM synagogues WHERE slug = 'bethel';

INSERT INTO custom_schedules (synagogue_id, service_type, day_of_week, time)
SELECT id, 'weekday_mincha', NULL, '19:00'
FROM synagogues WHERE slug = 'bethel';
