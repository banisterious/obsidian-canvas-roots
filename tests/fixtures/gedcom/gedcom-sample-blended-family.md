# GEDCOM Blended Family Test File

This test file (`gedcom-sample-blended-family.ged`) contains step-parent and adoptive parent relationships to verify PEDI tag parsing in Charted Roots GEDCOM import.

## Test Scenarios

### Scenario 1: Divorce with Remarriage (Both Parents)

**Individuals:** John Smith (I1), Mary Jones (I2), Robert Williams (I3), Sarah Brown (I4)

**Children:** Emily Smith (I5), Michael Smith (I6)

**Situation:**
- John and Mary were married (F1) and had Emily and Michael
- They divorced in 2008
- Mary remarried Robert Williams (F2)
- John remarried Sarah Brown (F3)
- Emily and Michael now have:
  - Biological parents: John (father), Mary (mother)
  - Stepfather: Robert Williams
  - Stepmother: Sarah Brown

**Expected Import Result for Emily (I5):**
```yaml
father_id: [John's cr_id]
mother_id: [Mary's cr_id]
stepfather_id: [Robert's cr_id]
stepmother_id: [Sarah's cr_id]
```

### Scenario 2: Adopted Child in Blended Family

**Individual:** James Chen (I9)

**Situation:**
- James was adopted by John and Sarah (F3)
- He has no biological parents in the GEDCOM

**Expected Import Result for James (I9):**
```yaml
adoptive_father_id: [John's cr_id]
adoptive_mother_id: [Sarah's cr_id]
# father_id and mother_id should NOT be set
```

### Scenario 3: Stepmother After Parent Death

**Individuals:** Thomas Anderson (I10), Patricia Davis (I11, deceased), Linda Miller (I12)

**Children:** William Anderson (I13), Grace Anderson (I14)

**Situation:**
- Thomas was married to Patricia (F4), who died in 2010
- Thomas remarried Linda (F5) in 2012
- William and Grace have:
  - Biological parents: Thomas and Patricia
  - Stepmother: Linda

**Expected Import Result for William (I13):**
```yaml
father_id: [Thomas's cr_id]
mother_id: [Patricia's cr_id]
stepmother_id: [Linda's cr_id]
# stepfather_id should NOT be set (Linda is female)
```

### Scenario 4: Family with Only Adopted Children

**Individuals:** George Taylor (I16), Elizabeth Taylor (I17)

**Children:** Sophia Nguyen (I18), Alexander Kim (I19)

**Situation:**
- George and Elizabeth (F6) have two adopted children
- Neither child has biological parents in the file

**Expected Import Result for Sophia (I18):**
```yaml
adoptive_father_id: [George's cr_id]
adoptive_mother_id: [Elizabeth's cr_id]
# father_id and mother_id should NOT be set
```

### Scenario 5: PEDI Tag Variations

**Individual:** Alexander Kim (I19)

**Situation:**
- Uses `PEDI adopted` (full word) instead of `PEDI adop`
- Tests that the parser normalizes PEDI tag variations

**Expected:** Same as Sophia - adoptive parents correctly identified

### Scenario 6: Multiple Step-parents (Mother Remarried Multiple Times)

**Individuals:** Richard Moore (I20), Jennifer White (I21), Carol Johnson (I22)

**Children:** Daniel Moore (I23), Rachel Moore (I24)

**Situation:**
- Richard was married to Jennifer (F7), had Daniel and Rachel
- They divorced
- Richard remarried Carol (F8)
- Daniel and Rachel have:
  - Biological parents: Richard and Jennifer
  - Stepmother: Carol (only one stepmother in this case)

**Expected Import Result for Daniel (I23):**
```yaml
father_id: [Richard's cr_id]
mother_id: [Jennifer's cr_id]
stepmother_id: [Carol's cr_id]
```

## PEDI Tag Values Used

| Value | Meaning | Location in File |
|-------|---------|------------------|
| `birth` | Biological child | I5, I6, I7, I8, I13, I14, I15, I23, I24, I25 |
| `step` | Step-child | I5, I6, I13, I14, I23, I24 |
| `adop` | Adopted child | I9 |
| `adopted` | Adopted (full word variant) | I19 |

## Validation Checklist

After importing this file, verify:

1. [ ] Emily Smith has `father_id`, `mother_id`, `stepfather_id`, and `stepmother_id` all set
2. [ ] James Chen has `adoptive_father_id` and `adoptive_mother_id` but NOT `father_id` or `mother_id`
3. [ ] No "conflicting parent claims" are flagged for step-parents
4. [ ] Sophia and Alexander are correctly identified as adopted
5. [ ] PEDI tag variations (`adop` vs `adopted`) are both handled
6. [ ] Biological children (David, Lily, Hannah, Olivia) have only biological parent fields set

## File Statistics

- **25 Individuals**
- **8 Families**
- **6 step-child relationships**
- **3 adoptive relationships**
- **2 divorces**
