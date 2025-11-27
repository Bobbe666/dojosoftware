const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ===================================================================
// 📧 NOTIFICATION SYSTEM SETUP SCRIPT
// ===================================================================

console.log('🚀 Setting up Notification System...');

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojosoftware',
  multipleStatements: true
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Read and execute SQL migration
const sqlFile = path.join(__dirname, '../migrations/create_notification_tables_simple.sql');

try {
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  
  console.log('📄 Executing notification system migration...');
  
  db.query(sqlContent, (err, results) => {
    if (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    }
    
    console.log('✅ Notification system tables created successfully!');
    console.log('📊 Created tables:');
    console.log('   - notification_settings');
    console.log('   - notifications');
    console.log('   - email_templates');
    console.log('   - push_subscriptions');
    console.log('   - newsletter_subscriptions');
    console.log('   - notification_queue');
    
    // Insert default settings
    console.log('⚙️ Setting up default configuration...');
    
    const defaultSettings = {
      id: 1,
      email_enabled: false,
      push_enabled: false,
      email_config: JSON.stringify({
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        smtp_password: ''
      }),
      push_config: JSON.stringify({}),
      default_from_email: '',
      default_from_name: 'Dojo Software'
    };
    
    db.query(`
      INSERT INTO notification_settings 
      (id, email_enabled, push_enabled, email_config, push_config, default_from_email, default_from_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      email_enabled = VALUES(email_enabled),
      push_enabled = VALUES(push_enabled),
      email_config = VALUES(email_config),
      push_config = VALUES(push_config),
      default_from_email = VALUES(default_from_email),
      default_from_name = VALUES(default_from_name)
    `, [
      defaultSettings.id,
      defaultSettings.email_enabled,
      defaultSettings.push_enabled,
      defaultSettings.email_config,
      defaultSettings.push_config,
      defaultSettings.default_from_email,
      defaultSettings.default_from_name
    ], (err, result) => {
      if (err) {
        console.error('❌ Failed to insert default settings:', err);
      } else {
        console.log('✅ Default settings configured');
      }
      
      // Test email templates
      console.log('📧 Checking email templates...');
      db.query('SELECT COUNT(*) as count FROM email_templates', (err, results) => {
        if (err) {
          console.error('❌ Failed to check templates:', err);
        } else {
          console.log(`✅ Email templates: ${results[0].count} templates available`);
        }
        
        console.log('🎉 Notification system setup completed!');
        console.log('');
        console.log('📋 Next steps:');
        console.log('   1. Configure your SMTP settings in the admin dashboard');
        console.log('   2. Test email functionality');
        console.log('   3. Set up push notifications (optional)');
        console.log('   4. Customize email templates as needed');
        console.log('');
        console.log('🔗 Access the notification system at: /dashboard/notifications');
        
        db.end();
      });
    });
  });
  
} catch (error) {
  console.error('❌ Failed to read SQL file:', error);
  process.exit(1);
}
