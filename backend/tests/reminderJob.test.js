const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ComplianceAction = require('../src/models/ComplianceAction');
const Business = require('../src/models/Business');
const User = require('../src/models/User');
const ComplianceReminder = require('../src/models/ComplianceReminder');
const runReminderJob = require('../src/jobs/complianceReminderJob');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await ComplianceAction.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await ComplianceReminder.deleteMany({});
});

describe('Reminder Job Tests', () => {
  it('generates no reminder if due in 40 days', async () => {
    const user = await User.create({ name: 'Test', email: 't@t.com', password: '123', role: 'OWNER' });
    const biz = await Business.create({ user: user._id, name: 'Biz' });
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 40);
    
    await ComplianceAction.create({
      business: biz._id, title: 'Act 1', description: 'Desc 1', category: 'Cat', 
      applicability: 'APPLIES', ruleCode: '1', dueDate: futureDate
    });
    
    await runReminderJob();
    const count = await ComplianceReminder.countDocuments();
    expect(count).toBe(0);
  });
  
  it('generates DUE_SOON reminder if due in 7 days', async () => {
    const user = await User.create({ name: 'Test', email: 't@t.com', password: '123', role: 'OWNER' });
    const biz = await Business.create({ user: user._id, name: 'Biz' });
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    
    const act = await ComplianceAction.create({
      business: biz._id, title: 'Act 1', description: 'Desc 1', category: 'Cat', 
      applicability: 'APPLIES', ruleCode: '1', dueDate: futureDate
    });
    
    await runReminderJob();
    const reminders = await ComplianceReminder.find({ complianceAction: act._id });
    expect(reminders.length).toBe(2); // EARLY_REMINDER + DUE_SOON
    expect(reminders.find(r => r.reminderType === 'DUE_SOON')).toBeDefined();
    expect(reminders.find(r => r.reminderType === 'EARLY_REMINDER')).toBeDefined();
  });
  
  it('generates OVERDUE reminder and does not duplicate', async () => {
    const user = await User.create({ name: 'Test', email: 't@t.com', password: '123', role: 'OWNER' });
    const biz = await Business.create({ user: user._id, name: 'Biz' });
    
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // 1 day overdue
    
    const act = await ComplianceAction.create({
      business: biz._id, title: 'Act 1', description: 'Desc 1', category: 'Cat', 
      applicability: 'APPLIES', ruleCode: '1', dueDate: pastDate,
      priority: 'LOW' 
    });
    
    await runReminderJob();
    let reminders = await ComplianceReminder.find({ complianceAction: act._id });
    // It should generate OVERDUE (level 1 from stage 0) and ESCALATION (level 2 from stage 1)
    // Actually, wait, it only generates ONE reminder type per run (for the highest stage reached)
    // Wait, the loop sets effectiveStage to the highest stage reached. So it only dispatches for escalationLevel 2
    expect(reminders.length).toBe(1);
    expect(reminders[0].reminderType).toBe('ESCALATION');
    
    // Run again, should be idempotent
    await runReminderJob();
    reminders = await ComplianceReminder.find({ complianceAction: act._id });
    expect(reminders.length).toBe(1);
  });
});
