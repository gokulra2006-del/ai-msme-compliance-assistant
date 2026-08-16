# Evidence & Document Management — Complete Walkthrough

The **Evidence Vault** has been fully integrated into the existing SurakshaSetu platform. It uses the exact existing authentication, database, and deterministic rules engine without altering previous code.

---

## 1. Evidence Backend Architecture
- **New MongoDB Models**: 
  - `Evidence` — Tracks `business`, `uploadedBy`, `obligationCode`, file details (MIME, size, filename), expiry dates, and verification status.
  - `AuditLog` — Minimal tracker that logs who uploaded, modified, verified, or deleted documents.
- **File Uploads**: Uses `multer` with strict validation (PDF/JPG/PNG only, 10MB limit) and generates cryptographically safe filenames (e.g., UUID + extension). Original filename is stored only in the database, not on the filesystem.
- **REST APIs (`/api/evidence`)**:
  - `POST /upload`: Validates inputs, saves file, creates Evidence record, logs audit event.
  - `GET /`: Retrieves all evidence.
  - `GET /dashboard`: Aggregates the 12 compliance rules against uploaded files to detect missing/expiring documents.
  - `GET /:id/download`: Streams the physical file securely (verifies auth + business ID first).
  - `PUT /:id/verify`: Allows verifying/rejecting documents.
  - `DELETE /:id`: Deletes physical file and database record.

---

## 2. Evidence Vault Page (`/evidence`)
A completely new page has been added that acts as the command center for compliance documents:

### Summary Dashboard
At the top, four metric cards calculate real-time document health:
- **Total Required**: Evaluates the user's business profile against the rules engine to determine how many files they legally must have.
- **Uploaded**: Total files currently in the vault.
- **Missing**: Specifically flags required documents that have not been uploaded.
- **Expiring/Expired**: Flags uploaded documents whose `expiryDate` is past or within 30 days.

### Missing & Expiring Alerts
If the system detects a missing document (e.g., FSSAI License is required but not found), it displays a prominent red alert block. Clicking **Upload** on these alerts auto-fills the upload modal with the exact Obligation and Document Type.

### All Required Documents Table
A comprehensive grid showing every document the business is expected to have, its corresponding obligation code, upload status, verification status, and expiry date.

### Upload Modal
A secure slide-in drawer form to add evidence. Features:
- Dropdown to select the relevant Obligation.
- Auto-populates Document Types based on the selected Obligation's requirements.
- File upload (PDF/JPG/PNG).
- Optional Issue and Expiry date tracking.

---

## 3. Dashboard Integration
The main dashboard (`/dashboard`) now features a **📁 Evidence Vault Summary** section directly above the Applicable Obligations list. It shows the same 4 high-level metrics and alerts the user in red text if they have missing documents.

---

## 4. Obligation Drawer Integration
On the Obligations page (`/obligations`), clicking any rule now opens the drawer and displays an upgraded **Evidence** section. 
- It reads the `evidenceMap` and explicitly marks each required evidence type as either **[Uploaded]** (green) or **[Missing]** (red).
- If uploaded, it shows Expiry and Verification status.
- It provides direct **View File** and **Manage** action buttons right inside the drawer.

---

## How to Test

1. Navigate to `http://localhost:5174/evidence`.
2. Notice the "Missing Documents" alerts (since you haven't uploaded any yet).
3. Click **Upload** next to one of the missing documents.
4. Select a sample PDF or Image, set an expiry date to next week, and click **Upload Document**.
5. Notice the summary metrics instantly update: Uploaded increments, Missing decrements, and Expiring flags the upcoming date.
6. Navigate to the **Dashboard** to see the summary mirrored there.
7. Navigate to **Obligations**, click the obligation you just uploaded evidence for, and notice the drawer now proudly shows **[Uploaded]** with a **View File** button.

## Security Enforced
- **Isolation**: The APIs strictly query `Business.findOne({ user: req.user.id })` and enforce that `businessId` on every evidence lookup. Users cannot access other businesses' files.
- **Filesystem Safety**: Original filenames are discarded for filesystem storage. Files are streamed back via Node.js rather than exposing a static folder, ensuring the JWT token must be valid to download a file.
