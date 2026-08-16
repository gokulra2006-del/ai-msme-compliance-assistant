require('dotenv').config();
const mongoose = require('mongoose');
const { authorize } = require('./src/middleware/auth');

async function runTest() {
  console.log('Testing RBAC Middleware');

  let req = { user: { role: 'OWNER' } };
  let res = { 
    status: function(s) { this.statusCode = s; return this; },
    json: function(d) { this.data = d; return this; }
  };
  let nextCalled = false;
  let next = () => { nextCalled = true; };

  const middleware = authorize('ADMIN');
  
  // Test OWNER
  middleware(req, res, next);
  if (res.statusCode === 403 && !nextCalled) {
    console.log('✅ OWNER correctly forbidden (403)');
  } else {
    console.error('❌ OWNER check failed');
  }

  // Test ADMIN
  req.user.role = 'ADMIN';
  res.statusCode = null;
  nextCalled = false;
  middleware(req, res, next);
  if (nextCalled) {
    console.log('✅ ADMIN correctly allowed');
  } else {
    console.error('❌ ADMIN check failed');
  }
}
runTest();


