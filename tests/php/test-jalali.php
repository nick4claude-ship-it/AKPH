<?php
/** Jalali ↔ Gregorian conversion used for fiscal years (independent of WP-Parsidate). */
class Test_Akph_Jalali extends WP_UnitTestCase {
    public function test_known_dates() {
        $pairs = array(
            array('2026-03-21', 1405, 1, 1),
            array('2026-03-20', 1404, 12, 29),
            array('2025-03-20', 1403, 12, 30), // 1403 is a leap year
            array('2025-03-21', 1404, 1, 1),
            array('2024-03-20', 1403, 1, 1),
            array('2026-09-23', 1405, 7, 1),
            array('2026-09-22', 1405, 6, 31),
            array('2000-01-01', 1378, 10, 11),
        );
        foreach ($pairs as $p) {
            $this->assertSame(array($p[1], $p[2], $p[3]), Akph_Jalali::from_iso($p[0]), $p[0]);
            $this->assertSame($p[0], Akph_Jalali::to_iso($p[1], $p[2], $p[3]), implode('/', array_slice($p, 1)));
        }
    }

    public function test_round_trip_over_years() {
        $d = new DateTimeImmutable('2019-01-01');
        for ($i = 0; $i < 3000; $i += 7) {
            $iso = $d->modify("+{$i} days")->format('Y-m-d');
            list($y, $m, $day) = Akph_Jalali::from_iso($iso);
            $this->assertSame($iso, Akph_Jalali::to_iso($y, $m, $day));
        }
    }

    public function test_invalid_and_leap_rules() {
        $this->assertNull(Akph_Jalali::to_iso(1404, 12, 30), '1404 is not a leap year');
        $this->assertSame('2025-03-20', Akph_Jalali::to_iso(1403, 12, 30));
        $this->assertNull(Akph_Jalali::to_iso(1405, 7, 31));
        $this->assertSame('2026-03-21', Akph_Jalali::parse_jalali('۱۴۰۵/۰۱/۰۱'));
        $this->assertFalse(Akph_Jalali::valid_iso('2026-02-30'));
        $this->assertSame(1405, Akph_Jalali::fiscal_year('2026-09-25'));
    }
}
