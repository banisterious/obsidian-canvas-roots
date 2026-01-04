# Remarriage Test Scenarios

## File: gedcom-sample-small-remarriage.ged

This GEDCOM file contains **31 people** with multiple realistic remarriage scenarios for testing enhanced spouse metadata functionality.

## Test Scenarios Included

### 1. James Anderson (I1) - Divorce and Remarriage
- **First Marriage:** Linda Martinez (F1)
  - Married: 1984-06-12
  - Divorced: 1992-03-15
  - Children: David, Sarah (from first marriage)

- **Second Marriage:** Karen Williams (F15)
  - Married: 1995-09-22
  - Status: Current
  - Children: Michael (from second marriage)

### 2. Robert Anderson (I14) - Widowed and Remarriage
- **First Marriage:** Margaret Wilson (F10)
  - Married: 1955-04-03
  - Ended: 1985-07-22 (Margaret died)
  - Children: James, Jennifer (from first marriage)

- **Second Marriage:** Helen Brown (F17)
  - Married: 1987-11-10
  - Status: Widowed (Robert died 2005)
  - Children: Thomas (from second marriage)

### 3. David Anderson (I3) - Divorce and Remarriage
- **First Marriage:** Emily Chen (F2)
  - Married: 2009-09-05
  - Divorced: 2016-07-10
  - Children: Christopher, Sophia (from first marriage)

- **Second Marriage:** Rachel Davis (F16)
  - Married: 2017-08-05
  - Status: Current
  - Children: Lucas (from second marriage)

## Testing the Enhanced Spouse Format

After importing this GEDCOM, you can manually convert one person to use the enhanced flat indexed format:

### Example: Converting James Anderson

**Before (GEDCOM import creates legacy format):**
```yaml
spouse: ["[[Linda Martinez]]", "[[Karen Williams]]"]
spouse_id: ["linda-cr-id", "karen-cr-id"]
```

**After (enhanced flat indexed format):**
```yaml
spouse1: "[[Linda Martinez]]"
spouse1_id: "linda-cr-id"
spouse1_marriage_date: "1984-06-12"
spouse1_divorce_date: "1992-03-15"
spouse1_marriage_status: divorced
spouse1_marriage_location: "Seattle, Washington, USA"

spouse2: "[[Karen Williams]]"
spouse2_id: "karen-cr-id"
spouse2_marriage_date: "1995-09-22"
spouse2_marriage_status: current
spouse2_marriage_location: "Portland, Oregon, USA"
```

## Expected Results

When generating a family tree for James Anderson with enhanced format:
1. ✅ Parser detects `spouse1` field and uses enhanced format
2. ✅ Both spouses appear in `spouses` array with metadata
3. ✅ Marriage order is preserved (spouse1 before spouse2)
4. ✅ Children are correctly associated with marriages
5. ✅ Legacy format continues to work for other people

## Family Relationships

- **Generation 1 (Grandparents):** Robert, Margaret, Helen, Carlos, Rosa, Wei, Mei, William, Patricia, Daniel, Amy
- **Generation 2 (Parents):** James, Linda, Karen, David, Sarah, Michael, Emily, Rachel, Ryan, Jessica, Jennifer, Thomas, Maria, Juan
- **Generation 3 (Children):** Christopher, Sophia, Olivia, Emma, Noah, Lucas

## Statistics

- **Total People:** 31
- **People with Multiple Marriages:** 3 (James, Robert, David)
- **Total Marriages:** 17
- **Divorces:** 2 (James/Linda, David/Emily)
- **Deaths:** 3 (Robert, Margaret, Carlos)
