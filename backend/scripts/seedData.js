const mongoose = require("mongoose");
const User = require("../src/models/User");
const Task = require("../src/models/Task");
const Payment = require("../src/models/Payment");
const Review = require("../src/models/Review");
require("dotenv").config();

async function seedData() {
  try {
    console.log("🔄 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Create sample clients
    console.log("🔄 Creating sample clients...");
    const clients = await User.create([
      {
        email: "client1@example.com",
        password: "Password@123",
        role: "client",
        profile: {
          firstName: "John",
          lastName: "Doe",
          phone: "+1234567891",
        },
        isEmailVerified: true,
      },
      {
        email: "client2@example.com",
        password: "Password@123",
        role: "client",
        profile: {
          firstName: "Jane",
          lastName: "Smith",
          phone: "+1234567892",
        },
        isEmailVerified: true,
      },
      {
        email: "client3@example.com",
        password: "Password@123",
        role: "client",
        profile: {
          firstName: "Mike",
          lastName: "Johnson",
          phone: "+1234567893",
        },
        isEmailVerified: true,
      },
    ]);
    console.log(`✅ Created ${clients.length} clients`);

    // Create sample freelancers
    console.log("🔄 Creating sample freelancers...");
    const freelancers = await User.create([
      {
        email: "freelancer1@example.com",
        password: "Password@123",
        role: "freelancer",
        profile: {
          firstName: "Alice",
          lastName: "Wilson",
          phone: "+1234567894",
        },
        isEmailVerified: true,
      },
      {
        email: "freelancer2@example.com",
        password: "Password@123",
        role: "freelancer",
        profile: {
          firstName: "Bob",
          lastName: "Brown",
          phone: "+1234567895",
        },
        isEmailVerified: true,
      },
      {
        email: "freelancer3@example.com",
        password: "Password@123",
        role: "freelancer",
        profile: {
          firstName: "Carol",
          lastName: "Davis",
          phone: "+1234567896",
        },
        isEmailVerified: true,
      },
    ]);
    console.log(`✅ Created ${freelancers.length} freelancers`);

    // Create sample tasks
    console.log("🔄 Creating sample tasks...");
    const tasks = await Task.create([
      {
        client: clients[0]._id,
        taskDetails: {
          title: "Build E-commerce Website",
          description:
            "Need a full-featured e-commerce website with payment integration",
          budget: 5000,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          type: "web-development",
        },
        status: "under_review",
      },
      {
        client: clients[1]._id,
        freelancer: freelancers[0]._id,
        taskDetails: {
          title: "Mobile App UI/UX Design",
          description: "Design modern UI/UX for iOS and Android mobile app",
          budget: 3000,
          deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          type: "design",
        },
        status: "in_progress",
      },
      {
        client: clients[2]._id,
        freelancer: freelancers[1]._id,
        taskDetails: {
          title: "SEO Optimization",
          description:
            "Optimize website for search engines and improve rankings",
          budget: 1500,
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          type: "marketing",
        },
        status: "assigned",
      },
      {
        client: clients[0]._id,
        taskDetails: {
          title: "Content Writing",
          description: "Write 10 blog posts about technology",
          budget: 800,
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          type: "content-writing",
        },
        status: "submitted",
      },
      {
        client: clients[1]._id,
        freelancer: freelancers[2]._id,
        taskDetails: {
          title: "Video Editing",
          description: "Edit promotional video for product launch",
          budget: 1200,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          type: "video-editing",
        },
        status: "completed",
      },
      {
        client: clients[2]._id,
        freelancer: freelancers[0]._id,
        taskDetails: {
          title: "Logo Design",
          description: "Create professional logo for startup company",
          budget: 500,
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          type: "design",
        },
        status: "completed",
      },
      {
        client: clients[0]._id,
        taskDetails: {
          title: "Data Analysis",
          description: "Analyze sales data and create insights report",
          budget: 2000,
          deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
          type: "data-analysis",
        },
        status: "under_review",
      },
    ]);
    console.log(`✅ Created ${tasks.length} tasks`);

    // Create sample payments for completed tasks
    console.log("🔄 Creating sample payments...");
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const payments = [];

    for (const task of completedTasks) {
      const payment = await Payment.create({
        task: task._id,
        client: task.client,
        freelancer: task.freelancer,
        amount: task.taskDetails.budget * 0.9, // 90% to freelancer
        platformFee: task.taskDetails.budget * 0.1, // 10% platform fee
        status: "completed",
        paymentMethod: "stripe",
      });
      payments.push(payment);
    }
    console.log(`✅ Created ${payments.length} payments`);

    // Create sample reviews
    console.log("🔄 Creating sample reviews...");
    const reviews = [];
    for (const task of completedTasks) {
      const review = await Review.create({
        task: task._id,
        client: task.client,
        freelancer: task.freelancer,
        rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
        comment: "Great work! Very professional and delivered on time.",
      });
      reviews.push(review);
    }
    console.log(`✅ Created ${reviews.length} reviews`);

    console.log("\n🎉 Sample data created successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - Clients: ${clients.length}`);
    console.log(`   - Freelancers: ${freelancers.length}`);
    console.log(`   - Tasks: ${tasks.length}`);
    console.log(`   - Payments: ${payments.length}`);
    console.log(`   - Reviews: ${reviews.length}`);
    console.log("\n🔑 Sample Login Credentials:");
    console.log("   Client: client1@example.com / Password@123");
    console.log("   Freelancer: freelancer1@example.com / Password@123");
    console.log("   Admin: admin@tasknexus.com / Admin@123456");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

seedData();
