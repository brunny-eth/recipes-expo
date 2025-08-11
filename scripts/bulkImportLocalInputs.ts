import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import { spawnSync } from 'child_process';
import { randomUUID, createHash } from 'crypto';
import { parseAndCacheRecipe } from '../server/services/parseRecipe';
import { parseImageRecipe } from '../server/services/parseImageRecipe';

type CliArgs = {
  userId: string;
  folderId?: string;
  folderName?: string;
  dir?: string;
  urlsFile?: string;
  delayMs: number;
  max: number;
  recursive: boolean;
};

type ImportItem = { kind: 'url'; value: string } | { kind: 'file'; value: string };

function parseArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.substring(prefix.length) : undefined;
}

function readCliArgs(): CliArgs {
  const userId = parseArg('user-id') || '';
  const folderId = parseArg('folder-id');
  const folderName = parseArg('folder-name');
  const dir = parseArg('dir');
  const urlsFile = parseArg('urls-file');
  const delayMs = Number(parseArg('delay-ms') || '1500');
  const max = Math.min(100, Number(parseArg('max') || '100'));
  const recursive = (parseArg('recursive') || 'true').toLowerCase() !== 'false';

  if (!userId) {
    throw new Error('Missing required --user-id');
  }
  if (!dir && !urlsFile) {
    throw new Error('Provide at least one of --dir or --urls-file');
  }

  return { userId, folderId, folderName, dir, urlsFile, delayMs, max, recursive };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSupportedFileExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
}

function guessMimeType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return null;
  }
}

async function getOrCreateFolder(userId: string, folderId?: string, folderName?: string): Promise<number> {
  if (folderId) {
    const { data, error } = await supabaseAdmin
      .from('user_saved_folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Folder ${folderId} not found or not owned by user`);
    return Number(data.id);
  }

  if (!folderName) {
    throw new Error('Provide either --folder-id or --folder-name');
  }

  // Check if a folder with this name already exists for the user
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('user_saved_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('name', folderName)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) return Number(existing.id);

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('user_saved_folders')
    .insert({ user_id: userId, name: folderName })
    .select('id')
    .single();
  if (insertErr) throw insertErr;
  return Number(inserted.id);
}

async function linkRecipeToUserFolder(userId: string, recipeId: number, folderId: number) {
  // Check if already linked
  const { data: existing, error: checkErr } = await supabaseAdmin
    .from('user_saved_recipes')
    .select('base_recipe_id')
    .eq('user_id', userId)
    .eq('folder_id', folderId)
    .eq('base_recipe_id', recipeId)
    .maybeSingle();
  if (checkErr) throw checkErr;
  if (existing) return; // already linked

  const { error: insertErr } = await supabaseAdmin
    .from('user_saved_recipes')
    .insert({ user_id: userId, folder_id: folderId, base_recipe_id: recipeId });
  if (insertErr) throw insertErr;
}

function listFiles(startDir: string, recursive: boolean): string[] {
  const files: string[] = [];
  const stack: string[] = [startDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(current);
    } catch (e) {
      console.warn(`[DIR] Skipping unreadable directory: ${current}`);
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isFile()) {
        files.push(full);
      } else if (recursive && stat.isDirectory()) {
        stack.push(full);
      }
    }
  }
  return files;
}

