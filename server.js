"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const PORT = process.env.PORT;
const app = express();
app.use(cors());
app.use(express.json());
const { Client } = require("pg");
const url = process.env.DATABASE_URL;
const client = new Client(url);
const bcrypt = require("bcrypt");

// Define your other routes here...
// --------------- Admin ---------------

// Route for adding a new branch
app.post("/adminNewBranch", async (req, res) => {
  const { branch_name, location, image_url } = req.body;
  const query =
    "INSERT INTO branch (branch_name, location, image_url) VALUES ($1, $2, $3) RETURNING *";
  const values = [branch_name, location, image_url];
  try {
    const result = await client.query(query, values);
    res
      .status(201)
      .json({ message: "Branch added successfully", branch: result.rows[0] });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while adding the branch" });
  }
});
// Route to add a room for a certain branch
app.post("/adminNewRoom/:branchId", async (req, res) => {
  const { branchId } = req.params;
  const { room_number, capacity, price, image_url } = req.body;
  const query = "SELECT * FROM branch WHERE branch_id = $1";
  const values = [branchId];
  const roomQuery =
    "INSERT INTO room (branch_id, room_number, capacity, price, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *";
  const roomValues = [branchId, room_number, capacity, price, image_url];
  try {
    // Check if the branch exists
    const getBranchs = await client.query(query, values);
    if (getBranchs.rows.length === 0) {
      return res.status(404).json({ error: "Branch not found" });
    }
    // Insert the room into the Room table
    const addRoom = await client.query(roomQuery, roomValues);
    res
      .status(201)
      .json({ message: "Room added successfully", room: addRoom.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get all active reservations
app.get("/adminAllRes", async (req, res) => {
  const query = "SELECT * FROM reservation WHERE is_active = true;";
  try {
    const getRes = await client.query(query);
    res.status(200).json({ message: "success", reservations: getRes.rows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// Return all users
app.get("/adminAllUsers", (req, res) => {
  let sql = `SELECT * FROM users`;
  client
    .query(sql)
    .then((result) => {
      res.status(200).json(result.rows);
    })
    .catch((error) => {
      res.status(500).json({ error: "Internal Server Error" });
    });
});

// --------------- Users ---------------

// API Route for converting $
app.get("/usersConv", async (req, res) => {
  const { from, to, amount } = req.body;
  const options = {
    url: process.env.API_URL,
    params: {
      from: from,
      to: to,
      amount: amount,
    },
    headers: {
      "X-RapidAPI-Key": process.env.API_KEY,
      "X-RapidAPI-Host": "currency-converter-pro1.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    res.status(200).json({ message: "success", result: response.data.result });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get all avalible rooms
app.get("/usersRooms", async (req, res) => {
  try {
    const query = "SELECT * FROM room WHERE is_available = true";
    const result = await client.query(query);
    const availableRoomIds = result.rows;
    res.status(200).json({ message: "success", result: result.rows });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to create a new reservation
app.post("/usersRooms/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { room_id, check_in_date, check_out_date } = req.body;
  try {
    const query =
      "INSERT INTO reservation (user_id, room_id, check_in_date, check_out_date) VALUES ($1, $2, $3, $4) RETURNING *";
    const values = [user_id, room_id, check_in_date, check_out_date];
    const result = await client.query(query, values);

    const updateQuery =
      "UPDATE room SET is_available = false WHERE room_id = $1";
    const updateValues = [room_id];
    await client.query(updateQuery, updateValues);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route for get all reservations for user
app.get("/usersRes/:userId", async (req, res, next) => {
  const { userId } = req.params;
  const query = "SELECT * FROM reservation WHERE user_id = $1";
  const values = [userId];
  try {
    const result = await client.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route for updating check-in and check-out dates of a reservation
app.put("/usersRes/:resId", async (req, res, next) => {
  const { resId } = req.params;
  const { check_in_date, check_out_date } = req.body;

  try {
    // Check if the reservation exists in the database
    const existingReservation = await client.query(
      "SELECT check_in_date FROM reservation WHERE reservation_id = $1",
      [resId]
    );

    if (existingReservation.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const existingCheckInDate = new Date(
      existingReservation.rows[0].check_in_date
    );
    console.log(check_in_date);
    console.log(existingCheckInDate);
    // Check if the existing check-in date is before the current date
    const currentDate = new Date();
    if (existingCheckInDate <= currentDate) {
      return res.status(400).json({
        error: "Cannot change check-in date because it has already passed",
      });
    }

    // Update the reservation with new check-in and check-out dates
    const result = await client.query(
      "UPDATE reservation SET check_in_date = $1, check_out_date = $2 WHERE reservation_id = $3 RETURNING *",
      [check_in_date, check_out_date, resId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.status(200).json({
      message: "Reservation updated successfully",
      reservation: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Route to delete a room reservation based on user ID and reservation ID
app.delete("/usersRes/:userId/:resId", async (req, res) => {
  const { userId, resId } = req.params;

  try {
    const userQuery = "SELECT * FROM users WHERE user_id = $1";
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const reservationQuery = "SELECT * FROM reservation WHERE reservation_id = $1";
    const reservationResult = await client.query(reservationQuery, [resId]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = reservationResult.rows[0];

    const currentDate = new Date();
    const checkInDate = new Date(reservation.check_in_date);

    if (currentDate >= checkInDate) {
      return res.status(400).json({ error: "Cannot cancel reservation within the timeline" });
    }
    const deleteReservationQuery = "DELETE FROM reservation WHERE reservation_id = $1 RETURNING *";
    const deletedReservation = await client.query(deleteReservationQuery, [resId]);
    if (deletedReservation.rows.length === 0) {
      return res.status(500).json({ error: "Failed to cancel reservation" });
    }

    res.status(204).send(); 
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// --------------- Form ---------------

// User registration.
app.post("/register", async (req, res) => {
  try {
    const { username, phone, email, password_hash } = req.body;
    const hash_pass = await bcrypt.hash(password_hash, 10);

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!gmailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const checkQuery = "SELECT * FROM users WHERE email = $1";
    const checkResult = await client.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }
    const insertQuery = `INSERT INTO users (username, phone, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *`;
    const insertValues = [username, phone, email, hash_pass];
    const insertResult = await client.query(insertQuery, insertValues);
    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// User Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await client.query(query, [email]);
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Compare hashed password with provided password
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (isPasswordValid) {
      res.status(200).json(user);
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// --------------- Others---------------
// Route Get all branchs
app.get("/allBranchs", async (req, res) => {
  const query = "SELECT * FROM branch";
  try {
    const result = await client.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------- HANDLE ERROR ---------------

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
