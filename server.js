require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ==========================================
// 1. DATABASE CONNECTION (MongoDB / Local Fallback)
// ==========================================
let isMongoConnected = false;
const dbPath = path.join(__dirname, 'database.json');

// Define MongoDB Schemas if Mongoose is used
const TableSchema = new mongoose.Schema({
  id: String,
  capacity: Number,
  status: { type: String, enum: ['available', 'reserved', 'occupied', 'blocked-walkin'], default: 'available' },
  currentReservationId: String,
  blockedAt: String
}, { collection: 'kubera-tables' });

const ReservationSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  table: String,
  date: String,
  time: String,
  status: { type: String, enum: ['pending', 'approved', 'reached', 'no-show', 'left', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'kubera-reservations' });

const TableModel = mongoose.model('Table', TableSchema);
const ReservationModel = mongoose.model('Reservation', ReservationSchema);

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("Connected to MongoDB successfully.");
      isMongoConnected = true;
      initializeMongoTables();
    })
    .catch(err => {
      console.error("MongoDB connection failed:", err.message);
    });
} else {
  console.log("No MONGODB_URI provided. Operating on local JSON database.");
  setupLocalDatabase();
}

// Seed MongoDB Tables helper
async function initializeMongoTables() {
  try {
    const count = await TableModel.countDocuments();
    if (count === 0) {
      const defaultTables = [];
      ['A', 'B', 'C', 'D'].forEach(prefix => {
        let cap = 2;
        if (prefix === 'B') cap = 4;
        else if (prefix === 'C') cap = 6;
        else if (prefix === 'D') cap = 8;
        
        for (let i = 1; i <= 10; i++) {
          defaultTables.push({ id: `${prefix}${i}`, capacity: cap, status: 'available', currentReservationId: null });
        }
      });
      await TableModel.insertMany(defaultTables);
      console.log("Seeded initial table mappings in MongoDB.");
    }
  } catch (err) {
    console.error("Error seeding MongoDB tables:", err);
  }
}

// Local JSON file database helper functions
function setupLocalDatabase() {
  if (!fs.existsSync(dbPath)) {
    const defaultTables = [];
    ['A', 'B', 'C', 'D'].forEach(prefix => {
      let cap = 2;
      if (prefix === 'B') cap = 4;
      else if (prefix === 'C') cap = 6;
      else if (prefix === 'D') cap = 8;
      
      for (let i = 1; i <= 10; i++) {
        defaultTables.push({ id: `${prefix}${i}`, capacity: cap, status: 'available', currentReservationId: null });
      }
    });
    fs.writeFileSync(dbPath, JSON.stringify({ tables: defaultTables, reservations: [] }, null, 2));
    console.log("Created initial database.json file.");
  }
}

function getLocalData() {
  if (!fs.existsSync(dbPath)) setupLocalDatabase();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveLocalData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}


// ==========================================
// 2. SMTP EMAIL NOTIFICATION SERVICE
// ==========================================
let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log("SMTP Nodemailer service initialized.");
} else {
  console.log("SMTP credentials missing. Emails will be logged to console (Mock mode).");
}

// Serverless-safe email sender
async function sendMailSafe(to, subject, htmlContent) {
  const mailOptions = {
    from: `"Cafe Kubera" <${process.env.SMTP_USER || 'no-reply@cafekubera.com'}>`,
    to: to,
    subject: subject,
    html: htmlContent
  };
  
  if (transporter) {
    try {
      // CRITICAL SERVERLESS REQUIREMENT: await completion
      await transporter.sendMail(mailOptions);
      console.log(`Email dispatched to ${to} (${subject})`);
    } catch (err) {
      console.error(`Failed to send email to ${to}:`, err.message);
    }
  } else {
    console.log(`[MOCK EMAIL SENT TO ${to}] Subject: ${subject}`);
    // Log preview in local logs directory if wanted
  }
}

