cd ..

PGPASSWORD="password" psql -h 10.10.10.2 -p 5432 -U postgres -d logcore -t -c "
SELECT
  (SELECT COUNT(*) FROM boiler)     AS total_boiler,
  (SELECT COUNT(*) FROM logistics)  AS total_logistics,
  (SELECT COUNT(*) FROM greenhouse) AS total_greenhouse;
"
