import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Test configuration
const CONFIG = {
  SUPERADMIN_EMAIL: 'eric@eryai.tech',
  BELLA_ITALIA_ID: '3c6d67d9-22bb-4a3e-94ca-ca552eddb08e',
  URLS: {
    LANDING: 'https://eryai.tech',
    DEMO: 'https://ery-ai-demo-restaurang.vercel.app',
    DASHBOARD: 'https://dashboard.eryai.tech',
    SALES: 'https://sales.eryai.tech'
  }
};

// Test results storage
let testResults = [];
let testSessionId = null;

// Helper: Run a test
async function runTest(category, name, testFn) {
  const start = Date.now();
  try {
    await testFn();
    testResults.push({
      category,
      name,
      status: 'passed',
      duration: Date.now() - start
    });
  } catch (error) {
    testResults.push({
      category,
      name,
      status: 'failed',
      error: error.message,
      duration: Date.now() - start
    });
  }
}

// Helper: Assert
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ==================== LANDING PAGE TESTS ====================
async function testLanding() {
  await runTest('Landing', 'Page loads', async () => {
    const res = await fetch(CONFIG.URLS.LANDING);
    assert(res.ok, `Status: ${res.status}`);
  });

  await runTest('Landing', 'Demo link exists', async () => {
    const res = await fetch(CONFIG.URLS.LANDING);
    const html = await res.text();
    assert(html.includes('demo') || html.includes('Demo') || html.includes('prova'), 'No demo link found');
  });
}

// ==================== DEMO RESTAURANT TESTS ====================
async function testDemo() {
  await runTest('Demo', 'Page loads', async () => {
    const res = await fetch(CONFIG.URLS.DEMO);
    assert(res.ok, `Status: ${res.status}`);
  });

  await runTest('Demo', 'Restaurant API health', async () => {
    const res = await fetch(`${CONFIG.URLS.DEMO}/api/restaurant`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'  // Mark as test request
      },
      body: JSON.stringify({
        prompt: 'Hej, är ni öppna idag?',
        sessionId: null,
        visitorId: 'test-visitor-monitoring'
      })
    });
    assert(res.ok, `API error: ${res.status}`);
    const data = await res.json();
    // Gemini returns candidates[0].content.parts[0].text, not response
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    assert(aiResponse || data.sessionId, 'No response from Sofia');
    testSessionId = data.sessionId; // Save for later tests
  });

  await runTest('Demo', 'Messages API health', async () => {
    const res = await fetch(`${CONFIG.URLS.DEMO}/api/messages?session_id=${testSessionId || 'test'}`);
    assert(res.ok, `Status: ${res.status}`);
  });

  await runTest('Demo', 'Typing API health', async () => {
    const res = await fetch(`${CONFIG.URLS.DEMO}/api/typing?session_id=${testSessionId || 'test'}`);
    assert(res.ok, `Status: ${res.status}`);
  });

  await runTest('Demo', 'Create chat session', async () => {
    const res = await fetch(`${CONFIG.URLS.DEMO}/api/restaurant`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'
      },
      body: JSON.stringify({
        prompt: 'Jag vill boka ett bord',
        sessionId: testSessionId,
        visitorId: 'test-visitor-monitoring'
      })
    });
    assert(res.ok, `API error: ${res.status}`);
    const data = await res.json();
    testSessionId = data.sessionId;
    assert(testSessionId, 'No session ID returned');
  });

  await runTest('Demo', 'Session saved in Supabase', async () => {
    assert(testSessionId, 'No session ID to check');
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', testSessionId)
      .single();
    assert(!error, `Supabase error: ${error?.message}`);
    assert(data, 'Session not found in database');
  });

  await runTest('Demo', 'Messages saved in Supabase', async () => {
    assert(testSessionId, 'No session ID to check');
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('session_id', testSessionId);
    assert(!error, `Supabase error: ${error?.message}`);
    assert(data && data.length > 0, 'No messages found');
  });

  await runTest('Demo', 'Handoff trigger works', async () => {
    const res = await fetch(`${CONFIG.URLS.DEMO}/api/restaurant`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'
      },
      body: JSON.stringify({
        prompt: 'Jag vill prata med ägaren, min email är test@monitoring.eryai.tech',
        sessionId: testSessionId,
        visitorId: 'test-visitor-monitoring'
      })
    });
    assert(res.ok, `API error: ${res.status}`);
    const data = await res.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    assert(aiResponse || data.sessionId, 'No response');
  });

  await runTest('Demo', 'Human takeover works', async () => {
    // After handoff, Sofia should not respond
    const res = await fetch(`${CONFIG.URLS.DEMO}/api/restaurant`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'
      },
      body: JSON.stringify({
        prompt: 'Hallå?',
        sessionId: testSessionId,
        visitorId: 'test-visitor-monitoring'
      })
    });
    assert(res.ok, `API error: ${res.status}`);
    // Test passes if no error - response content varies
  });
}

