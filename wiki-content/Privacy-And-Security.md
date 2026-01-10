# Privacy & Security

Charted Roots handles sensitive genealogical data including names, dates, relationships, and family history. This guide covers how to protect your family's privacy and secure your data.

---

## Table of Contents

- [Data Storage Overview](#data-storage-overview)
- [What Data is Stored](#what-data-is-stored)
- [Network Privacy](#network-privacy)
- [Privacy-Aware Export](#privacy-aware-export)
- [Canvas Privacy Protection](#canvas-privacy-protection)
- [Log Export Privacy](#log-export-privacy)
- [Vault Security](#vault-security)
- [Sharing Family Trees](#sharing-family-trees)
- [Recommendations](#recommendations)

---

## Data Storage Overview

**All data stays local.** Charted Roots does not:
- Transmit data over the network
- Connect to external services
- Upload information to cloud servers
- Share data with third parties

Your family data is stored in your Obsidian vault as plain Markdown files with YAML frontmatter. This approach:
- Follows Obsidian's local-first philosophy
- Gives you full control over your data
- Allows easy backup and migration
- Works across all Obsidian platforms

## What Data is Stored

Charted Roots creates and manages several types of files:

| File Type | Location | Contains |
|-----------|----------|----------|
| Person notes | Your configured folder | Names, dates, relationships, cr_id |
| Place notes | Your configured folder | Location names, coordinates |
| Organization notes | Your configured folder | Org names, types, memberships |
| Canvas files | Your choice | Visual layouts, node references |
| Plugin settings | `.obsidian/plugins/canvas-roots/` | Configuration only (no personal data) |

## Privacy Protection for Living Persons

Charted Roots includes built-in privacy protection for people who may still be living.

### Enabling Privacy Protection

1. Open **Settings** → **Charted Roots**
2. Scroll to the **Privacy** section
3. Enable **Privacy protection for living persons**
4. Configure the age threshold (default: 100 years)
5. Choose a display format for protected persons

### How Living Status is Determined

Living status is determined in two ways:

**1. Manual Override (takes precedence)**

You can explicitly mark someone as living or deceased using the `cr_living` frontmatter property:

```yaml
cr_living: true   # Always treat as living (protected)
cr_living: false  # Always treat as deceased (not protected)
```

You can also set this via the Edit Person modal when privacy protection is enabled—look for the "Living status override" dropdown.

**2. Automatic Detection (when `cr_living` is not set)**

A person is considered potentially living if:
- They have **no death date** recorded, AND
- They were born within the configured threshold (default: 100 years)

For example, with a 100-year threshold:
- Born 1950, no death date → **Protected** (potentially living)
- Born 1900, no death date → **Not protected** (over threshold)
- Born 1980, died 2020 → **Not protected** (has death date)

**Use cases for manual override:**
- Person with unknown dates but known to be living
- Person with death date not yet entered but known to be deceased
- Override false positives from automatic detection

### Display Formats

When privacy protection is enabled, protected persons can be displayed as:

| Format | Example | Use Case |
|--------|---------|----------|
| "Living" | Living | Clear indicator |
| "Private" | Private | Neutral language |
| Initials | J.S. | Preserves some identity |
| Hidden | (blank) | Maximum privacy |

### What Gets Protected

When privacy protection is enabled:
- **Exports**: Name replaced with chosen format, dates hidden
- **Family structure**: Relationships preserved (allows tree viewing)
- **Notes**: Original files unchanged (protection applies to outputs only)

## Privacy in Exports

### GEDCOM Export

Privacy protection applies when exporting to GEDCOM format:

1. In **Control Center** → **Import/Export** tab
2. Set format to "GEDCOM", direction to "Export"
3. Privacy options appear in the export dialog
4. Choose to exclude or anonymize living persons
5. Export creates a privacy-respecting GEDCOM file

**Example output for protected person:**
```
0 @I123@ INDI
1 NAME Living //
1 BIRT
2 DATE
```

### CSV Export

Same privacy options are available for CSV exports:
- Protected persons can be excluded entirely
- Or anonymized with name replaced by display format
- Dates hidden for protected persons

### GEDCOM X and Gramps XML

Privacy protection also works with:
- GEDCOM X (JSON format for modern applications)
- Gramps XML (for Gramps genealogy software)

## Canvas Privacy Protection

When generating canvas or Excalidraw trees, you can apply privacy protection to living persons.

### Enabling Canvas Privacy

1. Open the **Tree Wizard** (Control Center → Visual Trees → New Tree)
2. Select your root person and tree type
3. Choose **Canvas** or **Excalidraw** as output format
4. In the **Canvas Options** step, expand **Privacy protection**
5. Enable **Apply privacy protection to living persons**
6. Choose a format:
   - **Text node**: Shows obfuscated name as a text box (e.g., "Living", "Private", or initials)
   - **File node**: Keeps clickable file link but reveals identity

### What Gets Protected

When privacy protection is enabled:
- **Text nodes**: Replace the person's name with your chosen display format
- **Wikilinks included**: Text nodes include `[[filename]]` for navigation back to the original note
- **Preview count**: The wizard preview shows how many living persons will be protected

### Important Limitations

Canvas privacy protection is designed for **reducing casual visibility**, not for secure data protection:

| Limitation | What This Means |
|------------|-----------------|
| File nodes reveal identity | If using 'file' format, the filename is visible in canvas JSON |
| Wikilinks in text nodes | Text nodes include `[[filename]]` for navigation, which reveals the original name |
| Canvas JSON is plain text | Anyone viewing the `.canvas` file can see all data |
| Generation-time only | Privacy is applied when the canvas is created |
| Edges preserved | Relationship lines remain, showing family structure |

### Recommendations

For maximum privacy when generating canvases:
- Use the **hidden** display format to exclude living persons entirely
- **Do not share** generated canvas files containing living persons
- Consider that anyone with file access can view the raw canvas JSON

## Log Export Privacy

When troubleshooting issues, you may need to export logs and share them with developers or support. Charted Roots protects your family's privacy in log exports.

### Automatic Obfuscation

By default, log exports automatically replace personal information with placeholder tokens:

| Data Type | Replacement | Example |
|-----------|-------------|---------|
| Names | `[NAME-1]`, `[NAME-2]` | "John Smith" → `[NAME-1]` |
| Dates | `[DATE]` | "1985-03-15" → `[DATE]` |
| Years | `[YEAR]` | "1952" → `[YEAR]` |
| File paths | `/[FILE].md` | "/People/John.md" → `/[FILE].md` |
| Record IDs | `[ID]` | UUIDs are replaced |

### Configuring Log Privacy

1. Open **Settings** → **Charted Roots**
2. Expand the **Logging** section
3. Toggle **Obfuscate log exports** (enabled by default)

### Exporting Logs

1. Open **Settings** → **Charted Roots** → **Logging**
2. Click **Export** to save logs to your vault
3. Logs are saved to the configured log folder (default: `.canvas-roots/logs`)
4. If obfuscation is enabled, personal data is replaced before saving

### When to Disable Obfuscation

You may want to disable obfuscation if:
- You're debugging your own data privately
- You need to see exact names/dates to trace an issue
- You're sharing logs with trusted family members who already have access

> **Tip:** Keep obfuscation enabled when sharing logs publicly (GitHub issues, forums, etc.)

## Securing Your Vault

Since Charted Roots stores data locally, vault security is your responsibility.

### Recommended Practices

**Device Security:**
- Use strong passwords for your OS accounts
- Enable full-disk encryption
- Lock your device when away
- Keep Obsidian and plugins updated

**Vault Protection:**
- Store your vault on encrypted storage
- Use Obsidian Sync's encryption if cloud syncing
- Consider a separate vault for sensitive genealogical data

**Cloud Sync Caution:**
- Understand that sync services (Dropbox, iCloud, etc.) store copies
- Enable 2FA on all cloud accounts
- Consider local-only vaults for highly sensitive data

**Git/Version Control:**
- **Never** commit genealogical data to public repositories
- Use private repositories only if necessary
- Add person notes folders to `.gitignore` if using git

### Backup Best Practices

1. Maintain encrypted backups of your vault
2. Test backup restoration periodically
3. Store backups in a secure location
4. Treat backups with same security as primary vault

## Sharing Family Trees Safely

### Before Sharing

Consider these questions:
- Does the tree include living relatives?
- Have you enabled privacy protection?
- Are there sensitive details (adoptions, paternity issues)?
- Does the recipient need full details or just structure?

### Safe Sharing Workflow

1. **Enable privacy protection** in settings
2. **Export with privacy options** enabled
3. **Review the export** before sharing
4. Consider creating separate "public" and "private" exports

### Sharing Screenshots

When taking screenshots of canvases:
- **Generate with privacy enabled**: Use the privacy protection option in the tree wizard to create canvases with obfuscated names
- Review for sensitive information before sharing
- Consider cropping or blurring any remaining identifiable details
- Note: Privacy protection only applies to newly generated canvases, not existing ones

## Compliance Considerations

### GDPR (EU)

If your family tree includes EU residents:
- Living EU residents have privacy rights
- Enable privacy protection for exports shared outside your family
- Consider consent when recording living relatives' data

### General Best Practices

- Only record information you need
- Get consent before adding living relatives
- Handle adoptions, paternity, and medical info with care
- Respect cultural norms around family information
- Be mindful of historical injustices in records

## Quick Reference

| Task | How To |
|------|--------|
| Enable privacy protection | Settings → Charted Roots → Privacy section |
| Set age threshold | Settings → Configure threshold (default 100) |
| Mark someone as living | Add `cr_living: true` to frontmatter, or use Edit Person modal |
| Export with privacy | Control Center → Export → Enable privacy options |
| Exclude living from export | Choose "Exclude living persons" in export dialog |
| Generate canvas with privacy | Tree Wizard → Canvas Options → Enable privacy protection |
| Toggle log obfuscation | Settings → Charted Roots → Logging → Obfuscate log exports |
| Export logs | Settings → Charted Roots → Logging → Export button |

## See Also

- [Import & Export](Import-Export) - Detailed export options including privacy
- [Frontmatter Reference](Frontmatter-Reference) - All frontmatter properties including `cr_living`
- [SECURITY.md](https://github.com/banisterious/obsidian-charted-roots/blob/main/SECURITY.md) - Security policy and vulnerability reporting
