const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ComplianceAction = require('../src/models/ComplianceAction');
const Business = require('../src/models/Business');
const User = require('../src/models/User');
const request = require('supertest');
const express = require('express');

let mongoServer;
let app;
let token;
let user;
let biz;
let action;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use('/api/compliance-actions', require('../src/routes/complianceActions'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ComplianceAction.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  user = await User.create({ name: 'Test', email: 't@t.com', password: '123' });
  const jwt = require('jsonwebtoken');
  token = jwt.sign({ id: user._id, role: 'OWNER' }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
  // Mock the verify middleware by manually setting SECRET inside authMiddleware, or mock authMiddleware. 
  // It's easier to just mock it using a global secret for tests or set process.env.JWT_SECRET.
  process.env.JWT_SECRET = 'test_secret';

  biz = await Business.create({ user: user._id, name: 'Biz' });
  action = await ComplianceAction.create({
    business: biz._id, title: 'Act 1', description: 'Desc 1', category: 'Cat', 
    applicability: 'APPLIES', ruleCode: '1'
  });
});

describe('Submission Workflow Tests', () => {
  it('updates submission record without marking task complete', async () => {
    const res = await request(app)
      .post(`/api/compliance-actions/${action._id}/submit-record`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'SUBMITTED',
        referenceNumber: 'REF123'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.data.submissionRecord.status).toBe('SUBMITTED');
    expect(res.body.data.submissionRecord.referenceNumber).toBe('REF123');
    
    // Internal task shouldn't be completed by just updating the record
    expect(res.body.data.status).not.toBe('COMPLETED');
  });
});