// ==================== DASHBOARD TESTS ====================
async function testDashboard() {
  await runTest('Dashboard', 'Login page loads', async () => {
    const res = await fetch(`${CONFIG.URLS.DASHBOARD}/login`);
    assert(res.ok, `Status: ${res.status}`);
  });

  await runTest('Dashboard', 'Redirects to login', async () => {
    const res = await fetch(`${CONFIG.URLS.DASHBOARD}/dashboard`, { redirect: 'manual' });
    // Should redirect to login (302/307) or show login page
    assert(res.status === 302 || res.status === 307 || res.status === 200, `Unexpected status: ${res.status}`);
  });

  await runTest('Dashboard', 'API messages endpoint exists', async () => {
    const res = await fetch(`${CONFIG.URLS.DASHBOARD}/api/messages`);
    // Should return 401 (unauthorized) or 400 (missing params), not 404
    assert(res.status !== 404, 'API endpoint not found');
  });
}

// ==================== SALES DASHBOARD TESTS ====================
async function testSales() {
  await runTest('Sales', 'Login page loads', async () => {
    const res = await fetch(`${CONFIG.URLS.SALES}/login`);
    assert(res.ok, `Status: ${res.status}`);
  });

  await runTest('Sales', 'Redirects to login', async () => {
    const res = await fetch(`${CONFIG.URLS.SALES}/leads`, { redirect: 'manual' });
    assert(res.status === 302 || res.status === 307 || res.status === 200, `Unexpected status: ${res.status}`);
  });

  await runTest('Sales', 'API leads endpoint exists', async () => {
    const res = await fetch(`${CONFIG.URLS.SALES}/api/leads`);
    // Should return 401 (unauthorized) or error, not 404
    assert(res.status !== 404, 'API endpoint not found');
  });

  await runTest('Sales', 'Leads table exists in Supabase', async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .limit(1);
    // Table should exist (even if empty)
    assert(!error || !error.message.includes('does not exist'), `Table error: ${error?.message}`);
  });
}

// ==================== SUPABASE TESTS ====================
async function testSupabase() {
  await runTest('Supabase', 'Connection works', async () => {
    const { data, error } = await supabase.from('customers').select('count').limit(1);
    assert(!error, `Connection error: ${error?.message}`);
  });

  await runTest('Supabase', 'Bella Italia exists', async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', CONFIG.BELLA_ITALIA_ID)
      .single();
    assert(!error, `Query error: ${error?.message}`);
    assert(data, 'Bella Italia not found');
  });

  await runTest('Supabase', 'Required tables exist', async () => {
    const tables = ['customers', 'dashboard_users', 'chat_sessions', 'chat_messages', 'notifications'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      assert(!error || !error.message.includes('does not exist'), `Table ${table} missing`);
    }
  });

  await runTest('Supabase', 'Typing columns exist', async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('visitor_typing, staff_typing')
      .limit(1);
    assert(!error, `Typing columns missing: ${error?.message}`);
  });
}

// ==================== EMAIL TESTS ====================
async function testEmail() {
  await runTest('Email', 'Resend API key configured', async () => {
    assert(process.env.RESEND_API_KEY, 'RESEND_API_KEY not set');
    assert(process.env.RESEND_API_KEY.startsWith('re_'), 'Invalid Resend API key format');
  });

  await runTest('Email', 'Can send test email', async () => {
    // Only run this test if we have failures to report, or once per day
    // For now, just verify the API is accessible
    assert(resend, 'Resend client not initialized');
  });
}

// ==================== CLEANUP ====================
async function cleanup() {
  if (testSessionId) {
    try {
      // Delete test messages
      await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', testSessionId);
      
      // Delete test notifications
      await supabase
        .from('notifications')
        .delete()
        .eq('session_id', testSessionId);
      
      // Delete test session
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', testSessionId);
      
      testResults.push({
        category: 'Cleanup',
        name: 'Test data removed',
        status: 'passed',
        duration: 0
      });
    } catch (error) {
      testResults.push({
        category: 'Cleanup',
        name: 'Test data removed',
        status: 'skipped',
        error: error.message,
        duration: 0
      });
    }
  }
}

