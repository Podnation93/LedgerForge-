# LedgerForge AI

Australia-first local desktop accounting app with private Ollama AI workflows.

## Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

## Document Intake

The Receipts screen includes a local document intake workflow for PDFs and common image files.

- Import individual files or a whole folder.
- Supported files: PDF, PNG, JPG/JPEG, WebP, TIFF.
- Files are copied into an app-managed local vault under Electron `userData`.
- SHA-256 hashes are stored for duplicate detection.
- Each accepted file can be processed through local OCR from the Receipts screen.
- Files larger than 50 MB are skipped to keep large folder imports predictable.

OCR runs locally. Image files use bundled Tesseract.js. PDFs use embedded text extraction first, then scanned-page OCR via Poppler page rendering when `pdftoppm` is available on the machine.

## Implemented Workflows

- Banking: CSV files can be selected or pasted, previewed for duplicate/error rows, then imported.
- Transactions: imported lines can be categorised with account, GST code, receipt state, status, and business-use percentage.
- Tax & BAS: BAS periods show GST collected, GST paid, net GST, warning flags, lock state, and period transactions.
- Receipts: imported documents can be attached to transactions as receipt evidence.
- Settings: business, ABN, GST, BAS, and local Ollama settings can be edited with validation.
- AI Assistant: local rule-based review suggestions are generated from current transactions and can be approved or rejected.
- Exports: generated export packs are listed in export history and can be revealed in the file manager.

## Packaging

```bash
npm run pack:linux
npm run pack:win
```
