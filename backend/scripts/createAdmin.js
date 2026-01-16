const mongoose = require("mongoose");
const User = require("../src/models/User");
require("dotenv").config();

async function createAdmin() {
  try {
    console.log("🔄 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@tasknexus.com" });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists!");
      console.log("Email:", existingAdmin.email);
      console.log("Role:", existingAdmin.role);

      // Update to admin role if not already
      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
        await existingAdmin.save();
        console.log("✅ Updated user role to admin");
      }
    } else {
      console.log("🔄 Creating admin user...");

      const admin = await User.create({
        email: "admin@tasknexus.com",
        password: "Admin@123456",
        role: "admin",
        profile: {
          firstName: "Admin",
          lastName: "User",
          phone: "+1234567890",
        },
        isEmailVerified: true,
      });

      console.log("✅ Admin user created successfully!");
      console.log("📧 Email: admin@tasknexus.com");
      console.log("🔑 Password: Admin@123456");
      console.log("👤 Role:", admin.role);
    }

    console.log(
      "\n🎉 You can now login to admin portal at: http://localhost:5173/admin/login",
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createAdmin();
