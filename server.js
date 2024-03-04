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
// --------------- GET ---------------
// Route handler for the root route "/"
app.get("/", (req, res) => {
  res.status(200).send("Hello World!");
});
app.get("/converter", async (req, res) => {
  const { from, to, amount } = req.body;
  const options = {
    method: "GET",
    url: "https://currency-converter-pro1.p.rapidapi.com/convert",
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
    res.status(200).json(response.data.result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// Route to get all avalible rooms
app.get("/avalibale-rooms", (req, res) => {
  const sql = "SELECT * FROM room WHERE is_available = true";

  client
    .query(sql)
    .then((result) => {
      const availableRoomIds = result.rows;

      res.json({ availableRoomIds });
    })
    .catch((error) => {
      console.error("Error fetching available room IDs:", error);
      res.status(500).json({ error: "Internal server error" });
    });
});
// Return all users
app.get("/getusers", (req, res) => {
  let sql = `SELECT * FROM users`;
  client
    .query(sql)
    .then((result) => {
      res.json(result.rows);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    });
});
// Return user if exists.
app.get("/getuser/:id", (req, res) => {
  let userId = req.params.id;
  let sql = `SELECT * FROM users WHERE user_id = ${userId}`;
  client
    .query(sql)
    .then((result) => {
      if (result.rows.length === 0) {
        return res.send("User Doesn't Exist");
      }
      res.json(result.rows[0]);
      // res.send("successfully updated");
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    });
});
// Route for get all reservations for user
app.get("/users/:userId", async (req, res, next) => {
  const { userId } = req.params;

  try {
    // Query the database to retrieve reservations for the user
    const result = await client.query(
      "SELECT * FROM reservation WHERE user_id = $1",
      [userId]
    );

    // Send the retrieved reservations as a response
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});
// Route to get all active reservations
app.get("/reservations", async (req, res) => {
  try {
    // Query to fetch all active reservations
    const query = `
      SELECT * 
      FROM reservation 
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
// --------------- POST ---------------
// User registration.
app.post("/user", (req, res) => {
  // Check whether email already exists
  const check = `SELECT * FROM users WHERE email = $1`;
  const checkedValue = [req.body.email];
  client.query(check, checkedValue).then((result) => {
    if (result.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    } else {
      // Continue with the user insertion
      const { username, phone, email, password_hash } = req.body;
      const sql = `INSERT INTO users (username, phone, email, password_hash)
          VALUES ($1, $2, $3, $4) RETURNING *`;
      const values = [username, phone, email, password_hash];
      client
        .query(sql, values)
        .then((result) => {
          console.log(result.rows);
          res.status(201).json(result.rows);
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: "Internal Server Error" });
        });
    }
  });
});
// Route for adding a new branch
app.post("/branches", async (req, res) => {
  try {
    const { branch_name, location } = req.body;

    const result = await client.query(
      "INSERT INTO branch (branch_name, location) VALUES ($1, $2) RETURNING *",
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
    const branchQuery = "SELECT * FROM branch WHERE branch_id = $1";
    const branchResult = await client.query(branchQuery, [branchId]);

    if (branchResult.rows.length === 0) {
      return res.status(404).json({ error: "Branch not found" });
    }

    // Insert the room into the Room table
    const roomQuery =
      "INSERT INTO room (branch_id, room_number, capacity, price) VALUES ($1, $2, $3, $4) RETURNING *";
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
// Route to create a new reservation
app.post("/reservations/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { room_id, check_in_date, check_out_date } = req.body;

    // Increment check-in and check-out dates by 1 day
    const newInDate = new Date(
      new Date(check_in_date).getTime() + 24 * 60 * 60 * 1000
    );
    const newOutDate = new Date(
      new Date(check_out_date).getTime() + 24 * 60 * 60 * 1000
    );

    // Insert the new reservation
    const insertReservationQuery =
      "INSERT INTO reservation (user_id, room_id, check_in_date, check_out_date) VALUES ($1, $2, $3, $4) RETURNING *";
    const reservationValues = [user_id, room_id, newInDate, newOutDate];

    const result = await client.query(
      insertReservationQuery,
      reservationValues
    );

    // Update is_available to false in the room table for the reserved room
    const updateRoomQuery =
      "UPDATE room SET is_available = false WHERE room_id = $1";
    const updateRoomValues = [room_id];
    await client.query(updateRoomQuery, updateRoomValues);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating reservation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// --------------- PUT ---------------
// Route for updating check-in and check-out dates of a reservation
app.put("/reservations/:id", async (req, res, next) => {
  const { id } = req.params;
  const { check_in_date, check_out_date } = req.body;

  try {
    // Check if the reservation exists in the database
    const existingReservation = await client.query(
      "SELECT check_in_date FROM reservation WHERE reservation_id = $1",
      [id]
    );

    if (existingReservation.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const existingCheckInDate = new Date(
      existingReservation.rows[0].check_in_date
    );

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
      [check_in_date, check_out_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.status(200).json({
      message: "Reservation updated successfully",
      reservation: result.rows,
    });
  } catch (error) {
    next(error);
  }
});
// --------------- DELETE ---------------
// Route to delete a room reservation based on user ID and reservation ID
app.delete("/reservations/:userId/:reservationId", async (req, res) => {
  const { userId, reservationId } = req.params;

  try {
    // Check if the user exists
    const userQuery = "SELECT * FROM users WHERE user_id = $1";
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the reservation exists
    const reservationQuery =
      "SELECT * FROM reservation WHERE reservation_id = $1";
    const reservationResult = await client.query(reservationQuery, [
      reservationId,
    ]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    const reservation = reservationResult.rows[0];

    // Check if the reservation is within the allowed cancellation timeline
    const currentDate = new Date();
    const checkInDate = new Date(reservation.check_in_date);

    if (currentDate >= checkInDate) {
      return res
        .status(400)
        .json({ error: "Cannot cancel reservation within the timeline" });
    }

    // Delete the reservation
    const deleteReservationQuery =
      "DELETE FROM reservation WHERE reservation_id = $1 RETURNING *";
    const deletedReservation = await client.query(deleteReservationQuery, [
      reservationId,
    ]);

    res.status(200).json({
      message: "Reservation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reservation:", error);
    res.status(500).json({ error: "Internal server error" });
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
