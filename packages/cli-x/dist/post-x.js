import { execSync } from 'node:child_process';
export function buildAgentBrowserCommands(options) {
    const { sessionPath, input } = options;
    const tagsText = input.tags.map(t => `#${t}`).join(' ');
    const fullBody = `${input.body} ${tagsText}`.trim();
    return [
        `agent-browser --state "${sessionPath}" open "https://x.com/compose/tweet"`,
        `agent-browser wait --load networkidle`,
        `agent-browser snapshot -i`,
        `agent-browser fill @tweet-input "${fullBody.replace(/"/g, '\\"')}"`,
        `agent-browser click @post-btn`,
        `agent-browser wait --load networkidle`,
        `agent-browser snapshot`,
    ];
}
export async function postToX(input, sessionPath) {
    const commands = buildAgentBrowserCommands({ sessionPath, input });
    for (const cmd of commands.slice(0, -1)) {
        execSync(cmd, { stdio: 'inherit' });
    }
    const snapshotOutput = execSync(commands[commands.length - 1], {
        encoding: 'utf8',
    });
    const urlMatch = /url:\s*(https?:\/\/[^\s]+)/i.exec(snapshotOutput);
    const postUrl = urlMatch?.[1] ?? 'https://x.com';
    return {
        postUrl,
        publishedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=post-x.js.map