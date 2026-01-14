// resetAdmins.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 1. Load the .env file
dotenv.config(); 

const Admin = require('./models/admin'); // Ensure this path matches your file structure

const resetAdmins = async () => {
  try {
    // 2. Validate that the URI exists
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing from .env file');
    }

    console.log('⏳ Connecting to MongoDB...');
    
    // 3. Connect using the variable from your .env file
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    // 4. Delete all admins
    const result = await Admin.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} admin(s).`);
    console.log('ℹ️ You can now perform a fresh "Initial Login" via Postman/Frontend.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Connection closed');
    process.exit();
  }
};

resetAdmins();