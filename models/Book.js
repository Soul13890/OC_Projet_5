const mongoose = require('mongoose');

const bookSchema = mongoose.Schema({
  title: { type: String, required: true },
  rating: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  userId: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: Number, required: true },
  categorie: { type: String, required: true },
});

module.exports = mongoose.model('Book', bookSchema);