async function collectInputs(dir?: string, urlsFile?: string, max: number = 100, recursive: boolean = true): Promise<ImportItem[]> {
  const items: ImportItem[] = [];

  if (urlsFile) {
    const fileContent = fs.readFileSync(urlsFile, 'utf8');
    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (const l of lines) {
      if (l.startsWith('http://') || l.startsWith('https://')) {
        items.push({ kind: 'url', value: l });
      } else if (fs.existsSync(l)) {
        // Allow file paths inside the URLs file for convenience
        items.push({ kind: 'file', value: l });
      } else {
        console.warn(`Skipping invalid line in URLs file: ${l}`);
      }
      if (items.length >= max) break;
    }
  }

  if (dir) {
    const expanded = dir.replace(/^~\//, `${process.env.HOME || ''}/`);
    if (!fs.existsSync(expanded)) {
      console.error(`[DIR] Path does not exist: ${expanded}`);
    } else {
      const allFiles = listFiles(expanded, recursive);
      const supported = allFiles.filter(isSupportedFileExtension);
      console.log(`[DIR] Found ${allFiles.length} files (${supported.length} supported types)`);
      for (const full of supported) {
        items.push({ kind: 'file', value: full });
        if (items.length >= max) break;
      }
    }
  }

  // Cap to max items
  return items.slice(0, max);
}

async function processUrl(url: string): Promise<number | null> {
  try {
    const result = await parseAndCacheRecipe(url);
    if (result.error || !result.recipe) {
      console.error(`[URL] Failed: ${url} -> ${result.error?.message || 'unknown error'}`);
      return null;
    }
    const recipeId = (result.recipe as any).id as number | undefined;
    if (!recipeId) {
      console.error(`[URL] No recipe ID returned for: ${url}`);
      return null;
    }
    return recipeId;
  } catch (err: any) {
    console.error(`[URL] Exception for ${url}:`, err?.message || err);
    return null;
  }
}

async function processFile(filePath: string): Promise<number | null> {
  const mimeType = guessMimeType(filePath);
  if (!mimeType) {
    console.warn(`[FILE] Skipping unsupported type: ${filePath}`);
    return null;
  }
  try {
    // For PDFs, render all pages to images and use multi-image parsing for better accuracy
    if (mimeType === 'application/pdf') {
      const tmpId = randomUUID();
      const outputPattern = `/tmp/bulkimport-${tmpId}-%03d.jpg`;
      // Render all pages using ImageMagick's convert
      const conv = spawnSync('convert', ['-density', '300', filePath, '-quality', '85', outputPattern], { stdio: 'inherit' });
      if (conv.status !== 0) {
        console.error(`[FILE] ImageMagick convert failed for ${filePath} (status ${conv.status})`);
        return null;
      }
      // Collect rendered images
      const tmpDir = '/tmp';
      const files = fs.readdirSync(tmpDir)
        .filter(f => f.startsWith(`bulkimport-${tmpId}-`) && f.endsWith('.jpg'))
        .map(f => path.join(tmpDir, f))
        .sort();
      if (files.length === 0) {
        console.error(`[FILE] No pages rendered for PDF: ${filePath}`);
        return null;
      }
      console.log(`[FILE] Rendered ${files.length} page(s) for PDF: ${path.basename(filePath)}`);
      const images = files.map(fp => {
        const buf = fs.readFileSync(fp);
        return { mimeType: 'image/jpeg', data: buf.toString('base64') };
      });
      // Generate a request id for tracing
      const requestId = createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 12);
      const result = await parseImageRecipe(images as any, requestId, { uploadCoverImage: true, imageConfidence: 'high' });
      // Cleanup temp files
      files.forEach(fp => { try { fs.unlinkSync(fp); } catch {} });
      if (result.error || !result.recipe) {
        console.error(`[FILE] Failed: ${filePath} -> ${result.error?.message || 'unknown error'}`);
        return null;
      }
      const recipeId = (result.recipe as any).id as number | undefined;
      if (!recipeId) {
        console.error(`[FILE] No recipe ID returned for: ${filePath}`);
        return null;
      }
      return recipeId;
    }

    // Non-PDF images: send buffer directly
    const buffer = fs.readFileSync(filePath);
    const requestId = createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').substring(0, 12);
    const result = await parseImageRecipe(buffer, mimeType, requestId, { uploadCoverImage: true });
    if (result.error || !result.recipe) {
      console.error(`[FILE] Failed: ${filePath} -> ${result.error?.message || 'unknown error'}`);
      return null;
    }
    const recipeId = (result.recipe as any).id as number | undefined;
    if (!recipeId) {
      console.error(`[FILE] No recipe ID returned for: ${filePath}`);
      return null;
    }
    return recipeId;
  } catch (err: any) {
    console.error(`[FILE] Exception for ${filePath}:`, err?.message || err);
    return null;
  }
}

async function main() {
  const args = readCliArgs();
  console.log('Bulk Import: starting with args:', args);

  const folderId = await getOrCreateFolder(args.userId, args.folderId, args.folderName);
  console.log(`Using folder ID: ${folderId}`);

  const inputs = await collectInputs(args.dir, args.urlsFile, args.max, args.recursive);
  if (inputs.length === 0) {
    console.log('No inputs found. Nothing to do.');
    return;
  }
  console.log(`Found ${inputs.length} inputs to process (max ${args.max}).`);

  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;

  for (const item of inputs) {
    processedCount++;
    let recipeId: number | null = null;
    if (item.kind === 'url') {
      console.log(`[${processedCount}/${inputs.length}] URL: ${item.value}`);
      recipeId = await processUrl(item.value);
    } else {
      console.log(`[${processedCount}/${inputs.length}] FILE: ${item.value}`);
      recipeId = await processFile(item.value);
    }

    if (recipeId) {
      try {
        await linkRecipeToUserFolder(args.userId, recipeId, folderId);
        console.log(`  -> Linked recipe ${recipeId} to folder ${folderId}`);
        successCount++;
      } catch (linkErr: any) {
        console.error(`  -> Failed to link recipe ${recipeId}:`, linkErr?.message || linkErr);
        failCount++;
      }
    } else {
      failCount++;
    }

    await sleep(args.delayMs);
  }

  console.log('\nSUMMARY');
  console.log('=======');
  console.log(`Total:    ${inputs.length}`);
  console.log(`Success:  ${successCount}`);
  console.log(`Failed:   ${failCount}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

