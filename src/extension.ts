import * as vscode from 'vscode';
import { GoogleGenAI } from '@google/genai';

const SECRET_KEY_NAME = 'gemini_api_key';

function buildSecurityPrompt(code: string): string {
	return `You are an automated DevSecOps static analysis linter enforcing strict CVSS v3.1 standards.
Analyze the student practice code below and classify vulnerabilities objectively using this CVSS Severity Matrix:

- [CRITICAL] (CVSS 9.0-10.0): Remote code execution, unauthenticated database takeover, or hardcoded master administrative secrets.
- [HIGH] (CVSS 7.0-8.9): Standard SQL Injection (SQLi), OS Command Injection, Path Traversal, or arbitrary file access.
- [MEDIUM] (CVSS 4.0-6.9): Weak Cryptographic Hashing (e.g., MD5/SHA1 for passwords), insecure direct object references, or missing input sanitization.
- [LOW] (CVSS 0.1-3.9): Minor information disclosure, hardcoded non-secret configuration strings, or missing security headers.

For each issue found, use this exact format:

---
SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]
TYPE: [Vulnerability Name]
DESCRIPTION: [One sentence explaining the flaw]
IMPACT: [One sentence detailing the CVSS risk vector]
FIX: [Refactored safe Python code snippet only]
---

Target Code:
${code}`;
}
export function activate(context: vscode.ExtensionContext) {
	const setApiKeyCmd = vscode.commands.registerCommand('ai-security-scanner.setApiKey', async () => {
		const apiKey = await vscode.window.showInputBox({
			prompt: 'Enter your Google Gemini API Key',
			placeHolder: 'AIzaSy...',
			password: true,
			ignoreFocusOut: true
		});

		if (!apiKey) {
			return;
		}

		await context.secrets.store(SECRET_KEY_NAME, apiKey.trim());
		vscode.window.showInformationMessage('✅ Gemini API Key securely saved to OS Keyring!');
	});

	const scanFileCmd = vscode.commands.registerCommand('ai-security-scanner.scanFile', async () => {
		const apiKey = await context.secrets.get(SECRET_KEY_NAME);
		if (!apiKey) {
			const action = await vscode.window.showErrorMessage(
				'Gemini API Key not found! Please set your API key first.',
				'Set API Key Now'
			);
			if (action === 'Set API Key Now') {
				vscode.commands.executeCommand('ai-security-scanner.setApiKey');
			}
			return;
		}

		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('Please click inside a Python file first!');
			return;
		}

		const code = editor.document.getText();
		const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'script.py';

		if (!code.trim()) {
			vscode.window.showWarningMessage('The current file is empty!');
			return;
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `🛡️ AI Security Scanner: Auditing ${fileName}...`,
				cancellable: false
			},
			async () => {
				try {
					const ai = new GoogleGenAI({ apiKey });
					const prompt = buildSecurityPrompt(code);

					const response = await ai.models.generateContent({
						model: 'gemini-3.5-flash', // Keep your working model string here!
						contents: prompt,
						config: {
							safetySettings: [
								{
									category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any,
									threshold: 'BLOCK_NONE' as any
								}
							]
						}
					});

					const reportText = response.text || 'No response received.';

					// Open our custom Color-Coded Webview Side Panel!
					const panel = vscode.window.createWebviewPanel(
						'aiSecurityReport',
						`🛡️ Security Audit: ${fileName}`,
						vscode.ViewColumn.Beside,
						{ enableScripts: false }
					);

					panel.webview.html = getWebviewContent(fileName, reportText);

				} catch (error: any) {
					vscode.window.showErrorMessage(`❌ Gemini Scan Error: ${error.message || error}`);
				}
			}
		);
	});

	context.subscriptions.push(setApiKeyCmd, scanFileCmd);
}

