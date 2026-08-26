-- Fahrtkosten werden als Pauschale abgerechnet, nicht nach Zeit.
--
-- Die Fahrtzeit in Stunden entfällt ersatzlos. Umrechnen lässt sie sich nicht:
-- Aus einer Dauer wird ohne Stundensatz kein Betrag, und ein Stundensatz für
-- die Anfahrt ist genau das, was hier nicht mehr gerechnet werden soll.
-- Bestehende Werte gehen deshalb verloren – bewusst, statt eine Zahl zu
-- erfinden, die niemand nachvollziehen kann.
ALTER TABLE "service_reports" DROP COLUMN "travelHours";

ALTER TABLE "service_reports"
  ADD COLUMN "travelFlatRate" DECIMAL(10,2) NOT NULL DEFAULT 0;
