#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('🧪 Running Database Tests Summary\n');

const databases = [
  { name: 'SQLite', script: 'test:sqlite' },
  { name: 'MySQL', script: 'test:mysql' },
  { name: 'PostgreSQL', script: 'test:postgresql' },
  { name: 'MongoDB', script: 'test:mongodb' }
];

const results = [];

databases.forEach(db => {
  console.log(`\n📊 Testing ${db.name}...`);
  try {
    const output = execSync(`npm run ${db.script} -- --reporter=json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    try {
      const jsonResult = JSON.parse(output);
      const passed = jsonResult.testResults[0].assertionResults.filter(r => r.status === 'passed').length;
      const failed = jsonResult.testResults[0].assertionResults.filter(r => r.status === 'failed').length;
      const total = passed + failed;
      
      results.push({
        database: db.name,
        passed,
        failed,
        total,
        percentage: Math.round((passed / total) * 100)
      });
      
      console.log(`✅ ${passed}/${total} tests passing (${Math.round((passed / total) * 100)}%)`);
    } catch (parseError) {
      // Fallback for non-JSON output
      const match = output.match(/(\d+) failed.*?(\d+) passed.*?\((\d+)\)/);
      if (match) {
        const failed = parseInt(match[1]) || 0;
        const passed = parseInt(match[2]) || 0;
        const total = parseInt(match[3]) || 0;
        
        results.push({
          database: db.name,
          passed,
          failed,
          total,
          percentage: Math.round((passed / total) * 100)
        });
        
        console.log(`✅ ${passed}/${total} tests passing (${Math.round((passed / total) * 100)}%)`);
      }
    }
  } catch (error) {
    console.log(`❌ Error running ${db.name} tests`);
    results.push({
      database: db.name,
      passed: 0,
      failed: 0,
      total: 0,
      percentage: 0,
      error: true
    });
  }
});

console.log('\n\n📈 Summary Report');
console.log('═══════════════════════════════════════════════════');
console.log('Database     | Passed | Failed | Total | Coverage');
console.log('─────────────┼────────┼────────┼───────┼──────────');

results.forEach(r => {
  const status = r.error ? '❌' : (r.percentage === 100 ? '✅' : '⚠️ ');
  console.log(
    `${status} ${r.database.padEnd(9)} | ${r.passed.toString().padStart(6)} | ${r.failed.toString().padStart(6)} | ${r.total.toString().padStart(5)} | ${r.percentage.toString().padStart(7)}%`
  );
});

console.log('═══════════════════════════════════════════════════');

const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
const totalTests = totalPassed + totalFailed;
const totalPercentage = Math.round((totalPassed / totalTests) * 100);

console.log(
  `TOTAL        | ${totalPassed.toString().padStart(6)} | ${totalFailed.toString().padStart(6)} | ${totalTests.toString().padStart(5)} | ${totalPercentage.toString().padStart(7)}%`
);
console.log('═══════════════════════════════════════════════════\n');

if (totalFailed > 0) {
  console.log(`⚠️  ${totalFailed} tests are failing across all databases`);
  console.log('\nKnown Issues:');
  console.log('- MongoDB: Missing Ids.objectID function implementation');
  console.log('- PostgreSQL: Non-UUID string format in ID tests');
  console.log('- SQLite: Relation entities commented out');
} else {
  console.log('✅ All tests passing!');
}

process.exit(totalFailed > 0 ? 1 : 0);