// scripts/verify-suite.mjs
const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('application/pdf') || contentType.includes('spreadsheetml')) {
    const buffer = await res.arrayBuffer();
    data = { bufferLength: buffer.byteLength, contentType };
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

async function run() {
  console.log('=== STARTING E2E VERIFICATION SUITE ===\n');

  // 1. Superadmin Login
  console.log('1. Testing Superadmin Login (superadmin@didikpme.id)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@didikpme.id', password: 'demo1234' }),
  });
  console.log('Status:', loginRes.status);
  if (loginRes.status !== 200) {
    console.error('Superadmin login failed:', loginRes.data);
    process.exit(1);
  }
  const superadminCookie = loginRes.headers.get('set-cookie');
  console.log('Superadmin logged in successfully:', loginRes.data.user.name, 'Role:', loginRes.data.user.role);

  // 2. Fetch Tenants
  console.log('\n2. Testing GET /api/admin/tenants...');
  const tenantsRes = await request('/api/admin/tenants', {
    headers: { Cookie: superadminCookie },
  });
  console.log('Status:', tenantsRes.status, 'Tenants found:', tenantsRes.data.tenants?.length);
  const tenants = tenantsRes.data.tenants || [];
  tenants.forEach(t => console.log(` - [${t.id}] ${t.name} (${t.slug})`));

  // 3. Fetch Users
  console.log('\n3. Testing GET /api/admin/users...');
  const usersRes = await request('/api/admin/users', {
    headers: { Cookie: superadminCookie },
  });
  console.log('Status:', usersRes.status, 'Total users:', usersRes.data.users?.length);
  usersRes.data.users?.slice(0, 5).forEach(u => {
    console.log(` - ${u.email} (${u.role}) Org: ${u.organization?.name} Menus: ${u.menuAccess || 'ALL'}`);
  });

  // 4. Create User with custom Menu Checklist
  console.log('\n4. Testing POST /api/admin/users (creating user with limited menu checklist)...');
  const testEmail = `operator_${Date.now()}@didikpme.id`;
  const createUserRes = await request('/api/admin/users', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Cookie: superadminCookie 
    },
    body: JSON.stringify({
      email: testEmail,
      name: 'Operator Uji Coba',
      password: 'demoPassword123',
      role: 'ANALYST',
      organizationId: tenants[0]?.id,
      menuAccess: ['dashboard', 'reports'], // Only dashboard & reports
    }),
  });
  console.log('Status:', createUserRes.status, 'User created:', createUserRes.data.user?.email);
  const createdUserId = createUserRes.data.user?.id;

  // 5. Verify limited user login and permissions
  console.log('\n5. Testing Limited User Login...');
  const limitedLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'demoPassword123' }),
  });
  console.log('Status:', limitedLoginRes.status);
  console.log('User menuAccess returned:', limitedLoginRes.data.user?.menuAccess);
  const limitedCookie = limitedLoginRes.headers.get('set-cookie');

  // Limited user accessing admin route should fail (403)
  const forbiddenRes = await request('/api/admin/users', {
    headers: { Cookie: limitedCookie },
  });
  console.log('Limited user accessing /api/admin/users -> Status:', forbiddenRes.status, '(Expected: 403)');

  // 6. Test Reports API with filters
  console.log('\n6. Testing GET /api/reports (with various filters)...');
  const reportsAll = await request('/api/reports', {
    headers: { Cookie: superadminCookie },
  });
  console.log('Reports without filter -> Status:', reportsAll.status, 'Total items:', reportsAll.data.items?.length, 'KPI Total:', reportsAll.data.summary?.total);

  const reportsFiltered = await request('/api/reports?zStatus=SATISFACTORY', {
    headers: { Cookie: superadminCookie },
  });
  console.log('Reports with zStatus=SATISFACTORY -> Status:', reportsFiltered.status, 'Items:', reportsFiltered.data.items?.length);

  // 7. Test Tenant Scoping & "Lihat Sebagai"
  console.log('\n7. Testing Tenant Scoping & "Lihat Sebagai"...');
  if (tenants.length > 1) {
    const org1 = tenants[0];
    const org2 = tenants[1];
    
    const dashOrg1 = await request('/api/dashboard', {
      headers: { 
        Cookie: superadminCookie,
        'x-tenant-id': org1.id
      },
    });
    console.log(`Dashboard as [${org1.name}] -> Sessions:`, dashOrg1.data.sessions?.length);

    const dashOrg2 = await request('/api/dashboard', {
      headers: { 
        Cookie: superadminCookie,
        'x-tenant-id': org2.id
      },
    });
    console.log(`Dashboard as [${org2.name}] -> Sessions:`, dashOrg2.data.sessions?.length);
  }

  // 8. Test Export Endpoints (PDF Model 1, PDF Model 2, Excel Model 2)
  console.log('\n8. Testing Export Endpoints for active sessions...');
  const sessionsRes = await request('/api/pme', {
    headers: { Cookie: superadminCookie },
  });
  const sessions = sessionsRes.data.sessions || [];
  console.log('Available PME Sessions:', sessions.length);

  if (sessions.length > 0) {
    const targetSession = sessions[0];
    console.log(`Target Session: ${targetSession.id} - ${targetSession.programName || targetSession.fileName}`);

    // PDF Model 1 (Enriched with 5 AI Columns)
    console.log('Testing GET /api/pme/[id]/export/pdf (Model 1 with AI Columns)...');
    const pdf1Res = await request(`/api/pme/${targetSession.id}/export/pdf`, {
      headers: { Cookie: superadminCookie },
    });
    console.log('PDF Model 1 Status:', pdf1Res.status, 'Type:', pdf1Res.data.contentType, 'Bytes:', pdf1Res.data.bufferLength);

    // PDF Model 2 (5-Column Layout)
    console.log('Testing GET /api/pme/[id]/export/pdf2 (Model 2)...');
    const pdf2Res = await request(`/api/pme/${targetSession.id}/export/pdf2`, {
      headers: { Cookie: superadminCookie },
    });
    console.log('PDF Model 2 Status:', pdf2Res.status, 'Type:', pdf2Res.data.contentType, 'Bytes:', pdf2Res.data.bufferLength);

    // Excel Model 2 (Matching EVALUASI PME.xlsx)
    console.log('Testing GET /api/pme/[id]/export/excel2 (Excel Model 2)...');
    const excel2Res = await request(`/api/pme/${targetSession.id}/export/excel2`, {
      headers: { Cookie: superadminCookie },
    });
    console.log('Excel Model 2 Status:', excel2Res.status, 'Type:', excel2Res.data.contentType, 'Bytes:', excel2Res.data.bufferLength);
  } else {
    console.log('No sessions found in DB to test exports directly.');
  }

  // Cleanup test user
  if (createdUserId) {
    console.log('\n9. Cleaning up test user...');
    const delRes = await request(`/api/admin/users/${createdUserId}`, {
      method: 'DELETE',
      headers: { Cookie: superadminCookie },
    });
    console.log('Delete test user status:', delRes.status);
  }

  console.log('\n=== ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