// Helper to escape HTML characters inside code snippets
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Converts Gemini's --- blocks into Color-Coded HTML Severity Cards
function getWebviewContent(fileName: string, rawReport: string): string {
	const blocks = rawReport
		.split('---')
		.map(b => b.trim())
		.filter(b => b.includes('SEVERITY:'));

	let cardsHtml = '';

	if (blocks.length === 0) {
		cardsHtml = `<div class="empty-state">>> SYSTEM SECURE: NO THREATS DETECTED IN ${escapeHtml(fileName)}</div>`;
	} else {
		for (const block of blocks) {
			// Strip markdown asterisks so **SEVERITY:** or **CRITICAL** never breaks the parser
			const cleanBlock = block.replace(/\*/g, '');

			const sevMatch = cleanBlock.match(/SEVERITY:\s*\[?(CRITICAL\vert{}HIGH\vert{}MEDIUM\vert{}LOW)\]?/i);
			const typeMatch = cleanBlock.match(/TYPE:\s*(.+)/i);
			const descMatch = cleanBlock.match(/DESCRIPTION:\s*(.+)/i);
			const impactMatch = cleanBlock.match(/IMPACT:\s*(.+)/i);
			const fixMatch = block.match(/FIX:\s*([\s\S]+)$/i);

			const vulnType = typeMatch ? escapeHtml(typeMatch[1].trim()) : 'UNKNOWN ANOMALY';
			const description = descMatch ? escapeHtml(descMatch[1].trim()) : '';
			const impact = impactMatch ? escapeHtml(impactMatch[1].trim()) : '';
			const fixRaw = fixMatch ? fixMatch[1].replace(/```python|```/g, '').trim() : '';

			// 1. Start with Gemini's parsed classification
			let severity = (sevMatch ? sevMatch[1].toUpperCase() : 'MEDIUM');

			// 2. Deterministic CVSS v3.1 Knowledge Base Override (Local Rule Engine)
			const combinedText = `${vulnType} ${description}`.toLowerCase();
			if (/(command injection|os\.system|rce|remote code|eval\(|exec\(|sql injection|sqli|unparameterized sql)/.test(combinedText)) {
				severity = 'CRITICAL';
			} else if (/(hardcoded|secret|api_secret|password|credential|path traversal|deserialization)/.test(combinedText)) {
				severity = 'HIGH';
			} else if (/(md5|sha1|weak hash|cryptographic|hashing)/.test(combinedText)) {
				severity = 'MEDIUM';
			}

			const sevClass = severity.toLowerCase();
			cardsHtml += `
				<div class="cyber-card ${sevClass}">
					<div class="card-corner tl"></div>
					<div class="card-corner tr"></div>
					<div class="card-corner bl"></div>
					<div class="card-corner br"></div>
					
					<div class="card-header">
						<span class="cyber-badge ${sevClass}">[${severity}]</span>
						<span class="vuln-title">${vulnType}</span>
					</div>
					
					<div class="data-block">
						<span class="data-label">// DESCRIPTION</span>
						<p>${description}</p>
					</div>
					
					<div class="data-block">
						<span class="data-label">// BREACH IMPACT</span>
						<p>${impact}</p>
					</div>

					<div class="fix-container">
						<div class="fix-header">
							<span class="data-label">// RECOMMENDED_REMEDIATION.patch</span>
						</div>
						<pre><code>${escapeHtml(fixRaw)}</code></pre>
					</div>
				</div>
			`;
		}
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<style>
		:root {
			--bg-dark: #0a0c10;
			--panel-bg: #121620;
			--border-red: #ff3333;
			--border-dim: #2b3648;
			--text-main: #e2e8f0;
			--text-muted: #8492a6;
			--critical: #ff3333;
			--high: #ff9900;
			--medium: #f1c40f;
			--low: #00e5ff;
		}
		body {
			font-family: var(--vscode-editor-font-family, 'Courier New', Courier, monospace);
			padding: 20px;
			color: var(--text-main);
			background-color: var(--bg-dark);
			margin: 0;
			background-image: linear-gradient(rgba(18, 22, 32, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
			background-size: 100% 4px;
		}
		.hud-header {
			border: 1px solid var(--border-red);
			background: rgba(255, 51, 51, 0.05);
			padding: 14px 18px;
			margin-bottom: 24px;
			position: relative;
			box-shadow: inset 0 0 15px rgba(255, 51, 51, 0.1);
		}
		.hud-header::before {
			content: "SYS_SEC // BATTLEDECK v0.2";
			position: absolute;
			top: -8px;
			left: 12px;
			background: var(--bg-dark);
			padding: 0 6px;
			font-size: 0.65rem;
			color: var(--border-red);
			letter-spacing: 2px;
			font-weight: bold;
		}
		.hud-title {
			font-size: 1.1rem;
			font-weight: bold;
			letter-spacing: 1px;
			color: #fff;
			margin-bottom: 4px;
			text-transform: uppercase;
		}
		.hud-meta {
			font-size: 0.75rem;
			color: var(--text-muted);
			letter-spacing: 1px;
		}
		
		/* Cyber Card with Angular Tech Borders */
		.cyber-card {
			background: var(--panel-bg);
			border: 1px solid var(--border-dim);
			padding: 18px;
			margin-bottom: 20px;
			position: relative;
			transition: all 0.2s ease;
		}
		.cyber-card:hover {
			border-color: var(--text-muted);
		}
		.cyber-card.critical { border-left: 4px solid var(--critical); box-shadow: -4px 0 15px rgba(255, 51, 51, 0.2); }
		.cyber-card.high { border-left: 4px solid var(--high); box-shadow: -4px 0 15px rgba(255, 153, 0, 0.2); }
		.cyber-card.medium { border-left: 4px solid var(--medium); box-shadow: -4px 0 15px rgba(241, 196, 15, 0.2); }
		.cyber-card.low { border-left: 4px solid var(--low); box-shadow: -4px 0 15px rgba(0, 229, 255, 0.2); }

		/* Tech corner accents */
		.card-corner {
			position: absolute;
			width: 4px;
			height: 4px;
			background: var(--text-muted);
		}
		.tl { top: -1px; left: -1px; }
		.tr { top: -1px; right: -1px; }
		.bl { bottom: -1px; left: -1px; }
		.br { bottom: -1px; right: -1px; }

		.card-header {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-bottom: 12px;
			border-bottom: 1px dashed var(--border-dim);
			padding-bottom: 10px;
		}
		.cyber-badge {
			font-size: 0.75rem;
			font-weight: bold;
			padding: 2px 6px;
			letter-spacing: 1.5px;
			text-transform: uppercase;
		}
		.cyber-badge.critical { background: rgba(255, 51, 51, 0.15); color: var(--critical); border: 1px solid var(--critical); }
		.cyber-badge.high { background: rgba(255, 153, 0, 0.15); color: var(--high); border: 1px solid var(--high); }
		.cyber-badge.medium { background: rgba(241, 196, 15, 0.15); color: var(--medium); border: 1px solid var(--medium); }
		.cyber-badge.low { background: rgba(0, 229, 255, 0.15); color: var(--low); border: 1px solid var(--low); }

		.vuln-title {
			font-size: 0.95rem;
			font-weight: bold;
			letter-spacing: 0.5px;
			color: #fff;
		}
		.data-block {
			margin-bottom: 10px;
		}
		.data-label {
			font-size: 0.65rem;
			color: var(--text-muted);
			letter-spacing: 1.5px;
			display: block;
			margin-bottom: 2px;
		}
		p {
			margin: 0;
			font-size: 0.85rem;
			color: var(--text-main);
		}
		.fix-container {
			margin-top: 12px;
			background: #07090d;
			border: 1px solid var(--border-dim);
			padding: 10px;
		}
		pre {
			margin: 0;
			overflow-x: auto;
		}
		code {
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: 0.82rem;
			color: #00ff66;
		}
		.empty-state {
			border: 1px solid var(--low);
			background: rgba(0, 229, 255, 0.05);
			padding: 30px;
			text-align: center;
			color: var(--low);
			letter-spacing: 1px;
			font-size: 0.9rem;
		}
	</style>
</head>
<body>
	<div class="hud-header">
		<div class="hud-title">🛡️ SECURITY AUDIT COMPLETE</div>
		<div class="hud-meta">TARGET: ${escapeHtml(fileName)} // THREATS FOUND: ${blocks.length}</div>
	</div>
	${cardsHtml}
</body>
</html>`;
}

export function deactivate() {}