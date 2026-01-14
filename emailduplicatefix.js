// fixDuplicateKeyError.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 1. Load the .env file
dotenv.config();

const fixDuplicateKeyError = async () => {
  try {
    // 2. Validate that the URI exists
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing from .env file');
    }

    console.log('⏳ Connecting to MongoDB...');
    
    // 3. Connect using the variable from your .env file
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    // 4. Get database connection
    const db = mongoose.connection.db;
    
    console.log('🔍 Checking indexes on "users" collection...');

    try {
      // 5. List all indexes (compatible with older MongoDB drivers)
      const indexes = await db.collection('users').indexes();
      console.log('\n📋 Current indexes:');
      console.log(JSON.stringify(indexes, null, 2));

      // 6. Check if email_1 index exists
      const emailIndex = indexes.find(index => index.name === 'email_1');
      
      if (emailIndex) {
        console.log('\n⚠️ Found unique index on "email" field (email_1)');
        console.log('This causes duplicate key error when multiple users have email: null');
        
        // 7. Drop the problematic index
        console.log('🗑️ Dropping "email_1" index...');
        await db.collection('users').dropIndex('email_1');
        console.log('✅ Successfully dropped "email_1" index');
      } else {
        console.log('\n✅ No problematic "email_1" index found');
        
        // Check if there's any other unique index on email
        const anyEmailIndex = indexes.find(index => 
          index.key && index.key.email && index.unique
        );
        
        if (anyEmailIndex) {
          console.log(`⚠️ Found another unique index on email: ${anyEmailIndex.name}`);
          console.log('🗑️ Dropping this index too...');
          await db.collection('users').dropIndex(anyEmailIndex.name);
          console.log(`✅ Dropped index: ${anyEmailIndex.name}`);
        }
      }

      // 8. Create sparse unique index (allows multiple null emails)
      console.log('\n🔧 Creating sparse unique index on "email"...');
      await db.collection('users').createIndex(
        { email: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'email_sparse_unique'
        }
      );
      console.log('✅ Created sparse unique index on "email"');
      console.log('📝 This allows multiple users with email: null');
      console.log('📝 But still enforces uniqueness for non-null emails');

    } catch (indexError) {
      console.log('\n⚠️ Using alternative method to check indexes...');
      
      // Alternative: Use mongoose model to check
      const User = mongoose.models.User || 
                   (await mongoose.connection.models.User) || 
                   mongoose.model('User');
      
      if (User) {
        console.log('Found User model, checking schema...');
        
        // Check if email field has unique constraint
        const emailPath = User.schema.path('email');
        if (emailPath && emailPath.options && emailPath.options.unique) {
          console.log('⚠️ User schema has unique constraint on email field');
          console.log('Please update your user schema to use sparse: true');
        }
      }
    }

    // 9. Check for duplicate null emails
    console.log('\n🔎 Checking for existing users with null emails...');
    const usersWithNullEmail = await db.collection('users')
      .find({ email: null })
      .toArray();
    
    console.log(`📊 Found ${usersWithNullEmail.length} users with email: null`);

    if (usersWithNullEmail.length > 0) {
      console.log('\n👤 Sample users with null email:');
      usersWithNullEmail.slice(0, 3).forEach((user, i) => {
        console.log(`  ${i+1}. ${user.name || 'No name'} (Phone: ${user.phone}) - UID: ${user.uid}`);
      });
    }

    // 10. Also check for any duplicate non-null emails
    console.log('\n🔎 Checking for duplicate non-null emails...');
    const pipeline = [
      { $match: { email: { $ne: null } } },
      { $group: { _id: "$email", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ];
    
    const duplicateEmails = await db.collection('users').aggregate(pipeline).toArray();
    
    if (duplicateEmails.length > 0) {
      console.log(`⚠️ Found ${duplicateEmails.length} duplicate email(s):`);
      duplicateEmails.forEach(dup => {
        console.log(`  - Email: ${dup._id} (Count: ${dup.count})`);
      });
      console.log('\n⚠️ These need to be fixed before creating unique index!');
    } else {
      console.log('✅ No duplicate non-null emails found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Connection closed');
    process.exit();
  }
};

// Run the script
fixDuplicateKeyError();