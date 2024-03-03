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

// Route for adding a new branch
app.post("/branches", async (req, res) => {
  try {
    const { branch_name, location } = req.body;

    const result = await client.query(
      "INSERT INTO Branch (branch_name, location) VALUES ($1, $2) RETURNING *",
      [branch_name, location]
    );
    const branch = result.rows[0];
    res
      .status(201)
      .json({ message: "Branch added successfully", branch: branch });
  } catch (error) {
    console.error("Error executing query", error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the branch" });
  }
});

// Route to add a room for a certain branch
app.post("/branches/:branchId", async (req, res) => {
  const { branchId } = req.params;
  const { room_number, capacity, price } = req.body;

  try {
    // Check if the branch exists
    const branchQuery = "SELECT * FROM Branch WHERE branch_id = $1";
    const branchResult = await client.query(branchQuery, [branchId]);

    if (branchResult.rows.length === 0) {
      return res.status(404).json({ error: "Branch not found" });
    }

    // Insert the room into the Room table
    const roomQuery =
      "INSERT INTO Room (branch_id, room_number, capacity, price) VALUES ($1, $2, $3, $4) RETURNING *";
    const roomResult = await client.query(roomQuery, [
      branchId,
      room_number,
      capacity,
      price,
    ]);

    res.status(201).json(roomResult.rows);
  } catch (error) {
    console.error("Error adding room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get all active reservations
app.get("/reservations", async (req, res) => {
  try {
    // Query to fetch all active reservations
    const query = `
      SELECT * 
      FROM Reservation 
      WHERE is_active = true;
    `;

    // Execute the query
    const { rows } = await client.query(query);

    // Send the response with the reservations
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching active reservations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to create new reservations
app.post("/reservations/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params; 
    const { room_id, check_in_date, check_out_date } = req.body;


    const reservationOverlapQuery = `
      SELECT * FROM reservation
      WHERE room_id = $1
      AND (
        (check_in_date <= $2 AND check_out_date >= $2)
        OR (check_in_date <= $3 AND check_out_date >= $3)
        OR (check_in_date >= $2 AND check_out_date <= $3)
      )
      AND is_active = true;
    `;

    const overlapResult = await client.query(reservationOverlapQuery, [
      room_id,
      check_in_date,
      check_out_date,
    ]);

    if (overlapResult.rows.length > 0) {
      const returnDate = overlapResult.rows[0].check_out_date;
      return res.status(400).json({ error: `This room is reserved. Please choose another date. The room will be available after ${returnDate}.` });
    }

    const resSQL = "INSERT INTO reservation ( user_id, room_id, check_in_date, check_out_date ) VALUES ($1,$2,$3,$4) RETURNING *;";
    const resValue = [user_id, room_id, check_in_date, check_out_date];

    const result = await client.query(resSQL, resValue);
    console.log(result.rows)
    res.status(201).json(result.rows[0])

  } catch (error) {
    console.error("Error Creating reservations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
})



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
client
  .connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) =>
    console.error("Error connecting to PostgreSQL database", err)
  );