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

// Route to delete a room reservation based on user ID and reservation ID
app.delete("/reservations/:userId/:reservationId", async (req, res) => {
  const { userId, reservationId } = req.params;

  try {
    // Check if the user exists
    const userQuery = "SELECT * FROM Users WHERE user_id = $1";
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the reservation exists
    const reservationQuery = "SELECT * FROM Reservation WHERE reservation_id = $1";
    const reservationResult = await client.query(reservationQuery, [reservationId]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = reservationResult.rows[0];

    // Check if the reservation is within the allowed cancellation timeline
    const currentDate = new Date();
    const checkInDate = new Date(reservation.check_in_date);
    
    if (currentDate >= checkInDate) {
      return res.status(400).json({ error: "Cannot cancel reservation within the timeline" });
    }

    // Delete the reservation
    const deleteReservationQuery = "DELETE FROM Reservation WHERE reservation_id = $1 RETURNING *";
    const deletedReservation = await client.query(deleteReservationQuery, [reservationId]);

    res.status(200).json({ message: "Reservation deleted successfully", deletedReservation: deletedReservation.rows[0] });
  } catch (error) {
    console.error("Error deleting reservation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


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