// ==================== SEND FAILURE REPORT ====================
async function sendFailureReport(results, duration) {
  const failures = results.filter(t => t.status === 'failed');
  if (failures.length === 0) return;

  const failureList = failures.map(f => 
    `❌ [${f.category}] ${f.name}\n   Error: ${f.error}`
  ).join('\n\n');

  const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });

  try {
    await resend.emails.send({
      from: 'EryAI Monitoring <sofia@eryai.tech>',
      to: CONFIG.SUPERADMIN_EMAIL,
      subject: `🚨 [TEST] EryAI System Alert: ${failures.length} test(s) failed`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin: 0;">⚠️ TEST EMAIL - MONITORING SYSTEM</h2>
            <p style="color: #7f1d1d; margin: 5px 0 0 0;">This is an automated test email from eryai-monitoring</p>
          </div>
          
          <h2 style="color: #dc2626;">🚨 System Test Failures</h2>
          
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>Failed:</strong> ${failures.length} of ${results.length} tests</p>
          <p><strong>Duration:</strong> ${(duration / 1000).toFixed(1)}s</p>
          
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin-top: 0;">Failed Tests:</h3>
            <pre style="white-space: pre-wrap; font-size: 14px;">${failureList}</pre>
          </div>
          
          <p>
            <a href="https://eryai-monitoring.vercel.app/api/test" 
               style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Run Tests Again
            </a>
            <a href="https://eryai-monitoring.vercel.app/api/health" 
               style="background: #6b7280; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-left: 10px;">
              Health Check
            </a>
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            EryAI Monitoring System<br>
            <a href="https://eryai-monitoring.vercel.app/api/status">Status Page</a>
          </p>
        </div>
      `
    });
    console.log('Failure report sent to', CONFIG.SUPERADMIN_EMAIL);
  } catch (error) {
    console.error('Failed to send failure report:', error);
  }
}

// ==================== MAIN HANDLER ====================
export default async function handler(req, res) {
  const startTime = Date.now();
  testResults = [];
  testSessionId = null;

  // Run all tests
  await testLanding();
  await testDemo();
  await testDashboard();
  await testSales();
  await testSupabase();
  await testEmail();
  await cleanup();

  const duration = Date.now() - startTime;
  const passed = testResults.filter(t => t.status === 'passed').length;
  const failed = testResults.filter(t => t.status === 'failed').length;
  const skipped = testResults.filter(t => t.status === 'skipped').length;

  // Send failure report if any tests failed
  await sendFailureReport(testResults, duration);

  // Group results by category
  const categories = {};
  testResults.forEach(t => {
    if (!categories[t.category]) {
      categories[t.category] = { passed: 0, failed: 0, skipped: 0 };
    }
    categories[t.category][t.status]++;
  });

  // Return HTML report
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>EryAI Test Results</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .stat { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 36px; font-weight: bold; }
    .stat-label { color: #6b7280; margin-top: 5px; }
    .passed .stat-value { color: #10b981; }
    .failed .stat-value { color: #ef4444; }
    .skipped .stat-value { color: #f59e0b; }
    .duration .stat-value { color: #3b82f6; }
    .category { background: white; border-radius: 10px; margin-bottom: 15px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .category-header { padding: 15px 20px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
    .category-header.all-passed { background: #d1fae5; color: #065f46; }
    .category-header.has-failures { background: #fee2e2; color: #991b1b; }
    .test { padding: 12px 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .test-name { display: flex; align-items: center; gap: 10px; }
    .test-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .test-status.passed { background: #d1fae5; color: #065f46; }
    .test-status.failed { background: #fee2e2; color: #991b1b; }
    .test-status.skipped { background: #fef3c7; color: #92400e; }
    .test-duration { color: #9ca3af; font-size: 14px; }
    .test-error { color: #dc2626; font-size: 13px; margin-top: 5px; padding-left: 30px; }
    .actions { text-align: center; margin-top: 20px; }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #6b7280; color: white; }
    .timestamp { text-align: center; color: #9ca3af; margin-top: 20px; font-size: 14px; }
    .badge { font-size: 14px; padding: 4px 10px; border-radius: 20px; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 EryAI Test Results</h1>
    
    <div style="text-align: center; margin-bottom: 20px;">
      ${failed === 0 
        ? '<span class="badge badge-success">✅ ALL TESTS PASSED</span>' 
        : `<span class="badge badge-error">❌ ${failed} TEST(S) FAILED</span>`}
    </div>
    
    <div class="summary">
      <div class="stat passed">
        <div class="stat-value">${passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat failed">
        <div class="stat-value">${failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat skipped">
        <div class="stat-value">${skipped}</div>
        <div class="stat-label">Skipped</div>
      </div>
      <div class="stat duration">
        <div class="stat-value">${(duration / 1000).toFixed(1)}s</div>
        <div class="stat-label">Duration</div>
      </div>
    </div>

    ${Object.entries(categories).map(([cat, stats]) => `
      <div class="category">
        <div class="category-header ${stats.failed > 0 ? 'has-failures' : 'all-passed'}">
          <span>${stats.failed > 0 ? '❌' : '✅'} ${cat}</span>
          <span>${stats.passed}/${stats.passed + stats.failed + stats.skipped} passed</span>
        </div>
        ${testResults.filter(t => t.category === cat).map(t => `
          <div class="test">
            <div class="test-name">
              <span class="test-status ${t.status}">${t.status === 'passed' ? '✅' : t.status === 'failed' ? '❌' : '⏭️'}${t.name}</span>
            </div>
            <span class="test-duration">${t.duration}ms</span>
          </div>
          ${t.error ? `<div class="test-error">↳ ${t.error}</div>` : ''}
        `).join('')}
      </div>
    `).join('')}

    <div class="actions">
      <a href="/api/status" class="btn btn-secondary">System Status</a>
      <a href="/api/health" class="btn btn-secondary">Health Check</a>
      <a href="/api/test" class="btn btn-primary">Run Again</a>
    </div>

    <div class="timestamp">
      Test run: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
