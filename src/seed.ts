import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db';
import config from './config/env';
import AdminUser from './modules/auth/model';
import SiteSettings from './modules/settings/model';
import { Achievement, SoftwareService, Stat, TeamMember } from './modules/content/models';

/**
 * Seeds the first admin (forced to change credentials on first login) and starter content
 * ONLY when a collection is empty, so re-running never overwrites edits.
 * Pass --reset-admin to recreate the admin user.
 */
async function seed() {
  await connectDB();

  const resetAdmin = process.argv.includes('--reset-admin');
  if (resetAdmin || (await AdminUser.countDocuments()) === 0) {
    await AdminUser.deleteMany({});
    await AdminUser.create({
      email: config.seedAdmin.username.toLowerCase(),
      password: config.seedAdmin.password,
      name: 'Admin',
      role: 'admin',
      mustChangePassword: true,
    });
    console.log(`Admin user created (username: ${config.seedAdmin.username}). Credentials must be changed on first login.`);
  }

  if (!(await SiteSettings.findOne({ key: 'site' }))) {
    await SiteSettings.create({
      key: 'site',
      companyName: 'Aditya & Co.',
      phone: '+91 98252 95685',
      whatsapp: '+91 94273 95685',
      emails: ['info@adityaco.co.in', 'adityakdl@gmail.com'],
      address: 'No.5, Ground Floor, Corporate Park, Plot No. 102, Sector-8, Gandhidham, Kachchh, Gujarat, India',
      linkedinUrl: 'https://www.linkedin.com/company/aditya-co',
    });
  }

  if ((await Stat.countDocuments()) === 0) {
    await Stat.insertMany([
      { value: '15+', label: 'Years serving the maritime industry', displayOrder: 0 },
      { value: '1000+', label: 'Vessel operations handled', displayOrder: 1 },
      { value: '50+', label: 'Corporate clients', displayOrder: 2 },
      { value: '2', label: 'Software products delivered', displayOrder: 3 },
    ]);
  }

  if ((await SoftwareService.countDocuments()) === 0) {
    const items: Array<[string, string, string]> = [
      ['Custom Software Development', 'Applications designed around your workflow, built, deployed and supported end to end.', 'Code'],
      ['Websites & Web Applications', 'Fast, responsive sites, portals and dashboards with search-friendly pages.', 'Globe'],
      ['Mobile App Development', 'Apps for field teams, drivers and customers on Android and iOS.', 'Smartphone'],
      ['Logistics & Shipping Software', 'Tracking, documentation, billing and reporting for freight and port operations.', 'Workflow'],
      ['ERP & Business Systems', 'Inventory, accounts and operations managed in one connected system.', 'Database'],
      ['APIs & Integrations', 'Connect the tools you already use so data flows without re-entry.', 'Plug'],
      ['UI / UX Design', 'Clear, usable interfaces designed with the people who will use them.', 'PenTool'],
      ['Cloud, DevOps & Support', 'Hosting, deployment, monitoring and ongoing maintenance after launch.', 'Cloud'],
    ];
    await SoftwareService.insertMany(items.map(([title, description, icon], displayOrder) => ({ title, description, icon, displayOrder })));
  }

  if ((await Achievement.countDocuments()) === 0) {
    await Achievement.insertMany([
      { title: '15+ Years of Excellence', description: 'Serving the maritime industry with dedication and expertise, building trust through consistent performance.', displayOrder: 0 },
      { title: '1000+ Vessel Operations', description: 'Managed over 1000 vessel operations across major Indian ports with efficiency and care.', displayOrder: 1 },
      { title: 'Pan-India Presence', description: 'Operations across major Indian ports with 24/7 support services.', displayOrder: 2 },
    ]);
  }

  if ((await TeamMember.countDocuments()) === 0) {
    await TeamMember.insertMany([
      {
        key: 'founder',
        name: 'Sunil Nair',
        role: 'Founder & CEO',
        image: 'https://res.cloudinary.com/drd6hssz1/image/upload/v1775757728/founder_img_d2vuhn.jpg',
        bio: [
          'Founded by Sunil Nair, Aditya & Co. is driven by a clear vision to deliver reliable, compliant and efficient shipping and logistics solutions across domestic and international trade routes.',
          'As Founder & CEO, he brings decades of industry understanding in maritime operations, port agency services, freight forwarding and cargo handling.',
          'Under his leadership, Aditya & Co. continues to grow as a trusted logistics partner, focused on operational excellence, transparent processes and long-term client relationships.',
        ],
        displayOrder: 0,
      },
      {
        key: 'cto',
        name: 'Aditya Nair',
        role: 'Chief Technology Officer',
        bio: [
          "Aditya Nair leads technology at Aditya & Co., heading the software development practice and the company's digital presence.",
          'He is responsible for the products the firm builds and manages, from the company website to custom applications for clients.',
        ],
        ideology: {
          heading: 'Technology should serve the operation, not the other way round',
          statement:
            'Good software starts with understanding the work it replaces. We build tools that fit how your team actually operates, keep them simple enough to maintain, and stay accountable for them long after launch.',
          principles: [
            { title: 'Start with the workflow', text: 'We learn the process first, then design the software around it.' },
            { title: 'Build to be maintained', text: 'Clean, documented code and sensible choices that last.' },
            { title: 'Own it after launch', text: 'We host, monitor and improve what we ship.' },
          ],
        },
        displayOrder: 1,
      },
    ]);
  }

  console.log('Seed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
