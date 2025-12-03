// /srv/backend/scripts/applyPatch.cjs

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve('/srv/backend');
const PATCH_DIR = path.join(PROJECT_ROOT, 'ChatGPT_Patches');

function usage() {
    console.log('Usage: node applyPatch.cjs <patch-file-name | latest>');
    console.log('Example A: node applyPatch.cjs poller_patch_2025-11-30.json');
    console.log('Example B: node applyPatch.cjs latest');
    process.exit(1);
}

// helper: is this entry a candidate patch container?
function isPatchContainer(entry) {
    const name = entry.name;
    if (name.startsWith('.')) return false; // ignore .DS_Store, ._files, etc

    if (entry.isDir && name.endsWith('.json.download')) return true;
    if (!entry.isDir && name.endsWith('.json')) return true;

    return false;
}

// helper: given a path that might be a .download folder, return the real .json file inside
function resolveContainerToJson(p) {
    const stat = fs.statSync(p);

    if (!stat.isDirectory()) {
        // plain .json file
        return p;
    }

    // Safari .download directory - look inside for a non-hidden .json
    const entries = fs.readdirSync(p);
    const jsonName = entries.find(
        f => !f.startsWith('.') && f.endsWith('.json')
    );

    if (!jsonName) {
        throw new Error(`Directory ${p} does not contain a visible .json file`);
    }

    return path.join(p, jsonName);
}

let patchFileName = process.argv[2];
if (!patchFileName) {
    console.error('Error: no patch file name provided.');
    usage();
}

// mode 1: auto pick latest
if (patchFileName === 'latest') {
    const names = fs.readdirSync(PATCH_DIR);
    const entries = names.map(name => {
        const full = path.join(PATCH_DIR, name);
        const stat = fs.statSync(full);
        return {
            name,
            full,
            isDir: stat.isDirectory(),
            time: stat.mtimeMs,
        };
    }).filter(isPatchContainer);

    if (entries.length === 0) {
        console.error('Error: no patch containers (.json or .json.download) found in ChatGPT_Patches.');
        process.exit(1);
    }

    entries.sort((a, b) => b.time - a.time);
    const chosen = entries[0];
    patchFileName = chosen.name;
    console.log(`Auto-selected latest patch container: ${patchFileName}`);

    let patchPath = chosen.full;
    try {
        patchPath = resolveContainerToJson(patchPath);
        runPatch(patchPath);
    } catch (err) {
        console.error('Error resolving or applying patch:', err.message);
        process.exit(1);
    }

} else {
    // mode 2: explicit filename
    let containerPath = path.isAbsolute(patchFileName)
        ? patchFileName
        : path.join(PATCH_DIR, patchFileName);

    if (!fs.existsSync(containerPath)) {
        console.error(`Error: patch path not found: ${containerPath}`);
        process.exit(1);
    }

    try {
        const patchPath = resolveContainerToJson(containerPath);
        runPatch(patchPath);
    } catch (err) {
        console.error('Error resolving or applying patch:', err.message);
        process.exit(1);
    }
}

function runPatch(patchPath) {
    console.log(`Using patch file: ${patchPath}`);

    let patch;
    try {
        const raw = fs.readFileSync(patchPath, 'utf8');
        patch = JSON.parse(raw);
    } catch (err) {
        console.error('Error reading or parsing patch file:', err.message);
        process.exit(1);
    }

    if (
        !patch.target ||
        !patch.content ||
        typeof patch.target !== 'string' ||
        typeof patch.content !== 'string'
    ) {
        console.error('Error: patch file must have string fields "target" and "content".');
        process.exit(1);
    }

    const targetPath = path.resolve(PROJECT_ROOT, patch.target);

    if (!targetPath.startsWith(PROJECT_ROOT + path.sep)) {
        console.error('Error: target path escapes project root. Aborting.');
        process.exit(1);
    }

    const backupPath = targetPath + '.bak.' + Date.now();
    if (fs.existsSync(targetPath)) {
        fs.copyFileSync(targetPath, backupPath);
        console.log(`Backup created: ${backupPath}`);
    } else {
        console.log('Note: target file did not exist. No backup created.');
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, patch.content, 'utf8');
    console.log(`Patched: ${targetPath}`);
    console.log('Done.');
}
