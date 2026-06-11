-- Rock RMS: Family count by campus and ZIP code
-- Run this query in Rock RMS SQL and export results as CSV.
-- Upload the CSV at /admin/attendee-upload.
-- Re-run monthly (or as needed) to keep attendee overlay current.
--
-- Output columns: Campus, PostalCodeLeft5, FamilyCount
-- Includes: active records with a US address on file

SELECT COALESCE(a.Campus, 'Unknown') AS Campus
     , LEFT(Postalcode, 5) AS PostalCodeLeft5
     , COUNT(DISTINCT p.PrimaryFamilyId) AS FamilyCount
FROM dbo._org_lakepointe_SmartMetrix_ActiveWithAddress a
JOIN person p ON a.PersonId = p.id
WHERE PostalCode <> ''
  AND a.Country = 'US'
GROUP BY a.Campus, LEFT(Postalcode, 5)
ORDER BY campus, LEFT(Postalcode, 5)
