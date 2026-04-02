// Migration Script: Populate dojo_id in all relevant tables
// This script ensures all existing data has proper dojo_id assignments for Tax Compliance
const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojo'
});

// Promise wrapper
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

async function migrateDojoIds() {
  console.log('🚀 Starting dojo_id migration for Tax Compliance...\n');

  try {
    // 1. Get all active dojos
    console.log('📋 Step 1: Loading active Dojos...');
    const dojos = await queryAsync('SELECT id, dojoname FROM dojo WHERE ist_aktiv = TRUE ORDER BY id');

    if (dojos.length === 0) {
      throw new Error('No active dojos found! Cannot proceed with migration.');
    }

    console.log(`✅ Found ${dojos.length} active Dojos:`);
    dojos.forEach(d => console.log(`   - ID ${d.id}: ${d.dojoname}`));
    console.log('');

    const hauptDojoId = dojos[0].id; // Use first dojo as default
    console.log(`📌 Using Dojo ID ${hauptDojoId} ("${dojos[0].dojoname}") as default for existing data\n`);

    // 2. MITGLIEDER - Members already distributed by distribute-members.js script
    console.log('📋 Step 2: Checking Mitglieder (Members)...');
    const membersWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM mitglieder WHERE dojo_id IS NULL');

    if (membersWithoutDojo[0].count > 0) {
      console.log(`⚠️  Found ${membersWithoutDojo[0].count} members without dojo_id`);
      console.log(`🔄 Assigning them to default Dojo ${hauptDojoId}...`);
      await queryAsync('UPDATE mitglieder SET dojo_id = ? WHERE dojo_id IS NULL', [hauptDojoId]);
      console.log(`✅ Updated ${membersWithoutDojo[0].count} members`);
    } else {
      console.log('✅ All members already have dojo_id');
    }
    console.log('');

    // 3. KURSE - Courses
    console.log('📋 Step 3: Migrating Kurse (Courses)...');
    const coursesWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM kurse WHERE dojo_id IS NULL');

    if (coursesWithoutDojo[0].count > 0) {
      console.log(`🔄 Assigning ${coursesWithoutDojo[0].count} courses to Dojo ${hauptDojoId}...`);
      await queryAsync('UPDATE kurse SET dojo_id = ? WHERE dojo_id IS NULL', [hauptDojoId]);
      console.log(`✅ Updated ${coursesWithoutDojo[0].count} courses`);
    } else {
      console.log('✅ All courses already have dojo_id');
    }
    console.log('');

    // 4. VERTRÄGE - Contracts (link to member's dojo)
    console.log('📋 Step 4: Migrating Verträge (Contracts)...');
    const contractsWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM vertraege WHERE dojo_id IS NULL');

    if (contractsWithoutDojo[0].count > 0) {
      console.log(`🔄 Linking ${contractsWithoutDojo[0].count} contracts to member's Dojo...`);
      // Update contracts to match their member's dojo_id
      await queryAsync(`
        UPDATE vertraege v
        JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
        SET v.dojo_id = m.dojo_id
        WHERE v.dojo_id IS NULL
      `);
      console.log(`✅ Updated contracts based on member's Dojo`);
    } else {
      console.log('✅ All contracts already have dojo_id');
    }
    console.log('');

    // 5. BEITRÄGE - Payments (link to member's dojo)
    console.log('📋 Step 5: Migrating Beiträge (Payments)...');
    const paymentsWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM beitraege WHERE dojo_id IS NULL OR dojo_id = 1');

    if (paymentsWithoutDojo[0].count > 0) {
      console.log(`🔄 Linking ${paymentsWithoutDojo[0].count} payments to member's Dojo...`);
      // Update payments to match their member's dojo_id
      await queryAsync(`
        UPDATE beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        SET b.dojo_id = m.dojo_id
        WHERE b.dojo_id IS NULL OR b.dojo_id = 1
      `);
      console.log(`✅ Updated payments based on member's Dojo`);
    } else {
      console.log('✅ All payments already have correct dojo_id');
    }
    console.log('');

    // 6. ANWESENHEIT - Attendance (link to member's dojo)
    console.log('📋 Step 6: Migrating Anwesenheit (Attendance)...');
    const attendanceWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM anwesenheit WHERE dojo_id IS NULL');

    if (attendanceWithoutDojo[0].count > 0) {
      console.log(`🔄 Linking ${attendanceWithoutDojo[0].count} attendance records to member's Dojo...`);
      // Update attendance to match their member's dojo_id
      await queryAsync(`
        UPDATE anwesenheit a
        JOIN mitglieder m ON a.mitglied_id = m.mitglied_id
        SET a.dojo_id = m.dojo_id
        WHERE a.dojo_id IS NULL
      `);
      console.log(`✅ Updated attendance based on member's Dojo`);
    } else {
      console.log('✅ All attendance records already have dojo_id');
    }
    console.log('');

    // 7. TRAINER - Trainers
    console.log('📋 Step 7: Migrating Trainer...');
    const trainersWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM trainer WHERE dojo_id IS NULL');

    if (trainersWithoutDojo[0].count > 0) {
      console.log(`🔄 Assigning ${trainersWithoutDojo[0].count} trainers to Dojo ${hauptDojoId}...`);
      await queryAsync('UPDATE trainer SET dojo_id = ? WHERE dojo_id IS NULL', [hauptDojoId]);
      console.log(`✅ Updated ${trainersWithoutDojo[0].count} trainers`);
    } else {
      console.log('✅ All trainers already have dojo_id');
    }
    console.log('');

    // 8. PERSONAL - Staff
    console.log('📋 Step 8: Migrating Personal (Staff)...');
    const staffWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM personal WHERE dojo_id IS NULL');

    if (staffWithoutDojo[0].count > 0) {
      console.log(`🔄 Assigning ${staffWithoutDojo[0].count} staff members to Dojo ${hauptDojoId}...`);
      await queryAsync('UPDATE personal SET dojo_id = ? WHERE dojo_id IS NULL', [hauptDojoId]);
      console.log(`✅ Updated ${staffWithoutDojo[0].count} staff members`);
    } else {
      console.log('✅ All staff members already have dojo_id');
    }
    console.log('');

    // 9. DOKUMENTE - Documents (link to member's dojo if applicable)
    console.log('📋 Step 9: Migrating Dokumente (Documents)...');
    const documentsWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM dokumente WHERE dojo_id IS NULL');

    if (documentsWithoutDojo[0].count > 0) {
      console.log(`🔄 Linking ${documentsWithoutDojo[0].count} documents to member's Dojo...`);
      // Update documents to match their member's dojo_id
      await queryAsync(`
        UPDATE dokumente d
        JOIN mitglieder m ON d.mitglied_id = m.mitglied_id
        SET d.dojo_id = m.dojo_id
        WHERE d.dojo_id IS NULL AND d.mitglied_id IS NOT NULL
      `);

      // Assign remaining documents without member to default dojo
      await queryAsync('UPDATE dokumente SET dojo_id = ? WHERE dojo_id IS NULL', [hauptDojoId]);
      console.log(`✅ Updated documents`);
    } else {
      console.log('✅ All documents already have dojo_id');
    }
    console.log('');

    // 10. GRUPPEN - Groups
    console.log('📋 Step 10: Migrating Gruppen (Groups)...');
    const groupsWithoutDojo = await queryAsync('SELECT COUNT(*) as count FROM gruppen WHERE dojo_id IS NULL');

    if (groupsWithoutDojo[0].count > 0) {
      console.log(`🔄 Assigning ${groupsWithoutDojo[0].count} groups to Dojo ${hauptDojoId}...`);
      await queryAsync('UPDATE gruppen SET dojo_id = ? WHERE dojo_id IS NULL', [hauptDojoId]);
      console.log(`✅ Updated ${groupsWithoutDojo[0].count} groups`);
    } else {
      console.log('✅ All groups already have dojo_id');
    }
    console.log('');

    // Summary Statistics
    console.log('📊 MIGRATION SUMMARY:');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const dojo of dojos) {
      console.log(`🏢 ${dojo.dojoname} (ID: ${dojo.id}):`);

      const stats = await Promise.all([
        queryAsync('SELECT COUNT(*) as count FROM mitglieder WHERE dojo_id = ?', [dojo.id]),
        queryAsync('SELECT COUNT(*) as count FROM kurse WHERE dojo_id = ?', [dojo.id]),
        queryAsync('SELECT COUNT(*) as count FROM vertraege WHERE dojo_id = ?', [dojo.id]),
        queryAsync('SELECT COUNT(*) as count FROM beitraege WHERE dojo_id = ?', [dojo.id]),
        queryAsync('SELECT COUNT(*) as count FROM anwesenheit WHERE dojo_id = ?', [dojo.id]),
        queryAsync('SELECT COUNT(*) as count FROM trainer WHERE dojo_id = ?', [dojo.id]),
        queryAsync('SELECT COUNT(*) as count FROM dokumente WHERE dojo_id = ?', [dojo.id])
      ]);

      console.log(`   - Mitglieder: ${stats[0][0].count}`);
      console.log(`   - Kurse: ${stats[1][0].count}`);
      console.log(`   - Verträge: ${stats[2][0].count}`);
      console.log(`   - Beiträge: ${stats[3][0].count}`);
      console.log(`   - Anwesenheit: ${stats[4][0].count}`);
      console.log(`   - Trainer: ${stats[5][0].count}`);
      console.log(`   - Dokumente: ${stats[6][0].count}`);
      console.log('');
    }

    console.log('✅ Migration completed successfully!');
    console.log('🎉 All data is now properly assigned to Dojos for Tax Compliance!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    db.end();
  }
}

// Execute migration
migrateDojoIds()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Script failed:', err);
    process.exit(1);
  });
