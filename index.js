const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Needed to read req.body

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster-1.dymuola.mongodb.net/?appName=Cluster-1`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  tls: true,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("techtrove_db");
    const productCollection = db.collection("techtrove_products");
    const userCollection = db.collection("techtrove_users");

    // ====== USER INFO ======
    // USER SIGN UP
    app.post("/signup", async (req, res) => {
      try {
        const { name, email, username, password } = req.body;

        if (!name || !email || !username || !password) {
          return res.status(400).send({ error: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).send({ error: "Email already registered" });
        }

        // Hash password

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user document
        const newUser = {
          name,
          email,
          username,
          password: hashedPassword,
          createdAt: new Date(),
        };

        // Save user
        const result = await userCollection.insertOne(newUser);

        res.send({
          success: true,
          message: "User registered successfully",
          userId: result.insertedId,
        });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // USER LOGIN
    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).send({ error: "Email and password required" });
        }

        // Find user by email
        const user = await userCollection.findOne({
          email: email.toLowerCase(),
        });

        if (!user) {
          return res.status(401).send({ error: "Invalid credentials" });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(401).send({ error: "Invalid credentials" });
        }

        // Successful login
        res.send({
          success: true,
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            username: user.username,
          },
        });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // GOOGLE SIGNUP (or login if user exists)
    app.post("/google-signup", async (req, res) => {
      try {
        const { email, name, googleId } = req.body;

        if (!email || !name || !googleId) {
          return res.status(400).send({ error: "Missing required fields" });
        }

        // Check if user already exists
        let user = await userCollection.findOne({ email });

        if (!user) {
          // Create new user
          const newUser = {
            name,
            email,
            googleId,
            createdAt: new Date(),
          };

          const result = await userCollection.insertOne(newUser);
          user = { ...newUser, id: result.insertedId.toString() };
        }

        res.send({ success: true, user });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // ====== CRUD ROUTES ======

    // GET /products?category=Laptop
    // GET /products?category=Laptop&search=mouse
    app.get("/products", async (req, res) => {
      try {
        const { category, search } = req.query;
        let query = {};

        if (category) {
          query.category = category;
        }

        if (search) {
          query.title = { $regex: search, $options: "i" }; // case-insensitive search
        }

        const products = await productCollection.find(query).toArray();
        res.send(products);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // Get single product by MongoDB _id
    app.get("/product/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const product = await productCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!product)
          return res.status(404).send({ error: "Product not found" });
        res.send(product);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // Add new product
    app.post("/product", async (req, res) => {
      try {
        const newProduct = req.body; // Make sure your JSON does NOT have _id
        const result = await productCollection.insertOne(newProduct);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // Update product
    app.patch("/product/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid product ID" });
        }

        const updateData = req.body;

        // Convert released_date to a JS Date object if it exists
        if (updateData.released_date) {
          updateData.released_date = new Date(updateData.released_date);
        }

        console.log("FINAL UPDATE DATA:", updateData);

        const result = await productCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        res.send(result);
      } catch (err) {
        console.error("MONGO ERROR:", err);
        res.status(500).send({ error: err.message });
      }
    });

    // Delete product
    app.delete("/product/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await productCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}

// Test route
app.get("/", (req, res) => {
  res.send("Server is running...");
});

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
