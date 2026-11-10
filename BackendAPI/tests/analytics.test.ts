import assert from 'assert';
import http from 'http';
import express from 'express';
import adminRoutes from '../src/routes/adminRoutes';

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);

let server: http.Server;
let port: number;

function request(path: string, options: http.RequestOptions = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode || 0,
              body: data ? JSON.parse(data) : {}
            });
          } catch {
            resolve({
              status: res.statusCode || 0,
              body: data
            });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('📊 Starting Analytics & Patch Compliance API Tests');
  console.log('====================================================\n');

  server = app.listen(0);
  const addr = server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Executive Summary
    // -------------------------------------------------------------------------
    console.log('Test 1: Executive Summary Endpoint');
    const execRes = await request('/api/v1/admin/analytics/executive-summary');
    assert.strictEqual(execRes.status, 200, 'Expected HTTP 200 for executive-summary');
    
    assert(execRes.body.fleet, 'Should include fleet stats');
    assert(execRes.body.fleet.totalAssets >= 3, 'Should have active assets');
    
    assert(execRes.body.osDistribution, 'Should include osDistribution');
    assert(Array.isArray(execRes.body.osDistribution.byFamily), 'byFamily should be array');
    console.log('  OS Distribution Families:', execRes.body.osDistribution.byFamily.map((f: any) => `${f.family}: ${f.machineCount} (${f.percentage}%)`));

    assert(execRes.body.patchCompliance, 'Should include patchCompliance');
    console.log('  Patch Compliance:', execRes.body.patchCompliance);
    assert(typeof execRes.body.patchCompliance.complianceRatePercent === 'number', 'Compliance rate should be number');

    assert(execRes.body.softwareTotals, 'Should include softwareTotals');
    console.log('  Software Totals (Deduplicated PCs):', execRes.body.softwareTotals);
    assert(typeof execRes.body.softwareTotals.microsoftOfficePcs === 'number');
    console.log('  ✅ [PASS] Executive Summary test passed.\n');

    // -------------------------------------------------------------------------
    // Test 2: Software License Counting & Deduplication
    // -------------------------------------------------------------------------
    console.log('Test 2: Software License Counting & Deduplication');
    const officeRes = await request('/api/v1/admin/analytics/software?search=office');
    assert.strictEqual(officeRes.status, 200, 'Expected HTTP 200 for software summary');
    
    console.log(`  Query "office" returned ${officeRes.body.software.length} software entries.`);
    console.log(`  Total Installations: ${officeRes.body.totalInstallations}`);
    console.log(`  Total Unique PCs (Deduplicated license seats): ${officeRes.body.totalUniquePcs}`);
    
    assert(officeRes.body.totalUniquePcs > 0, 'Unique PCs should be > 0');
    // If multiple office components (Word, Excel, Visio) exist on one machine,
    // totalInstallations MUST be strictly greater than or equal to totalUniquePcs!
    assert(
      officeRes.body.totalInstallations >= officeRes.body.totalUniquePcs,
      'Installations must be >= unique PCs (demonstrating deduplication)'
    );

    // Verify PC list structure
    const firstSw = officeRes.body.software[0];
    assert(firstSw.software_name, 'Should have software_name');
    assert(firstSw.software_category, 'Should have software_category');
    assert(Array.isArray(firstSw.installed_pcs), 'installed_pcs should be array');
    console.log('  Sample installed software:', `${firstSw.software_name} v${firstSw.software_version} (${firstSw.installed_count} PCs)`);
    console.log('  ✅ [PASS] Software License Counting & Deduplication test passed.\n');

    // -------------------------------------------------------------------------
    // Test 3: Windows Patch Compliance & Thai Recommendation Advisory
    // -------------------------------------------------------------------------
    console.log('Test 3: Windows Patch Compliance Advisory');
    const patchRes = await request('/api/v1/admin/analytics/patch-advisory');
    assert.strictEqual(patchRes.status, 200, 'Expected HTTP 200 for patch advisory');

    assert(patchRes.body.summary, 'Should include compliance summary');
    console.log('  Advisory Summary:', patchRes.body.summary);
    assert(Array.isArray(patchRes.body.advisories), 'Advisories should be array');
    assert(patchRes.body.advisories.length > 0, 'Should have advisory records');

    // Verify Thai recommendation strings and status codes
    const statusesFound = new Set(patchRes.body.advisories.map((a: any) => a.patch_status));
    console.log('  Patch Statuses in Fleet:', Array.from(statusesFound));

    patchRes.body.advisories.forEach((adv: any) => {
      assert(adv.hostname, 'Must have hostname');
      assert(adv.patch_status, 'Must have patch_status');
      assert(adv.recommendation_th, 'Must have Thai recommendation');
      // Thai text check: should contain Thai characters
      assert(/[\u0E00-\u0E7F]/.test(adv.recommendation_th), 'recommendation_th must contain Thai characters');
    });

    console.log('  Sample Advisory:');
    const sample = patchRes.body.advisories[0];
    console.log(`    Hostname: ${sample.hostname}`);
    console.log(`    OS: ${sample.os_name} (${sample.os_version || 'N/A'})`);
    console.log(`    Status: ${sample.patch_status}`);
    console.log(`    Recommendation (TH): ${sample.recommendation_th}`);
    console.log('  ✅ [PASS] Windows Patch Advisory test passed.\n');

    // -------------------------------------------------------------------------
    // Test 4: Status Filtering
    // -------------------------------------------------------------------------
    console.log('Test 4: Status Filtering (?status=CRITICAL_EOS)');
    const filteredRes = await request('/api/v1/admin/analytics/patch-advisory?status=CRITICAL_EOS');
    assert.strictEqual(filteredRes.status, 200);
    assert(filteredRes.body.advisories.length >= 1, 'Should find at least 1 CRITICAL_EOS workstation');
    filteredRes.body.advisories.forEach((adv: any) => {
      assert.strictEqual(adv.patch_status, 'CRITICAL_EOS', 'Only CRITICAL_EOS should be returned');
    });
    console.log(`  Filtered CRITICAL_EOS machines count: ${filteredRes.body.advisories.length}`);
    console.log(`  Sample CRITICAL_EOS advisory: ${filteredRes.body.advisories[0].hostname} -> ${filteredRes.body.advisories[0].recommendation_th}`);
    console.log('  ✅ [PASS] Status filtering test passed.\n');

    console.log('====================================================');
    console.log('🎉 All Analytics & Patch Compliance Tests Passed!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
