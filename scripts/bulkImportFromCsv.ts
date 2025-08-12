import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import { parseAndCacheRecipe } from '../server/services/parseRecipe';

type CliArgs = {
  userId: string;
  csvPath: string;
  delayMs: number;
  maxTotal: number;
  maxPerSection: number;
  dryRun: boolean;
  singleColumn: boolean;
  onlySection?: string;
};

type SectionToUrls = Record<string, string[]>;

function parseArg(flag: string): string | undefined {
  const prefix = `--${flag}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.substring(prefix.length) : undefined;
}

function readCliArgs(): CliArgs {
  const userId = parseArg('user-id') || '';
  const csvPath = parseArg('csv') || '';
  const delayMs = Number(parseArg('delay-ms') || '1000');
  const maxTotal = Number(parseArg('max-total') || '100000');
  const maxPerSection = Number(parseArg('max-per-section') || '100000');
  const dryRun = (parseArg('dry-run') || 'false').toLowerCase() === 'true';
  const singleColumn = (parseArg('single-column') || 'false').toLowerCase() === 'true';
  const onlySection = parseArg('only-section');

  if (!userId) throw new Error('Missing required --user-id');
  if (!csvPath) throw new Error('Missing required --csv=/path/to/file.csv');
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  return { userId, csvPath, delayMs, maxTotal, maxPerSection, dryRun, singleColumn, onlySection };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Detect layout and build section -> urls mapping
function loadSections(csvPath: string, singleColumn: boolean): SectionToUrls {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const records: string[][] = parse(raw, { skip_empty_lines: false });
  if (records.length === 0) return {};

  const header = records[0].map((h) => (h || '').trim());
  const lowerHeader = header.map((h) => h.toLowerCase());

  const sectionToUrls: SectionToUrls = {};

  // Format C: single-column with in-line section markers (non-URL rows), URLs beneath until next marker/blank
  if (singleColumn || header.length === 1) {
    let currentSection: string | null = null;
    for (let r = 0; r < records.length; r++) {
      const cell = (records[r]?.[0] || '').trim();
      if (!cell) continue; // skip blank separators
      const isUrl = /^https?:\/\//i.test(cell);
      const isNotFound = /^not\s*found$/i.test(cell);
      if (isNotFound) continue;
      if (!isUrl) {
        currentSection = cell;
        if (!sectionToUrls[currentSection]) sectionToUrls[currentSection] = [];
      } else {
        const section = currentSection || 'Uncategorized';
        if (!sectionToUrls[section]) sectionToUrls[section] = [];
        sectionToUrls[section].push(cell);
      }
    }
    return sectionToUrls;
  }

  // Format A: two columns named section/url (case-insensitive), optional title column
  const sectionIdx = lowerHeader.findIndex((h) => ['section', 'folder', 'category'].includes(h));
  const urlIdx = lowerHeader.findIndex((h) => ['url', 'link'].includes(h));
  if (sectionIdx >= 0 && urlIdx >= 0) {
    for (let r = 1; r < records.length; r++) {
      const row = records[r];
      const section = (row[sectionIdx] || '').trim();
      const url = (row[urlIdx] || '').trim();
      if (!section || !url) continue;
      if (/^not\s*found$/i.test(url)) continue; // literal "Not Found"
      if (!/^https?:\/\//i.test(url)) continue; // ensure URL-like
      if (!sectionToUrls[section]) sectionToUrls[section] = [];
      sectionToUrls[section].push(url);
    }
    return sectionToUrls;
  }

  // Format B: columns are sections, cells are URLs
  for (let c = 0; c < header.length; c++) {
    const section = header[c] || `Section ${c + 1}`;
    for (let r = 1; r < records.length; r++) {
      const cell = (records[r]?.[c] || '').trim();
      if (!cell) continue;
      if (/^not\s*found$/i.test(cell)) continue;
      if (!/^https?:\/\//i.test(cell)) continue;
      if (!sectionToUrls[section]) sectionToUrls[section] = [];
      sectionToUrls[section].push(cell);
    }
  }

  return sectionToUrls;
}

async function getOrCreateFolder(userId: string, name: string): Promise<number> {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('user_saved_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) return Number(existing.id);

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('user_saved_folders')
    .insert({ user_id: userId, name })
    .select('id')
    .single();
  if (insertErr) throw insertErr;
  return Number(inserted.id);
}

async function linkRecipeToUserFolder(userId: string, recipeId: number, folderId: number) {
  const { data: existing, error: checkErr } = await supabaseAdmin
    .from('user_saved_recipes')
    .select('base_recipe_id')
    .eq('user_id', userId)
    .eq('folder_id', folderId)
    .eq('base_recipe_id', recipeId)
    .maybeSingle();
  if (checkErr) throw checkErr;
  if (existing) return;
  const { error: insertErr } = await supabaseAdmin
    .from('user_saved_recipes')
    .insert({ user_id: userId, folder_id: folderId, base_recipe_id: recipeId });
  if (insertErr) throw insertErr;
}

async function processUrl(url: string): Promise<number | null> {
  try {
    const result = await parseAndCacheRecipe(url);
    if (result.error || !result.recipe) return null;
    const recipeId = (result.recipe as any).id as number | undefined;
    return recipeId || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = readCliArgs();
  console.log('CSV Import: starting with args:', args);

  const sectionToUrls = loadSections(args.csvPath, args.singleColumn);
  let sections = Object.keys(sectionToUrls);
  if (args.onlySection) {
    sections = sections.filter((s) => s === args.onlySection);
  }
  console.log(`Found ${sections.length} section(s).`);
  let totalPlanned = 0;
  for (const s of sections) {
    totalPlanned += Math.min(sectionToUrls[s].length, args.maxPerSection);
  }
  console.log(`Planned URLs: up to ${Math.min(totalPlanned, args.maxTotal)} total.`);

  if (args.dryRun) {
    sections.slice(0, 5).forEach((s) => {
      const sample = sectionToUrls[s].slice(0, 5);
      console.log(`Section: ${s} (count=${sectionToUrls[s].length}) sample=`, sample);
    });
    return;
  }

  let processed = 0, successes = 0, failures = 0;

  for (const section of sections) {
    const folderId = await getOrCreateFolder(args.userId, section);
    console.log(`\nSection: ${section} -> folder ${folderId}`);
    const urls = sectionToUrls[section].slice(0, args.maxPerSection);
    for (const url of urls) {
      if (processed >= args.maxTotal) break;
      processed++;
      console.log(`[${processed}] ${url}`);
      const recipeId = await processUrl(url);
      if (recipeId) {
        try {
          await linkRecipeToUserFolder(args.userId, recipeId, folderId);
          console.log(`  -> Linked recipe ${recipeId} to folder ${folderId}`);
          successes++;
        } catch (e: any) {
          console.error('  -> Link failed:', e?.message || e);
          failures++;
        }
      } else {
        console.warn('  -> Parse failed, skipping');
        failures++;
      }
      await sleep(args.delayMs);
    }
  }

  console.log('\nSUMMARY');
  console.log('=======');
  console.log(`Processed: ${processed}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures:  ${failures}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