// HTML Email Templates
// Beautiful date and time formatters for premium email layout notifications
function formatBeautifulDate(dateStr) {
  if (!dateStr) return "N/A";
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatBeautifulTime(timeStr) {
  if (!timeStr) return "N/A";
  const [hour, min] = timeStr.split(':');
  let h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${min} ${ampm}`;
}

function getAdminNoticeHTML(res) {
  return `
    <div style="font-family:'Plus Jakarta Sans',sans-serif; background-color:#050505; color:#FAF6F0; padding:40px; border-radius:10px; max-width:600px; border:1px solid #D4AF37;">
      <h2 style="color:#D4AF37; border-bottom:1px solid #D4AF37; padding-bottom:10px;">New Booking Intake Notice</h2>
      <p>A new table reservation has been requested online:</p>
      <table style="width:100%; border-collapse:collapse; margin-top:20px; color:#FAF6F0;">
        <tr><td style="padding:8px; font-weight:600;">Customer:</td><td style="padding:8px;">${res.name}</td></tr>
        <tr><td style="padding:8px; font-weight:600;">Email:</td><td style="padding:8px;">${res.email}</td></tr>
        <tr><td style="padding:8px; font-weight:600;">Phone:</td><td style="padding:8px;">${res.phone}</td></tr>
        <tr><td style="padding:8px; font-weight:600;">Table Assigned:</td><td style="padding:8px; color:#D4AF37; font-weight:700;">${res.table}</td></tr>
        <tr><td style="padding:8px; font-weight:600;">Date:</td><td style="padding:8px;">${formatBeautifulDate(res.date)}</td></tr>
        <tr><td style="padding:8px; font-weight:600;">Time:</td><td style="padding:8px; color:#D4AF37; font-weight:700;">${formatBeautifulTime(res.time)}</td></tr>
      </table>
      <div style="text-align:center; margin-top:30px;">
        <a href="${BASE_URL}/admin.html" style="background-color:#D4AF37; color:#050505; padding:12px 24px; text-decoration:none; font-weight:700; border-radius:4px; display:inline-block;">Go to Admin Portal</a>
      </div>
    </div>
  `;
}

function getArrivalHTML(res) {
  return `
    <div style="font-family:'Plus Jakarta Sans',sans-serif; background-color:#050505; color:#FAF6F0; padding:40px; border-radius:10px; max-width:600px; border:1px solid #0AA78F;">
      <h2 style="color:#0AA78F; border-bottom:1px solid #0AA78F; padding-bottom:10px;">Table Reservation Confirmed</h2>
      <p>Dear ${res.name},</p>
      <p>Your table booking at **Cafe Kubera** is officially approved. We are excited to serve you our premium gold brews and artisan pairing ledger.</p>
      <p style="background-color:#16130F; padding:15px; border-radius:6px; border:1.5px solid rgba(212, 175, 55, 0.2);">
        <strong>Table Assigned:</strong> ${res.table}<br>
        <strong>Date:</strong> ${formatBeautifulDate(res.date)}<br>
        <strong>Time Slot:</strong> ${formatBeautifulTime(res.time)}<br>
        <strong>Hold Policy:</strong> Your table will be held for exactly <strong>20 minutes</strong> from the scheduled start time.
      </p>
      <p>If you need directions, we are located at: High Street, Benz Circle, Vijayawada.</p>
      <div style="text-align:center; margin-top:30px;">
        <a href="${BASE_URL}" style="background-color:#0AA78F; color:#050505; padding:12px 24px; text-decoration:none; font-weight:700; border-radius:4px; display:inline-block;">Visit Website</a>
      </div>
    </div>
  `;
}

function getRescheduleHTML(res) {
  return `
    <div style="font-family:'Plus Jakarta Sans',sans-serif; background-color:#050505; color:#FAF6F0; padding:40px; border-radius:10px; max-width:600px; border:1px solid #800C12;">
      <h2 style="color:#D36B4E; border-bottom:1px solid #800C12; padding-bottom:10px;">Apologies - Table Released</h2>
      <p>Dear ${res.name},</p>
      <p>We are very sorry, but your table reservation for Table ${res.table} on ${formatBeautifulDate(res.date)} at ${formatBeautifulTime(res.time)} was cancelled or expired under our 20-minute arrival hold policy.</p>
      <p>As we did not register your arrival within 20 minutes, the table was automatically released to accommodate other guests. We completely understand that schedule conflicts occur and hope to welcome you another time.</p>
      <div style="text-align:center; margin-top:30px;">
        <a href="${BASE_URL}#booking" style="background-color:#D36B4E; color:#FAF6F0; padding:12px 24px; text-decoration:none; font-weight:700; border-radius:4px; display:inline-block;">Select New Time Slot</a>
      </div>
    </div>
  `;
}


// ==========================================
// 3. REST API ENDPOINTS
// ==========================================

app.get('/api/test-db', async (req, res) => {
  try {
    if (!process.env.MONGODB_URI) {
      return res.json({ error: "No MONGODB_URI" });
    }
    const tables = await TableModel.find().lean();
    const reservations = await ReservationModel.find().lean();
    return res.json({
      isMongoConnected,
      tablesCount: tables.length,
      reservationsCount: reservations.length,
      tables: tables.slice(0, 5),
      reservations: reservations
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/tables
app.get('/api/tables', async (req, res) => {
  try {
    await checkReservationTimeouts();
  } catch (err) {
    console.error("Timeout checking failed during GET /api/tables:", err);
  }

  if (process.env.MONGODB_URI) {
    try {
      const tables = await TableModel.find().lean();
      return res.json(tables);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    const data = getLocalData();
    return res.json(data.tables);
  }
});

// GET /api/reservations
app.get('/api/reservations', async (req, res) => {
  try {
    await checkReservationTimeouts();
  } catch (err) {
    console.error("Timeout checking failed during GET /api/reservations:", err);
  }

  if (process.env.MONGODB_URI) {
    try {
      const reservations = await ReservationModel.find().lean();
      const mapped = reservations.map(r => ({ ...r, id: r._id.toString() }));
      return res.json(mapped);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    const data = getLocalData();
    return res.json(data.reservations);
  }
});

// POST /api/reservations (Book online with Auto-Assignment)
app.post('/api/reservations', async (req, res) => {
  const { name, email, phone, guests, date, time } = req.body;
  
  if (!name || !email || !phone || !guests || !date || !time) {
    return res.status(400).json({ success: false, error: "Missing required inputs." });
  }

  const numGuests = parseInt(guests, 10);
  if (isNaN(numGuests) || numGuests < 1 || numGuests > 8) {
    return res.status(400).json({ success: false, error: "Invalid number of guests (1-8)." });
  }

  // Enforce booking window validation (max 24 hours in advance, at least 1 minute prior)
  const selectedDateTime = new Date(`${date}T${time}:00+05:30`);
  const now = new Date();
  const minAdvanceTime = new Date(now.getTime() + 1 * 60 * 1000);
  const maxAdvanceTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  if (selectedDateTime < minAdvanceTime) {
    return res.status(400).json({ success: false, error: "Reservations must be made at least 1 minute in advance." });
  }
  if (selectedDateTime > maxAdvanceTime) {
    return res.status(400).json({ success: false, error: "Reservations can only be made up to 24 hours in advance." });
  }

  // Determine prefix based on guest count capacity
  let prefix = 'A';
  if (numGuests > 2 && numGuests <= 4) {
    prefix = 'B';
  } else if (numGuests > 4 && numGuests <= 6) {
    prefix = 'C';
  } else if (numGuests > 6) {
    prefix = 'D';
  }

  if (process.env.MONGODB_URI) {
    try {
      // Find candidate tables matching capacity prefix
      const candidateTables = await TableModel.find({ id: new RegExp('^' + prefix) });
      
      let assignedTable = null;
      for (const tbl of candidateTables) {
        // Check if there is an active reservation conflict for this table at this date and time
        const conflict = await ReservationModel.findOne({
          table: tbl.id,
          date: date,
          time: time,
          status: { $in: ['approved', 'pending', 'reached'] }
        });
        
        if (!conflict) {
          // If booking date is today, check if table is currently available live
          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (date === todayStr && tbl.status !== 'available') {
            continue;
          }
          assignedTable = tbl;
          break;
        }
      }

      // If no available table is found, try to allocate from blocked-walkin tables if booking starts >= 1 hour in the future
      if (!assignedTable && (selectedDateTime - now >= 60 * 60 * 1000)) {
        const blockedTables = [];
        for (const tbl of candidateTables) {
          if (tbl.status === 'blocked-walkin') {
            const conflict = await ReservationModel.findOne({
              table: tbl.id,
              date: date,
              time: time,
              status: { $in: ['approved', 'pending', 'reached'] }
            });
            if (!conflict) {
              blockedTables.push(tbl);
            }
          }
        }
        
        if (blockedTables.length > 0) {
          // Sort by blockedAt timestamp in ascending order (earliest blocked first)
          blockedTables.sort((a, b) => {
            const timeA = a.blockedAt ? new Date(a.blockedAt).getTime() : 0;
            const timeB = b.blockedAt ? new Date(b.blockedAt).getTime() : 0;
            return timeA - timeB;
          });
          assignedTable = blockedTables[0];
        }
      }

      if (!assignedTable) {
        return res.status(400).json({ success: false, error: "No tables of the required capacity are available at the selected date and time." });
      }
      
      const newRes = new ReservationModel({
        name, email, phone, table: assignedTable.id, date, time, status: 'approved'
      });
      await newRes.save();
      
      // Update live status of the assigned table ONLY if it starts in 90 mins or less
      if (selectedDateTime - now <= 90 * 60 * 1000) {
        if (assignedTable.status !== 'blocked-walkin') {
          assignedTable.status = 'reserved';
        }
        assignedTable.currentReservationId = newRes._id.toString();
        await assignedTable.save();
      } else {
        // If not starting in 90 mins, we still link it if the table is blocked-walkin
        if (assignedTable.status === 'blocked-walkin') {
          assignedTable.currentReservationId = newRes._id.toString();
          await assignedTable.save();
        }
      }
      
      // Dispatch Notices in parallel to minimize response lag
      await Promise.all([
        sendMailSafe(process.env.ADMIN_EMAIL || 'admin@cafekubera.com', "New Booking Alert", getAdminNoticeHTML(newRes)),
        sendMailSafe(newRes.email, "Reservation Approved", getArrivalHTML(newRes))
      ]).catch(err => console.error("Error sending booking notification emails:", err));
      
      return res.status(201).json({ success: true, reservationId: newRes._id, table: assignedTable.id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    // Local JSON DB
    try {
      const data = getLocalData();
      const candidateTables = data.tables.filter(t => t.id.startsWith(prefix));
      
      let assignedTable = null;
      for (const tbl of candidateTables) {
        // Check if there is an active reservation conflict in local array
        const conflict = data.reservations.find(r => 
          r.table === tbl.id &&
          r.date === date &&
          r.time === time &&
          ['approved', 'pending', 'reached'].includes(r.status)
        );
        
        if (!conflict) {
          // If booking date is today, check if table is currently available live
          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (date === todayStr && tbl.status !== 'available') {
            continue;
          }
          assignedTable = tbl;
          break;
        }
      }

      // If no available table is found, try to allocate from blocked-walkin tables if booking starts >= 1 hour in the future
      if (!assignedTable && (selectedDateTime - now >= 60 * 60 * 1000)) {
        const blockedTables = [];
        for (const tbl of candidateTables) {
          if (tbl.status === 'blocked-walkin') {
            const conflict = data.reservations.find(r => 
              r.table === tbl.id &&
              r.date === date &&
              r.time === time &&
              ['approved', 'pending', 'reached'].includes(r.status)
            );
            if (!conflict) {
              blockedTables.push(tbl);
            }
          }
        }
        
        if (blockedTables.length > 0) {
          // Sort by blockedAt timestamp in ascending order (earliest blocked first)
          blockedTables.sort((a, b) => {
            const timeA = a.blockedAt ? new Date(a.blockedAt).getTime() : 0;
            const timeB = b.blockedAt ? new Date(b.blockedAt).getTime() : 0;
            return timeA - timeB;
          });
          assignedTable = blockedTables[0];
        }
      }

      if (!assignedTable) {
        return res.status(400).json({ success: false, error: "No tables of the required capacity are available at the selected date and time." });
      }
      
      const newId = Math.random().toString(36).substr(2, 9);
      const newRes = {
        id: newId,
        name, email, phone, table: assignedTable.id, date, time,
        status: 'approved',
        createdAt: new Date().toISOString()
      };
      
      // Update local table entry live status ONLY if it starts in 90 mins or less
      const dbTable = data.tables.find(t => t.id === assignedTable.id);
      if (dbTable) {
        if (selectedDateTime - now <= 90 * 60 * 1000) {
          if (dbTable.status !== 'blocked-walkin') {
            dbTable.status = 'reserved';
          }
          dbTable.currentReservationId = newId;
        } else {
          // If not starting in 90 mins, we still link it if the table is blocked-walkin
          if (dbTable.status === 'blocked-walkin') {
            dbTable.currentReservationId = newId;
          }
        }
      }
      
      data.reservations.push(newRes);
      saveLocalData(data);
      
      // Dispatch Notices in parallel to minimize response lag
      await Promise.all([
        sendMailSafe(process.env.ADMIN_EMAIL || 'admin@cafekubera.com', "New Booking Alert", getAdminNoticeHTML(newRes)),
        sendMailSafe(newRes.email, "Reservation Approved", getArrivalHTML(newRes))
      ]).catch(err => console.error("Error sending booking notification emails:", err));
      
      return res.status(201).json({ success: true, reservationId: newId, table: assignedTable.id });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
});

// PATCH /api/reservations (Update reservation state)
app.patch('/api/reservations', async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ success: false, error: "Missing ID or Status." });
  }

  if (process.env.MONGODB_URI) {
    try {
      const resVal = await ReservationModel.findById(id);
      if (!resVal) return res.status(404).json({ success: false, error: "Reservation not found." });
      
      resVal.status = status;
      
      // Update Table Status
      const tbl = await TableModel.findOne({ id: resVal.table });
      if (tbl) {
        if (status === 'reached') {
          // If the assigned table is still blocked for walk-ins, upgrade to the next capacity segment
          if (tbl.status === 'blocked-walkin') {
            const originalPrefix = resVal.table[0];
            let upgradePrefixes = [];
            if (originalPrefix === 'A') upgradePrefixes = ['B', 'C', 'D'];
            else if (originalPrefix === 'B') upgradePrefixes = ['C', 'D'];
            else if (originalPrefix === 'C') upgradePrefixes = ['D'];

            let upgradedTable = null;
            for (const prefix of upgradePrefixes) {
              const availableInPrefix = await TableModel.findOne({
                id: new RegExp('^' + prefix),
                status: 'available'
              });
              if (availableInPrefix) {
                upgradedTable = availableInPrefix;
                break;
              }
            }

            if (upgradedTable) {
              console.log(`Upgrading reservation ${id} from Table ${resVal.table} to Table ${upgradedTable.id} on arrival`);
              // Clear currentReservationId on the original table (but keep it as blocked-walkin)
              tbl.currentReservationId = null;
              await tbl.save();

              // Update reservation to point to the new upgraded table
              resVal.table = upgradedTable.id;

              // Seated at upgraded table
              upgradedTable.status = 'occupied';
              upgradedTable.currentReservationId = resVal._id.toString();
              await upgradedTable.save();
            } else {
              // No upgraded table available, fallback to original table
              tbl.status = 'occupied';
              await tbl.save();
            }
          } else {
            // Normal check-in
            tbl.status = 'occupied';
            tbl.currentReservationId = resVal._id.toString();
            await tbl.save();
          }
        } else if (['left', 'cancelled', 'no-show'].includes(status)) {
          // If table was blocked-walkin, keep it blocked-walkin
          if (tbl.status !== 'blocked-walkin') {
            tbl.status = 'available';
          }
          tbl.currentReservationId = null;
          await tbl.save();
        }
      }
      
      await resVal.save();
      
      // Send reschedule mail if no-show or cancelled
      if (['cancelled', 'no-show'].includes(status)) {
        await sendMailSafe(resVal.email, "Reservation Cancelled", getRescheduleHTML(resVal));
      }
      
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    const data = getLocalData();
    const resVal = data.reservations.find(r => r.id === id);
    if (!resVal) return res.status(404).json({ success: false, error: "Reservation not found." });
    
    resVal.status = status;
    
    const tbl = data.tables.find(t => t.id === resVal.table);
    if (tbl) {
      if (status === 'reached') {
        // If the assigned table is still blocked for walk-ins, upgrade to the next capacity segment
        if (tbl.status === 'blocked-walkin') {
          const originalPrefix = resVal.table[0];
          let upgradePrefixes = [];
          if (originalPrefix === 'A') upgradePrefixes = ['B', 'C', 'D'];
          else if (originalPrefix === 'B') upgradePrefixes = ['C', 'D'];
          else if (originalPrefix === 'C') upgradePrefixes = ['D'];

          let upgradedTable = null;
          for (const prefix of upgradePrefixes) {
            const availableInPrefix = data.tables.find(t => t.id.startsWith(prefix) && t.status === 'available');
            if (availableInPrefix) {
              upgradedTable = availableInPrefix;
              break;
            }
          }

          if (upgradedTable) {
            console.log(`Local Upgrade reservation ${id} from Table ${resVal.table} to Table ${upgradedTable.id} on arrival`);
            // Clear currentReservationId on the original table (but keep it as blocked-walkin)
            tbl.currentReservationId = null;

            // Update reservation to point to the new upgraded table
            resVal.table = upgradedTable.id;

            // Seated at upgraded table
            upgradedTable.status = 'occupied';
            upgradedTable.currentReservationId = resVal.id;
          } else {
            // Fallback
            tbl.status = 'occupied';
          }
        } else {
          // Normal check-in
          tbl.status = 'occupied';
          tbl.currentReservationId = resVal.id;
        }
      } else if (['left', 'cancelled', 'no-show'].includes(status)) {
        // If table was blocked-walkin, keep it blocked-walkin
        if (tbl.status !== 'blocked-walkin') {
          tbl.status = 'available';
        }
        tbl.currentReservationId = null;
      }
    }
    
    saveLocalData(data);
    
    if (['cancelled', 'no-show'].includes(status)) {
      await sendMailSafe(resVal.email, "Reservation Cancelled", getRescheduleHTML(resVal));
    }
    
    return res.json({ success: true });
  }
});

// POST /api/tables/block (Block table walk-in)
app.post('/api/tables/block', async (req, res) => {
  const { table } = req.body;
  if (!table) return res.status(400).json({ success: false, error: "Missing Table ID." });

  if (process.env.MONGODB_URI) {
    try {
      const tbl = await TableModel.findOne({ id: table, status: 'available' });
      if (!tbl) return res.status(400).json({ success: false, error: "Table not available for blocking." });
      
      tbl.status = 'blocked-walkin';
      tbl.blockedAt = new Date().toISOString();
      await tbl.save();
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    const data = getLocalData();
    const tbl = data.tables.find(t => t.id === table && t.status === 'available');
    if (!tbl) return res.status(400).json({ success: false, error: "Table not available for blocking." });
    
    tbl.status = 'blocked-walkin';
    tbl.blockedAt = new Date().toISOString();
    saveLocalData(data);
    return res.json({ success: true });
  }
});

// POST /api/tables/release (Release table)
app.post('/api/tables/release', async (req, res) => {
  const { table } = req.body;
  if (!table) return res.status(400).json({ success: false, error: "Missing Table ID." });

  if (process.env.MONGODB_URI) {
    try {
      const tbl = await TableModel.findOne({ id: table });
      if (!tbl) return res.status(404).json({ success: false, error: "Table not found." });
      
      // If table has a reservation waiting, only lock if it starts in 90 mins or less
      let shouldBeReserved = false;
      if (tbl.currentReservationId) {
        const r = await ReservationModel.findById(tbl.currentReservationId);
        if (r && ['approved', 'pending'].includes(r.status)) {
          const resTime = new Date(`${r.date}T${r.time}:00+05:30`);
          const now = new Date();
          if (resTime - now <= 90 * 60 * 1000) {
            shouldBeReserved = true;
          }
        }
      }

      if (shouldBeReserved) {
        tbl.status = 'reserved';
      } else {
        tbl.status = 'available';
        tbl.currentReservationId = null;
      }
      tbl.blockedAt = null;
      await tbl.save();
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    const data = getLocalData();
    const tbl = data.tables.find(t => t.id === table);
    if (!tbl) return res.status(404).json({ success: false, error: "Table not found." });
    
    // If table has a reservation waiting, only lock if it starts in 90 mins or less
    let shouldBeReserved = false;
    if (tbl.currentReservationId) {
      const r = data.reservations.find(res => res.id === tbl.currentReservationId);
      if (r && ['approved', 'pending'].includes(r.status)) {
        const resTime = new Date(`${r.date}T${r.time}:00+05:30`);
        const now = new Date();
        if (resTime - now <= 90 * 60 * 1000) {
          shouldBeReserved = true;
        }
      }
    }

    if (shouldBeReserved) {
      tbl.status = 'reserved';
    } else {
      tbl.status = 'available';
      tbl.currentReservationId = null;
    }
    tbl.blockedAt = null;
    saveLocalData(data);
    return res.json({ success: true });
  }
});


// ==========================================
// 4. AUTOMATED HOLD MONITORING (20-Minute Hold check)
// ==========================================
async function checkReservationTimeouts() {
  const now = new Date();
  
  if (process.env.MONGODB_URI) {
    try {
      // Find all bookings with approved/pending state
      const activeResList = await ReservationModel.find({ status: { $in: ['pending', 'approved'] } });
      
      for (const res of activeResList) {
        const resTime = new Date(`${res.date}T${res.time}:00+05:30`);
        const expirationTime = new Date(resTime.getTime() + 20 * 60 * 1000);
        
        // 1. Expiration check
        if (now > expirationTime) {
          console.log(`Reservation ${res._id} for Table ${res.table} timed out.`);
          res.status = 'no-show';
          await res.save();
          
          const tbl = await TableModel.findOne({ id: res.table });
          if (tbl && tbl.currentReservationId === res._id.toString()) {
            if (tbl.status !== 'blocked-walkin') {
              tbl.status = 'available';
            }
            tbl.currentReservationId = null;
            await tbl.save();
          }
          
          // Send rescheduling mail
          await sendMailSafe(res.email, "Reservation Hold Expired", getRescheduleHTML(res));
        }
        // 2. 90-minute Activation check
        else {
          const diffMs = resTime - now;
          if (diffMs <= 90 * 60 * 1000 && diffMs >= -20 * 60 * 1000) {
            const tbl = await TableModel.findOne({ id: res.table });
            if (tbl && (tbl.status === 'available' || tbl.status === 'blocked-walkin')) {
              tbl.status = 'reserved';
              tbl.currentReservationId = res._id.toString();
              await tbl.save();
              console.log(`Activated live reservation ${res._id} on Table ${res.table} (starts in ${Math.round(diffMs / 60000)} mins).`);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error checking timeouts on MongoDB:", err);
    }
  } else {
    // Local JSON
    try {
      const data = getLocalData();
      let changed = false;
      
      for (const res of data.reservations) {
        if (['pending', 'approved'].includes(res.status)) {
          const resTime = new Date(`${res.date}T${res.time}:00+05:30`);
          const expirationTime = new Date(resTime.getTime() + 20 * 60 * 1000);
          
          // 1. Expiration check
          if (now > expirationTime) {
            console.log(`Local Reservation ${res.id} timed out.`);
            res.status = 'no-show';
            changed = true;
            
            const tbl = data.tables.find(t => t.id === res.table);
            if (tbl && tbl.currentReservationId === res.id) {
              if (tbl.status !== 'blocked-walkin') {
                tbl.status = 'available';
              }
              tbl.currentReservationId = null;
            }
            
            await sendMailSafe(res.email, "Reservation Hold Expired", getRescheduleHTML(res));
          }
          // 2. 90-minute Activation check
          else {
            const diffMs = resTime - now;
            if (diffMs <= 90 * 60 * 1000 && diffMs >= -20 * 60 * 1000) {
              const tbl = data.tables.find(t => t.id === res.table);
              if (tbl && (tbl.status === 'available' || tbl.status === 'blocked-walkin')) {
                tbl.status = 'reserved';
                tbl.currentReservationId = res.id;
                changed = true;
                console.log(`Activated local live reservation ${res.id} on Table ${res.table} (starts in ${Math.round(diffMs / 60000)} mins).`);
              }
            }
          }
        }
      }
      if (changed) saveLocalData(data);
    } catch (err) {
      console.error("Error checking timeouts on JSON db:", err);
    }
  }
}

// Tick check timeouts every 15 seconds (only when not running in serverless environments like Vercel)
if (!process.env.VERCEL) {
  setInterval(checkReservationTimeouts, 15000);
}


// Start server locally, or export for serverless environments (Vercel)
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Cafe Kubera full-stack Express server listening at ${BASE_URL}`);
  });
}

module.exports = app;
