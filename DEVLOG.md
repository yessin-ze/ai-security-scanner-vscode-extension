hello this is version 2 of my older project witch is a cli python vunerability scanner (https://github.com/yessin-ze/ai-security-scanner-cli) , this is a stand alone project not just an extension because i will be rewriting the code in typescript so i can turn it into a vs-code extention , the end goal is a vs_code extention that can scan the work_file for vunerabilities 
for the far future i want the sevarity clasification to be normalized with cvss rating but that will need some rag i will learn it soon enough 
![alt text](image-7.png)
-----------------------------------------------------------------------------------------------------------------------------
0. step 0 blueprint 
-----------------------------------------------------------------------------------------------------------------------------
Here is our confirmed stack for AI Security Scanner v2.0:

    Language & SDK: TypeScript + @google/genai (official Google Gen AI Node.js SDK).

    Authentication: VS Code context.secrets (SecretStorage API) with two commands:

        AI Security Scanner: Set Gemini API Key (saves encrypted key)

        AI Security Scanner: Scan Current File (runs the audit)

    User Interface: vscode.window.createWebviewPanel (opens a split-screen panel beside your active Python file and renders Gemini's report with CSS severity badges).
-----------------------------------------------------------------------------------------------------------------------------
1. &&STEP 1 : setting up the envirement : 
-----------------------------------------------------------------------------------------------------------------------------
## Scaffolding the VS Code Extension (v2.0)
To evolve my Python CLI security scanner into a standalone VS Code extension, I transitioned the project architecture from Python to TypeScript. I used Microsoft's official yo code Yeoman generator to scaffold the extension project (ai-security-scanner), which set up the TypeScript compiler, esbuild bundler, the package.json extension manifest, and the main entry point at src/extension.ts. After generating the project, I launched the Extension Development Host (F5) and triggered the default command from the Command Palette to verify that the extension lifecycle and build pipeline were working properly.
![alt text](image.png)

### Troubleshooting Extension Activation (engines.vscode Mismatch)
Initially, my "Hello World" command didn't appear in the Command Palette. I discovered that yo code had set "engines": { "vscode": "^1.145.0" } in package.json, which was newer than my installed Code - OSS build, causing VS Code to silently skip loading the extension. Lowering the minimum engine target in package.json immediately resolved the issue and activated the command.
![alt text](image-2.png)

Install the Official Google Gen AI TypeScript SDK

-----------------------------------------------------------------------------------------------------------------------------
&&2.Secure API Credential Management:&&
-----------------------------------------------------------------------------------------------------------------------------
## Upgrading Credential Security: From .env to OS Keyring (SecretStorage)
In Version 1.0 of my CLI scanner, I stored my Gemini API key in a local .env file. However, a VS Code extension operates across many different workspaces where creating .env files is impractical and risks accidentally committing secrets to a user's repository. To follow security best practices in Version 2.0, I implemented VS Code's native SecretStorage API (context.secrets). I registered an ai-security-scanner.setApiKey command that prompts the user with a masked password input box (password: true) and encrypts the credential directly inside the operating system's native keyring (libsecret on Linux). I also added a safeguard in the scanner command that automatically prompts the user to configure their key if none is detected.
![alt text](image-3.png)
![alt text](image-4.png)

-----------------------------------------------------------------------------------------------------------------------------
step 3: Integrating the Gemini Security Engine & Reading Active Editor Code!
-----------------------------------------------------------------------------------------------------------------------------
my cheat sheet ; these commands allow me to read the current focus tab text :
const editor = vscode.window.activeTextEditor; — Gets the currently focused code tab.

const code = editor.document.getText(); — Reads the entire source code directly from the editor buffer (even unsaved changes!).

const fileName = editor.document.fileName; — Gets the file name for our report header.
## Integrating the Gemini API & Active Editor Buffer
In this phase, I integrated the official @google/genai TypeScript SDK into the extension and ported my security audit prompt from Version 1.0. Instead of reading files from command-line arguments like my Python CLI did, I used vscode.window.activeTextEditor and document.getText() to dynamically capture the code from whichever file the developer currently has open in the editor. To improve the user experience during API calls, I wrapped the gemini-3.5-flash request inside vscode.window.withProgress, displaying a live status notification while Gemini analyzes the code for SQL injection, weak hashing, hardcoded secrets, and command injection.
![alt text](image-5.png)

### Engineering Around LLM Cybersecurity Safety Filters
When testing the scanner on vun2.py, Gemini initially triggered a false-positive safety refusal ("Sorry, I cannot analyze the provided code for security vulnerabilities")—ironically naming the exact flaws in its refusal message. Because modern LLM safety classifiers flag phrases like "analyze this code for security vulnerabilities" and "potential damage" as potential offensive exploitation requests, I refactored the system prompt to frame the task as an automated defensive code-quality linter and student refactoring assistant. This prompt alignment adjustment bypassed the false-positive refusal while preserving my exact SEVERITY / TYPE / DESCRIPTION / IMPACT / FIX output schema.
![alt text](image-6.png)
-----------------------------------------------------------------------------------------------------------------------------
STEP 4 : making it look good 
-----------------------------------------------------------------------------------------------------------------------------
## Designing the Cyberpunk Webview UI & Deterministic CVSS Engine
To upgrade the terminal output from Version 1.0 (colorama) into a native IDE experience, I built a custom HTML/CSS side panel using vscode.window.createWebviewPanel styled after a Cyberpunk Netrunner HUD. During testing, I noticed that raw LLM severity classifications could be inconsistent—occasionally softening high-risk flaws like SQL Injection to MEDIUM when framed as educational code. To solve this, I implemented a hybrid neuro-symbolic architecture: Gemini performs the semantic code analysis and generates the refactoring patch, while a deterministic CVSS v3.1 Rule Engine in TypeScript inspects the detected flaw type and enforces strict severity tiers (CRITICAL for Command/SQL Injection, HIGH for hardcoded secrets, and MEDIUM for weak hashing like MD5).
![alt text](image-8.png)
-----------------------------------------------------------------------------------------------------------------------------
step 5 : pakaging 
-----------------------------------------------------------------------------------------------------------------------------
## Packaging & Distributing the Extension (.vsix)
To complete Version 2.0, I bundled the TypeScript source code and dependencies using esbuild in production mode and packaged the extension into a standalone .vsix binary using @vscode/vsce package. Finally, I installed ai-security-scanner-0.0.1.vsix directly into my primary VS Code environment, transforming my weekend Python CLI prototype into a permanent, real-time DevSecOps assistant built right into my IDE.
![alt text](image-9.png)