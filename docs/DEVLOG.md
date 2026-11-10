# AI Security Scanner v2.0: Development Log
 
This is version 2 of my [Python CLI vulnerability scanner](https://github.com/yessin-ze/ai-security-scanner-cli). It is a standalone project, not just a wrapper: I rewrote the code in TypeScript so it can run as a VS Code extension that scans the file you are working on and reports vulnerabilities in a side panel.
 
![Final result: the security audit report panel next to the scanned file](images/final-report.png)
 
Something I would like to add later is real CVSS scoring for the severity ratings. For now the extension uses simple rule-based severity tiers (see [Step 4](#step-4-report-panel-and-severity-rules)).
 
---
 
## Step 0: Blueprint
 
The stack I settled on for v2.0:
 
- **Language and SDK:** TypeScript with `@google/genai`, the official Google Gen AI SDK for Node.js.
- **Authentication:** VS Code `context.secrets` (the SecretStorage API), with two commands:
  - `AI Security Scanner: Set Gemini API Key` saves the key, encrypted.
  - `AI Security Scanner: Scan Current File` runs the audit.
- **User interface:** `vscode.window.createWebviewPanel` opens a split panel beside the active Python file and renders Gemini's report with CSS severity badges.
---
 
## Step 1: Setting up the environment
 
### Scaffolding the extension
 
To turn my Python CLI into a VS Code extension, I moved the project from Python to TypeScript. I used Microsoft's official `yo code` Yeoman generator to scaffold the project (`ai-security-scanner`). It sets up the TypeScript compiler, the esbuild bundler, the `package.json` extension manifest and the entry point `src/extension.ts`.
 
After generating the project, I launched the Extension Development Host (F5) and ran the default command from the Command Palette to check that the extension lifecycle and build pipeline worked.
 
![Running the yo code generator](images/01-scaffold.png)
 
### Troubleshooting: extension not activating
 
At first the "Hello World" command did not show up in the Command Palette. The cause was that `yo code` had set `"engines": { "vscode": "^1.145.0" }` in `package.json`, which was newer than my installed Code - OSS build, so VS Code silently skipped loading the extension. Lowering the minimum engine version in `package.json` fixed it and the command appeared.
 
![Hello World command working after the engines fix](images/02-hello-world.png)
 
### Installing the Gemini SDK
 
```bash
npm install @google/genai
```
 
---
 
## Step 2: Secure API credential management
 
### From `.env` to the OS keyring (SecretStorage)
 
In v1.0 of the CLI I stored the Gemini API key in a local `.env` file. That does not work well for an extension, which runs across many workspaces where creating `.env` files is impractical and risks committing secrets to a user's repository.
 
For v2.0 I used VS Code's native SecretStorage API (`context.secrets`). I registered an `ai-security-scanner.setApiKey` command that asks for the key in a masked input box (`password: true`) and stores it in the operating system's keyring (libsecret on Linux). The scan command also checks for a key first and prompts the user to set one if none is found.
 
![Masked API key prompt](images/03-api-key-prompt.png)
![Confirmation that the key was saved to the OS keyring](images/04-key-saved.png)
 
---
 
## Step 3: Gemini integration and reading the active editor
 
### Reading the open file
 
These three lines let me read the text of the focused tab:
 
```ts
const editor = vscode.window.activeTextEditor;   // the currently focused code tab
const code = editor.document.getText();          // the full text from the editor buffer, even unsaved changes
const fileName = editor.document.fileName;       // used in the report header
```
 
### Calling Gemini
 
I added the `@google/genai` SDK and ported the security audit prompt from v1.0. Instead of reading files from command-line arguments like the CLI did, the extension uses `vscode.window.activeTextEditor` and `document.getText()` to take the code from whichever file is open.
 
To make the wait clearer, I wrapped the `gemini-3.5-flash` request in `vscode.window.withProgress`, which shows a status notification while Gemini checks the code for SQL injection, weak hashing, hardcoded secrets and command injection.
 
![First working report, shown as plain text](images/05-first-report.png)
 
### Handling a false-positive refusal
 
When I tested on `vun2.py`, Gemini first refused: "Sorry, I cannot analyze the provided code for security vulnerabilities", while naming the exact flaws in the same message. Safety classifiers can flag prompts like "analyze this code for security vulnerabilities" as possible exploitation requests.
 
I rewrote the system prompt to state the defensive purpose clearly: an automated code-quality linter and refactoring assistant for students. That removed the false refusal, and the output format stayed the same: `SEVERITY / TYPE / DESCRIPTION / IMPACT / FIX`.
 
![The model's false-positive refusal](images/06-model-refusal.png)
 
---
 
## Step 4: Report panel and severity rules
 
### The panel
 
To go beyond the colorama terminal output of v1.0, I built a custom HTML/CSS side panel with `vscode.window.createWebviewPanel`, styled as a cyberpunk HUD.
 
![The cyberpunk-style report panel](images/07-report-panel.png)
 
### Rule-based severity
 
While testing, I noticed that the model's severity labels were inconsistent. It sometimes downgraded serious flaws like SQL injection to MEDIUM when the code looked educational.
 
To fix this I split the work. Gemini does the semantic analysis and writes the suggested fix. A deterministic rule engine in TypeScript then sets the severity from the detected flaw type:
 
| Flaw type | Severity |
| --- | --- |
| Command injection, SQL injection | CRITICAL |
| Hardcoded secrets | HIGH |
| Weak hashing (e.g. MD5) | MEDIUM |
 
These tiers are inspired by CVSS-style ratings. They are fixed rules and do not compute real CVSS base scores.
 
---
 
## Step 5: Packaging
 
I bundled the TypeScript source and dependencies with esbuild in production mode and packaged the extension into a `.vsix` file with `@vscode/vsce package`. Then I installed `ai-security-scanner-0.0.1.vsix` in my own VS Code, so the scanner now runs on demand on whatever Python file I have open.
 
![Packaging the .vsix](images/08-packaging.png)
 
---
 
## Limitations and next steps
 
- Only Python files are supported.
- The full contents of the scanned file are sent to the Gemini API, so don't scan code you are not allowed to share with a third party.
- Findings come from an LLM and can be wrong or incomplete.
- Next: compute real CVSS v3.1 base scores instead of fixed severity tiers.
