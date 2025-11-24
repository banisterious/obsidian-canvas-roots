# Security Policy

## Supported Versions

Currently, security updates are provided for the latest release version only.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Data Privacy and Personally Identifiable Information (PII)

### Nature of Data Stored

Canvas Roots handles **highly sensitive personally identifiable information (PII)** by design, including:

- **Full names** of individuals and family members
- **Birth and death dates**
- **Family relationships** (parents, children, spouses)
- **GEDCOM files** containing extensive genealogical data
- **Custom notes** about individuals
- **Potential additional PII** in linked Markdown files

**Important**: All data is stored **locally** in your Obsidian vault. The plugin does **not**:
- Transmit data over the network
- Connect to external services
- Upload information to cloud servers
- Share data with third parties

### Data Storage Locations

1. **Person Notes** (`.md` files)
   - Location: Anywhere in your vault (user-controlled)
   - Format: Markdown with YAML frontmatter
   - Contains: Names, dates, relationships, cr_id values

2. **Canvas Files** (`.canvas` files)
   - Location: Anywhere in your vault (user-controlled)
   - Format: JSON
   - Contains: Visual layout data, references to person notes

3. **Plugin Settings** (`data.json`)
   - Location: `.obsidian/plugins/canvas-roots/data.json`
   - Format: Plain text JSON (unencrypted)
   - Contains: Plugin configuration (node sizes, spacing, preferences)
   - Does NOT contain: Personal genealogical data

### Why Plain Text Storage?

1. **Obsidian Standard**: Follows Obsidian's markdown-first philosophy
2. **User Control**: Users maintain full ownership and control of their data
3. **Transparency**: No hidden or obfuscated data storage
4. **Portability**: Data can be easily backed up, migrated, or processed by other tools
5. **Mobile Compatibility**: Works across all Obsidian platforms

## Security Recommendations

### For Individual Users

1. **Vault Protection**
   - Use strong passwords/encryption for your vault
   - Enable Obsidian's vault encryption if available
   - Store your vault on encrypted storage devices
   - Limit physical access to devices containing your vault

2. **Sharing Considerations**
   - **Never** share your vault publicly without sanitizing PII first
   - Be extremely cautious about who has access to your vault
   - Consider using separate vaults for sensitive genealogical data vs. other notes
   - **Use the built-in obfuscation feature** (§5.6 of specification) when sharing Canvas screenshots or GEDCOM exports
   - The obfuscation feature protects PII while preserving family tree structure for demonstrations and collaboration

3. **Cloud Sync and Backup**
   - Understand that cloud sync services (Obsidian Sync, Dropbox, etc.) will sync all PII
   - Ensure your cloud storage is properly secured with 2FA
   - Consider local-only vaults for highly sensitive family data
   - Encrypted cloud storage is strongly recommended

4. **Version Control (Git)**
   - **NEVER** commit genealogical vaults to public repositories
   - Use private repositories only if necessary
   - Consider adding person notes directory to `.gitignore`
   - Be aware that git history contains all previous versions of data

5. **GEDCOM Files**
   - GEDCOM files contain extensive PII about living and deceased individuals
   - Treat GEDCOM files with the same security as financial documents
   - Be cautious when importing GEDCOM files from untrusted sources
   - **Use the export obfuscation feature** when sharing GEDCOM files publicly or with collaborators
   - Obfuscation levels range from minimal (dates only) to full (all PII anonymized)
   - Optionally generate a secure mapping file to reverse obfuscation later

### For Professional Genealogists

1. **Client Data**
   - Maintain separate vaults for each client
   - Never mix client data in shared vaults
   - Follow applicable data protection regulations (GDPR, CCPA, etc.)
   - Obtain explicit consent before storing client family data

2. **Compliance**
   - This plugin does not provide GDPR/CCPA compliance features
   - Users are responsible for compliance with applicable regulations
   - Consider data retention policies for deceased individuals
   - Document your data handling procedures

3. **Data Anonymization**
   - **Use the built-in obfuscation feature** for professional demonstrations and client presentations
   - Choose appropriate obfuscation levels: Minimal, Standard, or Full based on sharing context
   - Canvas obfuscation mode provides temporary display anonymization for screenshots
   - Export obfuscation creates shareable GEDCOM files while preserving structure
   - Store obfuscation mapping files securely and separately from obfuscated exports
   - Use fictional data for public examples when obfuscation is insufficient

## Security Best Practices for Users

### Data Access Control

1. **Physical Security**: Secure devices containing your vault
2. **Account Security**: Use strong passwords for OS accounts
3. **Application Security**: Keep Obsidian and plugins updated
4. **Network Security**: Be cautious on public WiFi when accessing vaults

