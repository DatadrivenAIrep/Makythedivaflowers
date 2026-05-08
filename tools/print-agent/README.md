# Maky Print Agent

Local Windows agent that polls https://makythedivaflowers.com for paid-order print jobs and sends them to the shop printer.

## Requirements

- Windows 10 or 11
- Node.js LTS (>= 20) — install from https://nodejs.org
- A Wi-Fi printer paired with this computer in **Settings → Bluetooth & Devices → Printers**
- Bearer token for the print API (ask the developer; rotated periodically)

## First-time install

Run all commands in **PowerShell as Administrator**.

1. Get the agent code on the machine. Either:
   - Clone the repo: `git clone https://github.com/<org>/diva-flowers.git C:\maky` then `cd C:\maky\tools\print-agent`
   - Or copy the `tools/print-agent/` folder by hand into `C:\maky-print-agent\` and `cd C:\maky-print-agent`

2. Install dependencies:
   ```powershell
   npm install
   npm run build
   ```

3. Configure environment:
   ```powershell
   copy .env.example .env
   notepad .env
   ```

   Fill in:
   - `PRINT_API_URL=https://makythedivaflowers.com`
   - `PRINT_AGENT_TOKEN=<token from password manager>`
   - `PRINTER_NAME=<exact printer name from Settings → Printers>`

4. Verify the printer works:
   ```powershell
   npm run test-print
   ```
   You should see one page come out of the printer with the text "Maky Print Agent — test page". If not, see **Troubleshooting** below.

5. Install as a Windows Service so it runs forever and auto-starts on boot:
   ```powershell
   npm run install-service
   ```

6. Confirm it's running. Open **Services.msc**, find `MakyPrintAgent`, status should be `Running` and startup type `Automatic`.

7. Reboot the machine and verify the service auto-started.

## Operating

- Logs: `C:\maky-print-agent\logs\agent-YYYY-MM-DD.log` (one per day; old files are kept)
- Health check (from a browser, with the same token): `https://makythedivaflowers.com/api/print/health`
  Use a tool like Postman or `curl` because the browser can't set Authorization headers easily.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm run test-print` errors `printer not found` | `PRINTER_NAME` typo | Open **Settings → Printers**, copy the exact name (case-sensitive). |
| Service installed but not printing | Token rotated on server | Update `.env`, restart service: `Restart-Service MakyPrintAgent`. |
| Service can't start | Antivirus blocking node.exe | Add `C:\Program Files\nodejs\node.exe` to the allowlist. |
| Agent log shows `401 Unauthorized` | Wrong or expired token | Rotate as above. |
| Agent log shows `ENOTFOUND` or network errors | Internet outage / DNS | Check the shop's connection. The agent retries automatically. |
| Pages print blank or with strange characters | Printer driver issue | Reinstall the printer driver from the manufacturer; rerun `npm run test-print`. |

## Updating the agent

When the developer pushes a new version:

```powershell
cd C:\maky-print-agent
git pull
npm install
npm run build
Restart-Service MakyPrintAgent
```

## Uninstall

```powershell
npm run uninstall-service
```

This removes the Windows Service. The folder and config remain — delete by hand if desired.

## Token rotation

When the developer rotates `PRINT_AGENT_TOKEN`:
1. Update `.env` on this machine.
2. `Restart-Service MakyPrintAgent`.
3. Verify in the log that the next poll succeeds.
