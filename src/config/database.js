// const { Sequelize } = require('sequelize')
// require('dotenv').config()

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASSWORD,
//   {
//     host: process.env.DB_HOST,
//     dialect: 'postgres',
//     logging: false
//   }
// )

// module.exports = sequelize

// const { Sequelize } = require("sequelize");
// require('dotenv').config();
// const sequelize = new Sequelize(process.env.DB_URL, {
//   dialect: "postgres",
//   logging: false,
//   dialectOptions: {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false,
//     },
//   },
// });
 
// module.exports = sequelize;

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;

// 🔐 For normal APIs (RLS applied)
const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

// 🔥 ADMIN CLIENT (bypass RLS)
const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = { supabase, supabaseAdmin };