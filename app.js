const express = require('express');
const Book = require('./models/Book');
const userRoutes = require('./routes/user');
const bookRoutes = require('./routes/book');
const path = require('path');

const mongoose = require('mongoose');
const uri = "mongodb+srv://Admin:testpassword@cluster0.z1ytgzu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
mongoose.connect(uri, clientOptions)
  .then(() => console.log("Connexion à MongoDB réussie !"))
  .catch(err => console.error("Erreur de connexion MongoDB :", err));

const app = express();

// Régler les erreurs CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  next();
});

app.use(express.json());

app.use('/api/books', bookRoutes);
app.use('/api/auth', userRoutes);
app.use('/images', express.static(path.join(__dirname, 'images')));

module.exports = app;