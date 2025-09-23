const Book = require('../models/Book');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

exports.createBook = async (req, res, next) => {
  try {
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;

    if (!req.file) {
      return res.status(400).json({ error: 'Image manquante.' });
    }
    
    const timestamp = Date.now();
    const originalName = req.file.originalname.replace(/\s+/g, "-");
    const fileName = `${timestamp}-${originalName}.webp`;
    const outputPath = path.join(__dirname, '..', 'images', fileName);

    await sharp(req.file.buffer)
      .webp({ quality: 30 })
      .toFile(outputPath);

    const book = new Book({
      ...bookObject,
      userId: req.auth.userId,
      imageUrl: `${req.protocol}://${req.get('host')}/images/${fileName}`
    });

    await book.save();
    res.status(201).json({ message: 'Livre enregistré avec image compressée !' });

  } catch (error) {
    console.error('Erreur createBook :', error);
    res.status(400).json({ error: 'Erreur lors de l\'enregistrement du livre.' });
  }
};

exports.getOneBook = (req, res, next) => {
  Book.findOne({
    _id: req.params.id
  }).then(
    (book) => {
      res.status(200).json(book);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

exports.modifyBook = async (req, res, next) => {
  try {
    const bookObject = req.file
      ? JSON.parse(req.body.book)
      : req.body;

    delete bookObject._userId;

    const book = await Book.findOne({ _id: req.params.id });

    if (book.userId !== req.auth.userId) {
      return res.status(401).json({ message: 'Non autorisé' });
    }

    let imageUrl = book.imageUrl;

    if (req.file) {
      // Suppression de l'ancienne image
      const oldFilename = book.imageUrl.split('/images/')[1];
      fs.unlink(`images/${oldFilename}`, (err) => {
        if (err) console.error('Erreur suppression ancienne image :', err);
      });

      // Enregistrement de la nouvelle image
      const timestamp = Date.now();
      const originalName = req.file.originalname.replace(/\s+/g, "-");
      const fileName = `${timestamp}-${originalName}.webp`;
      const outputPath = path.join(__dirname, '..', 'images', fileName);

      await sharp(req.file.buffer)
        .webp({ quality: 30 })
        .toFile(outputPath);

      imageUrl = `${req.protocol}://${req.get('host')}/images/${fileName}`;
    }

    await Book.updateOne(
      { _id: req.params.id },
      { ...bookObject, imageUrl, _id: req.params.id }
    );

    res.status(200).json({ message: 'Livre modifié avec image compressée !' });

  } catch (error) {
    console.error('Erreur modifyBook :', error);
    res.status(400).json({ error });
  }
};

exports.deleteBook = (req, res, next) => {
   Book.findOne({ _id: req.params.id})
       .then(book => {
           if (book.userId != req.auth.userId) {
               res.status(401).json({message: 'Non autorisé'});
           } else {
               const filename = book.imageUrl.split('/images/')[1];
               fs.unlink(`images/${filename}`, () => {
                   Book.deleteOne({_id: req.params.id})
                       .then(() => { res.status(200).json({message: 'Livre supprimé !'})})
                       .catch(error => res.status(401).json({ error }));
               });
           }
       })
       .catch( error => {
           res.status(500).json({ error });
       });
};

exports.getAllBooks = (req, res, next) => {
  Book.find().then(
    (books) => {
      res.status(200).json(books);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};

exports.getBestRating = (req, res, next) => {
  Book.find()
    .sort({ averageRating: -1 })
    .limit(3)
    .then((books) => {
      res.status(200).json(books);
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

exports.rateBook = async (req, res) => {
  const bookId = req.params.id;
  const { userId, rating } = req.body;

  // Vérification des données reçues
  if (!userId || typeof rating !== 'number') {
    return res.status(400).json({ message: 'userId et rating sont requis.' });
  }

  if (rating < 0 || rating > 5) {
    return res.status(400).json({ message: 'La note doit être comprise entre 0 et 5.' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Livre non trouvé.' });

    const alreadyRated = book.ratings.find(r => r.userId === userId);
    if (alreadyRated) {
      return res.status(403).json({ message: 'Cet utilisateur a déjà noté ce livre.' });
    }
    
    book.ratings.push({ userId, grade: rating });
    
    const total = book.ratings.reduce((sum, r) => sum + r.grade, 0);
    book.averageRating = total / book.ratings.length;

    await book.save();

    res.status(201).json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};
