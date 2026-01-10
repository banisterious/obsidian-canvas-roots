# GEDCOM Edge Cases Test File

This document describes the intentional data quality issues in `gedcom-sample-medium-edge-cases.ged` for testing Charted Roots data quality detection and handling.

## Test Categories

### 1. Duplicate Names Without Distinguishing Data

| ID | Name | Issue |
|----|------|-------|
| @I1@ | John Smith | No dates - identical to @I2@ |
| @I2@ | John Smith | No dates - identical to @I1@ |
| @I3@ | John Smith | Has dates - can be distinguished |

**Expected behavior:** Plugin should flag @I1@ and @I2@ as potential duplicates, but recognize @I3@ as distinct due to dates.

---

### 2. Multiple Parents Claiming Same Child

| Child | Family 1 | Family 2 |
|-------|----------|----------|
| @I10@ Disputed Child | @F10@ (Father One + Mother One) | @F11@ (Father Two + Mother Two) |

**Expected behavior:** Plugin should detect the conflict where one child has FAMC pointing to two different families.

---

### 3. Impossible/Problematic Dates

| ID | Name | Issue |
|----|------|-------|
| @I20@ | Death BeforeBirth | Death 1990, Birth 2000 |
| @I21@ | Young Parent | Born 1990, child born 1980 |
| @I22@ | Older Child | Born 1980, parent born 1990 |
| @I23@ | Very Old | Born 1750, no death date |
| @I24@ | Future Person | Born 2030 |
| @I25@ | Married BeforeBirth | Born 2000, married 1990 |

---

### 4. Sex/Gender Conflicts

| ID | Name | SEX | Role in Family |
|----|------|-----|----------------|
| @I30@ | Listed AsHusband | F | HUSB in @F30@ |
| @I31@ | Listed AsWife | M | WIFE in @F30@ |

**Expected behavior:** Plugin should flag the mismatch between SEX field and family role.

---

### 5. Circular Relationships

| ID | Name | Issue |
|----|------|-------|
| @I40@ | Circular Ancestor | Is own grandparent (via @F40@ and @F41@) |
| @I41@ | Middle Generation | Creates the loop |

**Expected behavior:** Plugin should detect circular ancestry and prevent infinite loops.

---

### 6. Orphan References

| ID | Name | Issue |
|----|------|-------|
| @I50@ | Orphan Reference | FAMC @F999@ - family doesn't exist |
| @I51@ | Source Missing | SOUR @S999@ - source doesn't exist |

**Expected behavior:** Plugin should report broken references.

---

### 7. Special Characters and Long Names

| ID | Name | Test Case |
|----|------|-----------|
| @I60@ | Seán O'Brien-McDonald | Irish fada, apostrophe, hyphen |
| @I61@ | José María García de la Cruz y Fernández | Spanish accents, compound surname |
| @I62@ | 王明 Wang | Chinese characters |
| @I63@ | VeryLong... | Extremely long name (100+ chars) |
| @I64@ | // | Empty name |
| @I65@ | (none) | No NAME tag at all |

---

### 8. Date Format Variations

| ID | Name | Date Format |
|----|------|-------------|
| @I70@ | Approximate Dates | ABT 1850, ABT 1920 |
| @I71@ | Before After | BEF 1860, AFT 1930 |
| @I72@ | Range Dates | FROM 1870 TO 1875, BET 1940 AND 1945 |
| @I73@ | Questionable Dates | 1850?, 1920? |
| @I74@ | Calculated Date | CAL 1855 |
| @I75@ | Estimated Date | EST 1860 |
| @I76@ | Invalid DateFormat | "not-a-valid-date" |
| @I77@ | Another InvalidDate | 99/99/9999 |
| @I78@ | Partial YearOnly | 1900 (year only) |
| @I79@ | Partial MonthYear | MAR 1905 (month-year) |

**Expected behavior:** Plugin should parse standard GEDCOM date modifiers (ABT, BEF, AFT, etc.) and handle invalid formats gracefully.

---

### 9. Remarriage Scenarios

| Person | Marriages |
|--------|-----------|
| @I80@ Serial Marrier | 3 marriages (@F80@, @F81@, @F82@) |
| @I84@ Same DayMarriages | 2 marriages on same date - @F83@ and @F84@ |

**Expected behavior:** Multiple legitimate marriages should be handled. Same-day marriages should be flagged as suspicious.

---

### 10. Place Name Issues

| ID | Name | Place Issue |
|----|------|-------------|
| @I90@ | Place Variations | Birth: "New York, NY, USA" vs Death: "New York, New York, United States of America" |
| @I91@ | Typo Places | "Chicgo" and "Chciago" (typos) |
| @I92@ | Long PlaceName | Extremely long place name |
| @I93@ | Special PlaceChars | "St. Louis" and "Côte d'Ivoire" |
| @I94@ | Unknown Location | PLAC is "Unknown" |
| @I95@ | No Place | Birth event has no PLAC tag |
| @I96@ | Historical Place | Königsberg → Kaliningrad (same place, different names) |

---

### 11. Source Issues

| ID | Title | Issue |
|----|-------|-------|
| @S1@ | Smith Family Bible | Original |
| @S3@ | Smith Family Bible | Duplicate of @S1@ |
| @S4@ | (none) | No title, only NOTE |
| @S5@ | (empty) | Empty TITL tag |
| @S999@ | (referenced) | Doesn't exist but is referenced |

---

### 12. Family Issues

| ID | Issue |
|----|-------|
| @F2@ | Child but no parents |
| @F50@ | Empty family (no members) |
| @F51@ | References non-existent persons |
| @F52@ | Two HUSB records |
| @F53@ | Two WIFE records |

---

## Using This File

1. Import `gedcom-sample-medium-edge-cases.ged` into your test vault
2. Run the Data Quality analysis
3. Verify each issue category is detected
4. Test the fix/resolution workflows

## Adding New Test Cases

When adding new edge cases:
1. Use sequential ID numbers in the appropriate range
2. Add a NOTE field explaining the issue
3. Update this documentation file
4. Consider adding both the problematic case AND a "correct" version for comparison
