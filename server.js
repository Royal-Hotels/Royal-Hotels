"use strict";
// Import required modules
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// Create an Express application
const app = express();

// Server PORT
const PORT = process.env.PORT;

// Enable CORS middleware
app.use(cors());

// Enable JSON parsing middleware
app.use(express.json());

// Database config
const { Client } = require("pg");
const url = process.env.DATABASE_URL;
const client = new Client(url);

// Define your other routes here...

// Route handler for the root route "/"
app.get("/", (req, res) => {
  res.status(200).send("Welcome To Our World!");
});

// Middleware to handle page not found (404) errors
app.use((req, res, next) => {
  res.status(404).send("Page not found");
});

// Middleware to handle internal server errors (500)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
