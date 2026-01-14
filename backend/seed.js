require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./src/models/User");
const connectDB = require("./src/config/database");
const logger = require("./src/utils/logger");

/**
 * Seed Script - Initialize Database with Default Admin User
 */

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seeding...\n");

    // Connect to database
    await connectDB();

    // Clear existing users (optional - comment out in production)
    // await User.deleteMany({});
    // console.log("✓ Cleared existing users");

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: "admin@tasknexus.com" });
    if (existingAdmin) {
      console.log("ℹ Admin user already exists");
      console.log("Email: admin@tasknexus.com");
      process.exit(0);
    }

    // Create admin user
    const adminPassword = await bcrypt.hash("Admin@123", 12);

    const admin = await User.create({
      email: "admin@tasknexus.com",
      password: adminPassword,
      role: "admin",
      profile: {
        firstName: "Admin",
        lastName: "User",
        phone: "+1234567890",
      },
      status: "active",
      emailVerified: true,
    });

    console.log("\n✅ Database seeding completed successfully!\n");
    console.log("=".repeat(50));
    console.log("📝 Admin Credentials:");
    console.log("=".repeat(50));
    console.log("Email:    admin@tasknexus.com");
    console.log("Password: Admin@123");
    console.log("=".repeat(50));
    console.log(
      "\n⚠️  IMPORTANT: Change the admin password after first login!\n"
    );

    // Create sample client
    const clientPassword = await bcrypt.hash("Client@123", 12);
    const client = await User.create({
      email: "client@tasknexus.com",
      password: clientPassword,
      role: "client",
      profile: {
        firstName: "John",
        lastName: "Client",
        phone: "+1234567891",
      },
      companyName: "Demo Company",
      status: "active",
      emailVerified: true,
    });

    console.log(
      "✓ Sample client created: client@tasknexus.com (Password: Client@123)"
    );

    // Create sample freelancer
    const freelancerPassword = await bcrypt.hash("Freelancer@123", 12);
    const freelancer = await User.create({
      email: "freelancer@tasknexus.com",
      password: freelancerPassword,
      role: "freelancer",
      profile: {
        firstName: "Jane",
        lastName: "Freelancer",
        phone: "+1234567892",
      },
      freelancerProfile: {
        skills: ["Web Development", "React", "Node.js"],
        experience: 3,
        availability: "full-time",
      },
      status: "active",
      emailVerified: true,
    });

    console.log(
      "✓ Sample freelancer created: freelancer@tasknexus.com (Password: Freelancer@123)"
    );
    console.log("\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();
