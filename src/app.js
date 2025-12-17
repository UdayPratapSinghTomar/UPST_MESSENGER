const express = require("express");
const cors = require("cors");
const app = express();
const path = require('path');

// const PORT = 3000;
app.use(cors());
app.use(express.json());

const db = require('./models')

async function syncDatabase() {
  try {
    await db.sequelize.sync({ alter: true })

    console.log('✅ Database synced successfully\n')

    console.log('📦 Synced Tables:')
    Object.keys(db)
      .filter(model => model !== 'sequelize')
      .forEach(model => {
        console.log(` - ${db[model].getTableName()}`)
      })

  } catch (error) {
    console.error('❌ Sync error:', error)
  }
}

syncDatabase()

const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const notificationRoutes = require('./routes/notificationRoutes');

app.use("/user", userRoutes);
app.use("/chat", chatRoutes);
app.use("/media", mediaRoutes);
app.use("/notification", notificationRoutes);

app.use('/uploads', express.static(path.join(__dirname,  'uploads')));

module.exports = app;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));