### Data Backup

1. **Regular Backups**: Maintain encrypted backups of your vault
2. **Backup Testing**: Periodically verify backup integrity
3. **Offsite Storage**: Consider encrypted offsite backup storage
4. **Backup Security**: Protect backups with same security as primary vault

### Data Lifecycle

1. **Data Collection**: Only include necessary PII
2. **Data Retention**: Consider retention policies for old data
3. **Data Deletion**: Securely delete data when no longer needed
4. **Data Migration**: Securely transfer data when changing systems

## Known Security Limitations

1. **No Built-in Encryption**: The plugin does not encrypt data (relies on Obsidian/OS)
2. **No Access Controls**: Anyone with vault access can view all data
3. **No Audit Logging**: The plugin does not log data access
4. **Obfuscation is Optional**: Users must manually enable obfuscation for exports/canvas
5. **Obfuscation Mapping Files**: Mapping files contain PII and must be secured separately

## Reporting a Vulnerability

If you discover a security vulnerability in Canvas Roots, please report it by:

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly at: [Check GitHub profile or package.json]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact (especially regarding PII exposure)
   - Suggested fix (if available)

You can expect:
- Initial response within 48 hours
- Regular updates on the status of your report
- Credit in the security advisory (unless you prefer to remain anonymous)
- Coordination on disclosure timeline

## Legal and Ethical Considerations

### Privacy Laws

Users should be aware of and comply with applicable privacy laws, including but not limited to:

- **GDPR** (EU): Right to be forgotten, data portability, consent requirements
- **CCPA** (California): Consumer privacy rights, data disclosure requirements
- **Other Regional Laws**: Consult local privacy regulations

### Ethical Genealogy

1. **Living Individuals**: Exercise caution when recording data about living persons
2. **Consent**: Consider obtaining consent before recording others' information
3. **Sensitive Information**: Handle adoptions, paternity, and medical data with care
4. **Cultural Sensitivity**: Respect cultural norms around family information
5. **Historical Context**: Be mindful of historical injustices in genealogical records

## Data Breach Response

If you suspect your vault containing family data has been compromised:

1. **Immediate Actions**:
   - Disconnect the device from network
   - Change passwords for cloud sync services
   - Review access logs if available
   - Identify what data may have been exposed

2. **Assessment**:
   - Determine scope of exposure
   - Identify affected individuals
   - Consider legal notification requirements

3. **Mitigation**:
   - Create new vault with fresh data
   - Review and update security practices
   - Consider informing affected family members
   - Document the incident

## Privacy and Obfuscation Features

Canvas Roots includes comprehensive data obfuscation capabilities designed to protect PII:

### Export Obfuscation (Planned - Phase 3)
- **Multiple obfuscation levels**: None, Minimal, Standard, Full
- **Selective filters**: Choose to obfuscate all individuals, living only, minors only, or both
  - **Living individuals**: Auto-detected based on dates or manually marked with `cr_living` property
  - **Minors**: Configurable age threshold (default: under 18 years old)
  - **Combined protection**: Apply filters together for maximum privacy
- **Selective anonymization**: Names, dates, locations, notes, media
- **Structure preservation**: Family relationships and graph structure maintained
- **Reversible mapping**: Optional JSON mapping file for de-obfuscation
- **GEDCOM compatible**: Obfuscated exports remain valid GEDCOM files

### Canvas Obfuscation (Planned - Phase 4)
- **Temporary display mode**: Toggle obfuscation for screenshots/presentations
- **Visual indicators**: Clear indication when obfuscation is active
- **Non-destructive**: Original notes remain unchanged
- **Configurable levels**: Same obfuscation levels as export

### Use Cases
- **GDPR Compliance**: Share historical research while protecting living EU residents' data
- **Child Protection**: Export family trees with automatic protection for minors
- **Public Genealogy**: Share complete historical trees while protecting recent generations
- **Professional Demonstrations**: Show family tree structures without exposing client PII
- **Educational Materials**: Create teaching examples protecting all living individuals
- **Collaborative Research**: Share tree structure with researchers who need patterns, not names

Data obfuscation features are planned for a future release. See [roadmap.md](docs/roadmap.md) for details.

## Future Security Enhancements

Additional planned improvements:

- Optional encryption for cr_id values
- Automatic living/deceased person detection
- Enhanced obfuscation algorithms
- Audit logging capabilities
- Access control recommendations

## Acknowledgments

We take the security and privacy of genealogical data seriously and appreciate security researchers and privacy advocates who help keep Canvas Roots secure.

---

**Remember**: Your family's privacy is in your hands. This plugin provides tools for organizing genealogical data, but you are responsible for securing that data appropriately.
