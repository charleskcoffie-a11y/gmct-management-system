// Node backup script to download all entries and members locally as JSON
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SUPABASE_URL = 'https://hxgojapfsqsmwveaszvn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Z29qYXBmc3FzbXd2ZWFzenZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTU5MTUsImV4cCI6MjA3ODc5MTkxNX0.smrff1lRtkK9E0SroEf7TUhpyTHPc6S9InK0vJjqs_8';

async function backupTable(tableName) {
    console.log(`Downloading ${tableName}...`);
    let allRows = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Range: `${from}-${to}`,
                'Range-Unit': 'items',
            },
        });

        if (!res.ok) {
            console.warn(`Could not fetch ${tableName}: ${res.statusText}`);
            return null;
        }

        const data = await res.json();
        allRows = allRows.concat(data);

        if (data.length < pageSize) {
            hasMore = false;
        } else {
            page++;
        }
    }

    return allRows;
}

async function runBackup() {
    const backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(backupDir, `backup-${timestamp}`);
    fs.mkdirSync(backupFolder, { recursive: true });

    const tables = ['entries', 'members', 'app_users', 'harvest_pledges', 'requisitions', 'weekly_history'];
    const summary = {};

    for (const table of tables) {
        const data = await backupTable(table);
        if (data) {
            const filePath = path.join(backupFolder, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            summary[table] = data.length;
            console.log(`✓ Saved ${data.length} records to ${filePath}`);
        }
    }

    console.log('\nBackup Complete! Summary:', summary);
    console.log(`Saved in: ${backupFolder}`);
}

runBackup().catch(err => console.error('Backup error:', err));
